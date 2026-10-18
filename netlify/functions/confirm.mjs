import { json, getUser, orders, BRANDS, mail, esc, tossAuth } from "./_lib.mjs";

async function notify(o) {
  const by = {};
  o.items.forEach((l) => (by[l.brand] = by[l.brand] || []).push(l));
  const a = o.ship;
  const addr = `(${esc(a.zip)}) ${esc(a.addr1)} ${esc(a.addr2)}`;
  const rows = (ls) => ls.map((l) => `<li>${esc(l.name)} ${l.optName ? "(" + esc(l.optName) + ")" : ""} x ${l.q}</li>`).join("");
  const body = (ls) => `<p>주문번호 <b>${esc(o.id)}</b></p><ul>${rows(ls)}</ul><p>받는 분 ${esc(a.name)}<br>연락처 ${esc(a.phone)}<br>주소 ${addr}<br>메모 ${esc(a.memo)}</p>`;
  const sent = {};
  for (const b of Object.keys(by)) {
    const br = BRANDS[b];
    sent[b] = br && br.email ? await mail(br.email, `[스킨인사이드] 신규 주문 ${o.id}`, body(by[b])) : false;
  }
  if (process.env.NOTIFY_EMAIL) await mail(process.env.NOTIFY_EMAIL, `[주문] ${o.id} ${o.total}원`, body(o.items) + `<p>브랜드 메일 발송: ${esc(JSON.stringify(sent))}</p>`);
  return sent;
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
  try { o.notified = await notify(o); await st.setJSON(o.id, o); } catch {}
  return json({ ok: true, orderId: o.id });
};

export const config = { path: "/api/confirm" };
