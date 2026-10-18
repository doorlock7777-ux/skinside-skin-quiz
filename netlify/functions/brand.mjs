import { json, orders, BRANDS, brandFromReq, setShipment } from "./_lib.mjs";

/* 브랜드 전용 화면용 API: 브랜드 링크(토큰)로만 접근, 자기 브랜드 제품이 든 주문만 보인다 */
export default async (req) => {
  const brand = brandFromReq(req);
  if (!brand) return json({ error: "unauthorized" }, 401);
  const u = new URL(req.url), st = orders();

  if (u.pathname === "/api/brand/orders") {
    const { blobs } = await st.list();
    const all = (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean);
    const mine = all.filter((o) => (o.sent || {})[brand] && ["paid", "partial", "shipped", "canceled"].includes(o.status))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 200)
      .map((o) => ({ id: o.id, at: o.paidAt || o.createdAt, canceled: o.status === "canceled", ship: o.ship, items: o.items.filter((l) => l.brand === brand).map((l) => ({ name: l.name, optName: l.optName, q: l.q })), shipment: (o.shipments || {})[brand] || null }));
    return json({ brand: BRANDS[brand].name, orders: mine });
  }
  if (u.pathname === "/api/brand/ship" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const o = await st.get(String(b.orderId || ""), { type: "json" });
    if (!o || !(o.sent || {})[brand] || o.status === "canceled") return json({ error: "처리할 수 없는 주문이에요" }, 400);
    if (!/^[0-9A-Za-z\-]{6,30}$/.test(String(b.tracking || "").trim())) return json({ error: "송장번호를 확인해주세요" }, 400);
    setShipment(o, brand, b.carrier, String(b.tracking).trim());
    await st.setJSON(o.id, o);
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
};
export const config = { path: ["/api/brand/orders", "/api/brand/ship"] };
