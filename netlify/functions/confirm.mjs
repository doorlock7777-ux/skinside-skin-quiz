import { json, getUser, orders, mail, esc, tossAuth, addStat } from "./_lib.mjs";

/* 주문이 들어오면 운영자에게만 바로 알리고, 브랜드에는 매일 아침 9시(KST)에 일괄 전달한다 (brandmail.mjs) */
async function notify(o) {
  const rows = o.items.map((l) => `<li>${esc(l.name)} ${l.optName ? "(" + esc(l.optName) + ")" : ""} x ${l.q}</li>`).join("");
  if (process.env.NOTIFY_EMAIL) await mail(process.env.NOTIFY_EMAIL, `[주문] ${o.id} ${o.total}원`, `<p>주문번호 <b>${esc(o.id)}</b></p><ul>${rows}</ul><p>브랜드에는 다음 날 아침 9시에 전달돼요.</p>`);
  return {};
}

export default async (req) => {
  const user = getUser(req);
  if (!user) return json({ error: "로그인이 필요해요" }, 401);
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { paymentKey, orderId, amount } = await req.json().catch(() => ({}));
  const st = orders();
  const o = await st.get(String(orderId || ""), { type: "json" });
  if (!o || o.userId !== user.id) return json({ error: "주문을 찾을 수 없어요" }, 404);
  if (o.status === "paid" || o.status === "shipped" || o.status === "partial") return json({ ok: true, orderId: o.id });
  if (Number(amount) !== o.total) return json({ error: "결제 금액이 달라요" }, 400);
  if (!process.env.TOSS_SECRET_KEY) return json({ error: "결제 설정이 아직 없어요" }, 503);

  const r = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { authorization: tossAuth(), "content-type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId: o.id, amount: o.total }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    o.status = "failed"; o.failReason = j.message || "";
    await st.setJSON(o.id, o);
    return json({ error: j.message || "결제 승인에 실패했어요" }, 400);
  }
  o.status = "paid"; o.paidAt = new Date().toISOString(); o.paymentKey = j.paymentKey; o.method = j.method || "";
  await st.setJSON(o.id, o);
  try { await addStat(o.items.map((l) => [l.id, "b", l.q])); } catch {}
  try { o.notified = await notify(o); await st.setJSON(o.id, o); } catch {}
  return json({ ok: true, orderId: o.id });
};

export const config = { path: "/api/confirm" };
