import { json, orders, BRANDS, tossAuth, setShipment, notifyShipped, adjustStock, normCarrier } from "./_lib.mjs";
import { isAdmin, adminLogin, adminLogout, partnerIdx, issueCode, revokeCode, PARTNER_DIR } from "./_auth.mjs";
import { monthSettle } from "./_home.mjs";
import { notifyCancel } from "./_batch.mjs";
import { adminSummary, allOrders } from "./_ctx.mjs";
import { allTickets, getTicket, addMessage, close, receiveAndRefund } from "./_cs.mjs";
import { allReviews, getReview, manageView, markRead, setBest, decide as decideReview } from "./_reviews.mjs";
import { confirmSettlement, markPaid, getSettlement, listSettlements } from "./_settle.mjs";

const all = allOrders;
const csv = (rows) => "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");

export default async (req) => {
  const u = new URL(req.url), p = u.pathname.replace(/\/$/, "");
  if (p === "/api/admin/login" && req.method === "POST") return adminLogin(req);
  if (p === "/api/admin/logout" && req.method === "POST") return adminLogout();
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);
  const st = orders();
  if (p === "/api/admin/me") return json({ ok: true });

  if (p === "/api/admin/home") return json(await adminSummary(req));
  if (p === "/api/admin/orders") {
    return json({ orders: (await all()).filter((o) => o.status !== "pending"), brands: BRANDS });
  }
  /* 파트너 브랜드 접속 코드: 발급(재발급)하면 새 코드를 한 번만 보여주고, 이전 코드와 로그인 상태는 바로 무효 */
  if (p === "/api/admin/partners") {
    const idx = await partnerIdx();
    return json({ dir: PARTNER_DIR, partners: Object.keys(BRANDS).map((k) => ({ key: k, name: BRANDS[k].name, email: BRANDS[k].email || "", fee: BRANDS[k].fee || 0, issuedAt: (idx[k] || {}).issuedAt || null, lastLogin: (idx[k] || {}).lastLogin || null })) });
  }
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  if (p === "/api/admin/partners/issue" && req.method === "POST") {
    if (!BRANDS[b.brand]) return json({ error: "브랜드를 찾을 수 없어요" }, 404);
    return json({ ok: true, code: await issueCode(b.brand) });
  }
  if (p === "/api/admin/partners/revoke" && req.method === "POST") {
    if (!BRANDS[b.brand]) return json({ error: "브랜드를 찾을 수 없어요" }, 404);
    await revokeCode(b.brand); return json({ ok: true });
  }

  if (p === "/api/admin/ship" && req.method === "POST") {
    const o = await st.get(String(b.orderId || ""), { type: "json" });
    if (!o || !o.items.some((l) => l.brand === b.brand)) return json({ error: "주문 없음" }, 404);
    setShipment(o, b.brand, normCarrier(b.carrier) || b.carrier, b.tracking);
    await notifyShipped(o, b.brand);
    await st.setJSON(o.id, o);
    return json({ ok: true, status: o.status });
  }

  if (p === "/api/admin/cancel" && req.method === "POST") {
    const o = await st.get(String(b.orderId || ""), { type: "json" });
    if (!o || !o.paymentKey || o.status === "canceled") return json({ error: "취소할 수 없는 주문" }, 400);
    const r = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(o.paymentKey)}/cancel`, {
      method: "POST", headers: { authorization: tossAuth(), "content-type": "application/json" },
      body: JSON.stringify({ cancelReason: String(b.reason || "관리자 취소").slice(0, 100) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: j.message || "취소 실패" }, 400);
    o.status = "canceled"; o.canceledAt = new Date().toISOString();
    try { await adjustStock(o.items.map((l) => [l.id, l.q])); } catch {}
    try { await notifyCancel(o); } catch {}
    await st.setJSON(o.id, o);
    return json({ ok: true });
  }

  /* ---- CS ---- */
  /* ---- 리뷰 (모든 브랜드) ---- */
  if (p.startsWith("/api/admin/reviews")) {
    const rv = await allReviews();
    if (p === "/api/admin/reviews") return json(manageView(rv));
    const b2 = b;
    if (p === "/api/admin/reviews/read") { await markRead(rv, "admin", b2.ids === "all" ? "all" : b2.ids); return json({ ok: true }); }
    const r = await getReview(b2.id);
    if (!r) return json({ error: "리뷰를 찾을 수 없어요" }, 404);
    const res = p === "/api/admin/reviews/best" ? await setBest(r, !!b2.on) : p === "/api/admin/reviews/decide" ? await decideReview(r, String(b2.action || "")) : null;
    if (!res) return json({ error: "not found" }, 404);
    return res.error ? json({ error: res.error }, 400) : json({ ok: true });
  }
  if (p === "/api/admin/cs") {
    const [tickets, os] = await Promise.all([allTickets(), all()]), byId = Object.fromEntries(os.map((o) => [o.id, o]));
    return json({ tickets: tickets.slice(0, 300).map((t) => { const o = byId[t.orderId] || {}; const { userId, ...pub } = t; return { ...pub, brandName: (BRANDS[t.brand] || {}).name || t.brand, customer: { name: (o.ship || {}).name || t.userName, phone: (o.ship || {}).phone || "" } }; }) });
  }
  if (p.startsWith("/api/admin/cs/") && req.method === "POST") {
    const t = await getTicket(b.id); if (!t) return json({ error: "요청을 찾을 수 없어요" }, 404);
    const act = p.slice("/api/admin/cs/".length);
    let r;
    if (act === "reply") r = await addMessage(t, "admin", b.text);
    else if (act === "close") r = await close(t, "admin");
    else if (act === "refund") r = await receiveAndRefund(t);
    else return json({ error: "not found" }, 404);
    return r.error ? json({ error: r.error }, 400) : json({ ok: true, ticket: r.ticket });
  }

  /* ---- 정산 ---- */
  if (p === "/api/admin/settlement/confirm" && req.method === "POST") {
    if (!/^\d{4}-\d{2}$/.test(String(b.month || ""))) return json({ error: "월을 확인해주세요" }, 400);
    const { s, created } = await confirmSettlement((await all()).filter((o) => o.status !== "pending"), b.month);
    return json({ ok: true, created, settlement: s });
  }
  if (p === "/api/admin/settlement/paid" && req.method === "POST") {
    const s = await markPaid(String(b.month || ""), String(b.brand || ""));
    return s ? json({ ok: true, settlement: s }) : json({ error: "확정된 정산이 아니에요" }, 400);
  }
  if (p === "/api/admin/settlement") {
    const m = u.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const conf = await getSettlement(m);
    const rows = conf ? conf.rows : monthSettle(await all(), m);
    if (u.searchParams.get("format") === "json") return json({ month: m, rows, confirmed: conf ? { at: conf.confirmedAt, paid: conf.paid || {} } : null });
    const out = [["월", "브랜드", "판매수량", "판매금액", "환불금액", "수수료율(%)", "수수료(우리 수익)", "브랜드 정산금", "송금 완료"]];
    rows.forEach((r) => out.push([m, r.name, r.n, r.sales, r.refund || 0, r.feeRate, r.fee, r.payout, conf && (conf.paid || {})[r.brand] ? "완료" : ""]));
    return new Response(csv(out), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="settlement-${m}.csv"` } });
  }
  return json({ error: "not found" }, 404);
};

export const config = { path: "/api/admin/*" };
