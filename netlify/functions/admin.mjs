import { json, isAdmin, orders, BRANDS, tossAuth } from "./_lib.mjs";

async function all() {
  const st = orders();
  const { blobs } = await st.list();
  const os = (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean);
  return os.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
const csv = (rows) => "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");

export default async (req) => {
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);
  const u = new URL(req.url), p = u.pathname.replace(/\/$/, "");
  const st = orders();

  if (p === "/api/admin/orders") {
    return json({ orders: (await all()).filter((o) => o.status !== "pending"), brands: BRANDS });
  }
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (p === "/api/admin/ship" && req.method === "POST") {
    const o = await st.get(String(b.orderId || ""), { type: "json" });
    if (!o || !o.items.some((l) => l.brand === b.brand)) return json({ error: "주문 없음" }, 404);
    o.shipments = o.shipments || {};
    o.shipments[b.brand] = { carrier: String(b.carrier || ""), tracking: String(b.tracking || "").replace(/[^0-9A-Za-z\-]/g, ""), at: new Date().toISOString() };
    const brands = [...new Set(o.items.map((l) => l.brand))];
    const n = brands.filter((x) => o.shipments[x] && o.shipments[x].tracking).length;
    o.status = n === brands.length ? "shipped" : n ? "partial" : "paid";
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
    const agg = {};
    (await all()).filter((o) => ["paid", "partial", "shipped"].includes(o.status) && (o.paidAt || "").startsWith(m)).forEach((o) => {
      o.items.forEach((l) => {
        const a = (agg[l.brand] = agg[l.brand] || { sales: 0, n: 0 });
        a.sales += l.unit * l.q; a.n += l.q;
      });
    });
    const rows = [["월", "브랜드", "판매수량", "판매금액", "수수료율(%)", "수수료(우리 수익)", "브랜드 정산금"]];
    Object.keys(agg).forEach((k) => {
      const fee = (BRANDS[k] && BRANDS[k].fee) || 0, c = Math.round((agg[k].sales * fee) / 100);
      rows.push([m, (BRANDS[k] && BRANDS[k].name) || k, agg[k].n, agg[k].sales, fee, c, agg[k].sales - c]);
    });
    return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="settlement-${m}.csv"` } });
  }
  return json({ error: "not found" }, 404);
};

export const config = { path: "/api/admin/*" };
