import { json, orders, BRANDS, tossAuth, setShipment } from "./_lib.mjs";
import { isAdmin, adminLogin, adminLogout, partnerIdx, issueCode, revokeCode, PARTNER_DIR } from "./_auth.mjs";
import { adminHome, monthSettle } from "./_home.mjs";

async function all() {
  const st = orders();
  const { blobs } = await st.list();
  const os = (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean);
  return os.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
const csv = (rows) => "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");

export default async (req) => {
  const u = new URL(req.url), p = u.pathname.replace(/\/$/, "");
  if (p === "/api/admin/login" && req.method === "POST") return adminLogin(req);
  if (p === "/api/admin/logout" && req.method === "POST") return adminLogout();
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);
  const st = orders();
  if (p === "/api/admin/me") return json({ ok: true });

  if (p === "/api/admin/home") return json(adminHome((await all()).filter((o) => o.status !== "pending"), await partnerIdx()));
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
    setShipment(o, b.brand, b.carrier, b.tracking);
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
    await st.setJSON(o.id, o);
    return json({ ok: true });
  }

  if (p === "/api/admin/settlement") {
    const m = u.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const rows = monthSettle(await all(), m);
    if (u.searchParams.get("format") === "json") return json({ month: m, rows });
    const out = [["월", "브랜드", "판매수량", "판매금액", "수수료율(%)", "수수료(우리 수익)", "브랜드 정산금"]];
    rows.forEach((r) => out.push([m, r.name, r.n, r.sales, r.feeRate, r.fee, r.payout]));
    return new Response(csv(out), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="settlement-${m}.csv"` } });
  }
  return json({ error: "not found" }, 404);
};

export const config = { path: "/api/admin/*" };
