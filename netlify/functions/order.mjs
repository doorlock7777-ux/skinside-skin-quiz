import { randomBytes } from "node:crypto";
import { json, getUser, orders, userIdx, loadProducts, shipFee } from "./_lib.mjs";

export default async (req) => {
  const user = getUser(req);
  if (!user) return json({ error: "로그인이 필요해요" }, 401);

  if (req.method === "GET") {
    const ids = (await userIdx().get(user.id, { type: "json" })) || [];
    const os = (await Promise.all(ids.slice(-30).map((i) => orders().get(i, { type: "json" })))).filter(Boolean);
    os.forEach((o) => { delete o.paymentKey; delete o.ship; });
    return json({ orders: os.reverse() });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let b;
  try { b = await req.json(); } catch { return json({ error: "잘못된 요청" }, 400); }
  const { data, map } = await loadProducts(req);
  const items = [];
  for (const x of (b.items || []).slice(0, 30)) {
    const p = map[x.id];
    const q = Math.floor(Number(x.q));
    if (!p || p.soldOut || !(q >= 1 && q <= 20)) return json({ error: "주문할 수 없는 제품이 있어요" }, 400);
    const oi = p.options ? Math.floor(Number(x.opt) || 0) : 0;
    if (p.options && !p.options[oi]) return json({ error: "옵션을 확인해주세요" }, 400);
    items.push({ id: p.id, brand: p.brand, name: p.name, optName: p.options ? p.options[oi].n : p.option || "", opt: oi, q, unit: p.options ? p.options[oi].price : p.price });
  }
  if (!items.length) return json({ error: "주문 제품이 없어요" }, 400);
  const s = b.ship || {};
  const ship = { name: String(s.name || "").slice(0, 40), phone: String(s.phone || "").slice(0, 20), zip: String(s.zip || "").slice(0, 10), addr1: String(s.addr1 || "").slice(0, 150), addr2: String(s.addr2 || "").slice(0, 100), memo: String(s.memo || "").slice(0, 100) };
  if (!ship.name || !/^[0-9\-+ ]{9,15}$/.test(ship.phone) || !ship.addr1) return json({ error: "배송지를 확인해주세요" }, 400);

  const sub = items.reduce((a, l) => a + l.unit * l.q, 0);
  const fee = shipFee(data.shipping || {}, sub);
  const id = "SK" + Date.now().toString(36).toUpperCase() + randomBytes(3).toString("hex").toUpperCase();
  const order = {
    id, userId: user.id, userName: user.name, userEmail: user.email, items, ship,
    sub, shipFee: fee, total: sub + fee, status: "pending", createdAt: new Date().toISOString(), shipments: {},
  };
  await orders().setJSON(id, order);
  const idx = (await userIdx().get(user.id, { type: "json" })) || [];
  idx.push(id);
  await userIdx().setJSON(user.id, idx.slice(-200));
  const name = items[0].name + (items.length > 1 ? " 외 " + (items.length - 1) + "건" : "");
  return json({ orderId: id, amount: order.total, orderName: name.slice(0, 100) });
};

export const config = { path: "/api/order" };
