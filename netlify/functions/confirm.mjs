import { json, getUser, orders, tossAuth } from "./_lib.mjs";
import { finalizePaid } from "./_pay.mjs";
import { payOf } from "./_money.mjs";
import { rehold, releaseOrder } from "./_points.mjs";
import { tossPayment, applyPayment } from "./_toss.mjs";

export default async (req) => {
  const user = getUser(req);
  if (!user) return json({ error: "로그인이 필요해요" }, 401);
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { paymentKey, orderId, amount } = await req.json().catch(() => ({}));
  const st = orders();
  const o = await st.get(String(orderId || ""), { type: "json" });
  if (!o || o.userId !== user.id) return json({ error: "주문을 찾을 수 없어요" }, 404);
  if (o.status === "paid" || o.status === "shipped" || o.status === "partial" || o.status === "canceled") return json({ ok: true, orderId: o.id });
  if (Number(amount) !== payOf(o)) return json({ error: "결제 금액이 달라요" }, 400);
  if (!process.env.TOSS_SECRET_KEY) return json({ error: "결제 설정이 아직 없어요" }, 503);

  /* 포인트를 풀어준 주문이 뒤늦게 결제되면 다시 잡는다. 잔액이 모자라면 토스 승인 전에 막는다 */
  if (o.pointsUsed && o.pointsReleased) { if (!(await rehold(o))) return json({ error: "포인트 잔액이 바뀌어서 결제할 수 없어요. 주문을 다시 만들어주세요" }, 409); await st.setJSON(o.id, o); }
  let r, j;
  try {
    r = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { authorization: tossAuth(), "content-type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId: o.id, amount: payOf(o) }),
    });
    j = await r.json().catch(() => ({}));
  } catch {
    /* 응답을 못 받았다고 결제가 안 된 건 아니다. 실패로 확정하지 않고 두면 자동 대조가 결제 여부를 확인해 복구한다 */
    return json({ error: "결제 확인 응답을 받지 못했어요. 결제가 됐다면 잠시 뒤 주문 내역에 나타나요" }, 502);
  }
  if (!r.ok) {
    /* 동시에 두 번 호출돼 한쪽이 먼저 승인된 경우: 실패로 덮어쓰지 않고 현재 상태를 따른다 */
    const fresh = await st.get(o.id, { type: "json" });
    if (fresh && fresh.status !== "pending" && fresh.status !== "failed") return json({ ok: true, orderId: fresh.id });
    if (j.code === "ALREADY_PROCESSED_PAYMENT") {
      const t = await tossPayment({ ...o, paymentKey });
      if (t.ok) { const cur = (await st.get(o.id, { type: "json" })) || o; const a = applyPayment(cur, t.p); if (a.recovered) { await st.setJSON(cur.id, cur); await finalizePaid(cur); return json({ ok: true, orderId: cur.id }); } }
    }
    o.status = "failed"; o.failReason = j.message || "";
    await st.setJSON(o.id, o);
    if (o.pointsUsed) await releaseOrder(o).catch(() => {});
    return json({ error: j.message || "결제 승인에 실패했어요" }, 400);
  }
  const cur = (await st.get(o.id, { type: "json" })) || o;
  cur.status = cur.status === "pending" || cur.status === "failed" ? "paid" : cur.status;
  cur.paidAt = cur.paidAt || new Date().toISOString(); cur.paymentKey = j.paymentKey; cur.method = j.method || "";
  delete cur.failReason;
  await st.setJSON(cur.id, cur);
  await finalizePaid(cur);
  return json({ ok: true, orderId: cur.id });
};

export const config = { path: "/api/confirm" };
