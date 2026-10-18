import { randomBytes } from "node:crypto";
import { json, getUser, orders, userIdx, loadProducts, shipFee } from "./_lib.mjs";
import { balance, holdForOrder, apply, releaseStale, MIN_PAY } from "./_points.mjs";
import { cancelOrder } from "./_cancel.mjs";

export default async (req) => {
  const user = getUser(req);
  if (!user) return json({ error: "로그인이 필요해요" }, 401);

  if (req.method === "GET") {
    const ids = (await userIdx().get(user.id, { type: "json" })) || [];
    const os = (await Promise.all(ids.slice(-30).map((i) => orders().get(i, { type: "json" })))).filter(Boolean);
    os.forEach((o) => { delete o.paymentKey; delete o.ship; delete o.tossTx; });
    return json({ orders: os.reverse() });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let b;
  try { b = await req.json(); } catch { return json({ error: "잘못된 요청" }, 400); }
  /* 주문 취소: 아직 어느 브랜드도 발송하지 않았을 때만 고객이 바로 취소한다 */
  if (new URL(req.url).pathname.replace(/\/$/, "") === "/api/order/cancel") {
    const o = await orders().get(String(b.orderId || ""), { type: "json" });
    if (!o || o.userId !== user.id) return json({ error: "주문을 찾을 수 없어요" }, 404);
    const r = await cancelOrder(o, { by: "customer", reason: String(b.reason || "").slice(0, 60) });
    return r.error ? json({ error: r.error }, 400) : json({ ok: true, refundedCash: r.refundedCash, pointsBack: r.pointsBack });
  }
  const { data, map } = await loadProducts(req);
  const items = [];
  for (const x of (b.items || []).slice(0, 30)) {
    const p = map[x.id];
    const q = Math.floor(Number(x.q));
    if (!p || p.soldOut || !(q >= 1 && q <= 20)) return json({ error: "주문할 수 없는 제품이 있어요" }, 400);
    if (p.stockQty !== null && p.stockQty !== undefined && q > p.stockQty) return json({ error: `${p.name}의 재고가 ${p.stockQty}개만 남았어요` }, 400);
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
  /* 포인트는 현금처럼 쓴다. 주문을 만들 때 미리 잡아두고, 결제하지 않으면 돌려준다. 토스는 0원 결제를 받지 않아 최소 금액은 결제해야 한다 */
  const want = Math.max(0, Math.floor(Number(b.usePoints) || 0));
  let pts = 0;
  if (want > 0) {
    await releaseStale(user.id, { immediate: true });
    const cap = Math.max(0, Math.min(await balance(user.id), sub + fee - MIN_PAY));
    if (want > cap) return json({ error: `사용할 수 있는 포인트는 최대 ${cap.toLocaleString("ko-KR")}P예요` }, 400);
    const h = await holdForOrder(user.id, { id }, want);
    if (!h.done || h.applied !== -want) { if (h.applied < 0) await apply(user.id, -h.applied, "return", "포인트 사용 실패", "ret-fail-" + id); return json({ error: "포인트 잔액이 바뀌었어요. 다시 시도해주세요" }, 409); }
    pts = want;
  }
  const order = {
    id, userId: user.id, userName: user.name, userEmail: user.email, items, ship,
    sub, shipFee: fee, total: sub + fee, pointsUsed: pts, payAmount: sub + fee - pts, status: "pending", createdAt: new Date().toISOString(), shipments: {},
  };
  await orders().setJSON(id, order);
  const idx = (await userIdx().get(user.id, { type: "json" })) || [];
  idx.push(id);
  await userIdx().setJSON(user.id, idx.slice(-200));
  const name = items[0].name + (items.length > 1 ? " 외 " + (items.length - 1) + "건" : "");
  return json({ orderId: id, amount: order.payAmount, pointsUsed: pts, orderName: name.slice(0, 100) });
};

export const config = { path: ["/api/order", "/api/order/cancel"] };
