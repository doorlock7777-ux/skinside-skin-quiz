import { loadBrands, saveBrand, addBrand } from "./_lib.mjs";
import { json, orders, BRANDS, tossAuth, setShipment, notifyShipped, adjustStock, normCarrier } from "./_lib.mjs";
import { isAdmin, adminLogin, adminLogout, partnerIdx, issueCode, revokeCode, PARTNER_DIR } from "./_auth.mjs";
import { monthSettle } from "./_home.mjs";
import { notifyCancel } from "./_batch.mjs";
import { adminSummary, allOrders } from "./_ctx.mjs";
import { allTickets, getTicket, addMessage, close, receiveAndRefund } from "./_cs.mjs";
import { allReviews, getReview, manageView, markRead, setBest, decide as decideReview } from "./_reviews.mjs";
import { confirmSettlement, markPaid, getSettlement, listSettlements, settleReport } from "./_settle.mjs";
import { getAdj, addAdj, delAdj } from "./_adj.mjs";
import { cancelOrder } from "./_cancel.mjs";
import { listTpl, addTpl, delTpl } from "./_tpl.mjs";
import { syncOrder, reconcileAll } from "./_toss.mjs";
import { bookCancel, refundsOf, UNASSIGNED, brandsOf } from "./_money.mjs";

const all = allOrders;
const csv = (rows) => "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");

export default async (req) => { await loadBrands();
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
  const brandInput = () => {
    const email = String(b.email || "").trim().slice(0, 120), fee = Number(b.fee === "" || b.fee == null ? 0 : b.fee);
    if (email && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) return { error: "이메일 형식을 확인해주세요" };
    if (!Number.isFinite(fee) || fee < 0 || fee > 100) return { error: "수수료율은 0~100 사이 숫자로 적어주세요 (15% = 15)" };
    if (fee > 0 && fee < 1) return { error: "15%면 15로 적어주세요. 0.15는 0.15%로 계산돼요" };
    return { email, fee: Math.round(fee * 100) / 100 };
  };
  if (p === "/api/admin/partners/add" && req.method === "POST") {
    const v = brandInput(); if (v.error) return json({ error: v.error }, 400);
    const r = await addBrand(b.name, v.email, v.fee); return r.error ? json({ error: r.error }, 400) : json({ ok: true, key: r.key });
  }
  if (p === "/api/admin/partners/save" && req.method === "POST") {
    if (!BRANDS[b.brand]) return json({ error: "브랜드를 찾을 수 없어요" }, 404);
    const v = brandInput(); if (v.error) return json({ error: v.error }, 400);
    await saveBrand(b.brand, v.email, v.fee); return json({ ok: true, email: v.email, fee: BRANDS[b.brand].fee });
  }
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
    if (!o || o.status === "canceled") return json({ error: "취소할 수 없는 주문" }, 400);
    /* 토스에서 이미 취소된 주문이면 토스 기록을 가져와 맞춘다 */
    const r = await cancelOrder(o, { by: "admin", reason: b.reason });
    if (r.code === "ALREADY_CANCELED_PAYMENT") { const sy = await syncOrder(o.id); return sy.error ? json({ error: sy.error }, 502) : json({ ok: true, synced: true }); }
    return r.error ? json({ error: r.error }, 400) : json({ ok: true });
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
  /* ---- CS 자동 입력 문구 (관리자용) ---- */
  if (p === "/api/admin/cs/templates") return json({ templates: await listTpl("_admin") });
  if (p === "/api/admin/cs/templates/add" && req.method === "POST") { const r = await addTpl("_admin", b.title, b.text); return r.error ? json({ error: r.error }, 400) : json({ templates: r.list }); }
  if (p === "/api/admin/cs/templates/delete" && req.method === "POST") { const r = await delTpl("_admin", String(b.id || "")); return r.error ? json({ error: r.error }, 400) : json({ templates: r.list }); }

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
  if (p === "/api/admin/reconcile" && req.method === "POST") {
    return json({ ok: true, result: await reconcileAll() });
  }
  if (p === "/api/admin/settlement/confirm" && req.method === "POST") {
    if (!/^\d{4}-\d{2}$/.test(String(b.month || ""))) return json({ error: "월을 확인해주세요" }, 400);
    try { await reconcileAll(); } catch {}
    const { s, created, error } = await confirmSettlement((await all()).filter((o) => o.status !== "pending"), b.month);
    return error ? json({ error }, 400) : json({ ok: true, created, settlement: s });
  }
  if (p === "/api/admin/settlement/adjust" && req.method === "POST") {
    const amount = Math.round(Number(b.amount)), memo = String(b.memo || "").trim();
    if (!/^\d{4}-\d{2}$/.test(String(b.month || "")) || !BRANDS[b.brand] || !amount || Math.abs(amount) > 1e9 || memo.length < 2) return json({ error: "월·브랜드·금액(0 제외)·사유(2자 이상)를 확인해주세요" }, 400);
    if (await getSettlement(b.month)) return json({ error: "이미 확정된 달이에요. 확정 전인 달에 넣어주세요 (보통 다음 달)" }, 400);
    return json({ ok: true, adj: await addAdj(b.month, b.brand, amount, memo) });
  }
  if (p === "/api/admin/settlement/adjust/delete" && req.method === "POST") {
    if (await getSettlement(String(b.month || ""))) return json({ error: "이미 확정된 달이에요" }, 400);
    const r = await delAdj(String(b.month || ""), String(b.id || ""));
    return r ? json({ ok: true, adj: r }) : json({ error: "없는 조정이에요" }, 400);
  }
  if (p === "/api/admin/refund/assign" && req.method === "POST") {
    const o = await st.get(String(b.orderId || ""), { type: "json" });
    const i = Number(b.index);
    if (!o || !o.refunds || !o.refunds[i] || o.refunds[i].brand !== UNASSIGNED || !brandsOf(o).includes(b.brand)) return json({ error: "지정할 수 없는 환불이에요" }, 400);
    o.refunds[i].brand = b.brand; o.refunds[i].assignedAt = new Date().toISOString();
    await st.setJSON(o.id, o);
    return json({ ok: true });
  }
  if (p === "/api/admin/settlement/paid" && req.method === "POST") {
    const s = await markPaid(String(b.month || ""), String(b.brand || ""));
    return s ? json({ ok: true, settlement: s }) : json({ error: "확정된 정산이 아니에요" }, 400);
  }
  if (p === "/api/admin/settlement") {
    const m = u.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const conf = await getSettlement(m);
    const os = (await all()).filter((o) => o.status !== "pending"), rep = await settleReport(os, m);
    const rows = conf ? conf.rows : rep.rows;
    if (u.searchParams.get("format") === "json") {
      const unassigned = os.flatMap((o) => (o.refunds || []).map((r, i) => ({ r, i, o })).filter((x) => x.r.brand === UNASSIGNED).map((x) => ({ orderId: x.o.id, index: x.i, amount: x.r.amount, at: x.r.at, note: x.r.note || "", brands: brandsOf(x.o).map((k) => ({ key: k, name: (BRANDS[k] || {}).name || k })) })));
      return json({ month: m, rows, confirmed: conf ? { at: conf.confirmedAt, paid: conf.paid || {} } : null, warns: rep.warns, recon: rep.recon, last: rep.last, adj: await getAdj(m), unassigned, brands: Object.keys(BRANDS).map((k) => ({ key: k, name: BRANDS[k].name })) });
    }
    const out = [["월", "브랜드", "판매수량", "판매금액", "환불금액", "수수료율(%)", "수수료(우리 수익)", "조정", "브랜드 정산금", "송금 완료"]];
    rows.forEach((r) => out.push([m, r.name, r.n, r.sales, r.refund || 0, r.feeRate, r.fee, r.adj || 0, r.payout, conf && (conf.paid || {})[r.brand] ? "완료" : ""]));
    return new Response(csv(out), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="settlement-${m}.csv"` } });
  }
  return json({ error: "not found" }, 404);
};

export const config = { path: "/api/admin/*" };
