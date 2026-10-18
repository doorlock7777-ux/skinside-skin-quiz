import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { orders, BRANDS, mail, esc, tossAuth } from "./_lib.mjs";

/* CS(문의, 교환, 반품) 티켓. 상태:
   inquiry: open(고객 답변 대기 아님=브랜드 답변 대기) -> answered -> closed
   return/exchange: open -> approved | rejected ; return: approved -> received -> refunded(자동 환불) ; exchange: approved -> closed(교환품 발송) */
export const csStore = () => getStore({ name: "cs", consistency: "strong" });
export const TYPES = { inquiry: "문의", exchange: "교환", return: "반품" };
export const STATUS = { open: "답변 대기", answered: "답변 완료", approved: "승인", rejected: "거절", received: "입고 확인", refunded: "환불 완료", closed: "종료" };
const clip = (s, n) => String(s ?? "").replace(/\s+$/g, "").slice(0, n);

export async function allTickets() {
  const st = csStore();
  const { blobs } = await st.list();
  return (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
export const getTicket = (id) => csStore().get(String(id || ""), { type: "json" });
const save = (t) => (t.updatedAt = new Date().toISOString(), csStore().setJSON(t.id, t));
export async function createTicket(user, o, brand, type, text) {
  if (!TYPES[type]) return { error: "종류를 확인해주세요" };
  const msg = clip(text, 1000);
  if (msg.length < 2) return { error: "내용을 입력해주세요" };
  if (!o || o.userId !== user.id || !["paid", "partial", "shipped"].includes(o.status)) return { error: "주문을 찾을 수 없어요" };
  if (!o.items.some((l) => l.brand === brand)) return { error: "주문에 없는 브랜드예요" };
  const shipped = !!(o.shipments && o.shipments[brand] && o.shipments[brand].tracking);
  if (type !== "inquiry" && !shipped) return { error: "발송된 뒤에 교환·반품을 신청할 수 있어요. 발송 전 취소는 문의로 남겨주세요" };
  if (type !== "inquiry") {
    const dup = (await allTickets()).find((t) => t.orderId === o.id && t.brand === brand && t.type !== "inquiry" && !["rejected", "refunded", "closed"].includes(t.status));
    if (dup) return { error: "이미 진행 중인 교환·반품이 있어요" };
  }
  const t = { id: "C" + Date.now().toString(36).toUpperCase() + randomBytes(2).toString("hex").toUpperCase(), orderId: o.id, brand, userId: user.id, userName: o.userName || user.name || "", type, status: "open", escalated: false, createdAt: new Date().toISOString(), messages: [{ from: "customer", text: msg, at: new Date().toISOString() }] };
  await save(t);
  const b = BRANDS[brand];
  if (b && b.email) await mail(b.email, `[스킨인사이드] ${TYPES[type]} 요청 (${o.id})`, `<p>고객 ${TYPES[type]} 요청이 들어왔어요. 파트너 페이지의 CS 탭에서 확인하고 답변해주세요.</p><p>주문번호 <b>${esc(o.id)}</b></p><blockquote>${esc(msg)}</blockquote>`);
  return { ticket: t };
}
export async function addMessage(t, from, text) {
  const msg = clip(text, 1000);
  if (msg.length < 1) return { error: "내용을 입력해주세요" };
  if (["refunded", "closed"].includes(t.status)) return { error: "종료된 요청이에요" };
  t.messages.push({ from, text: msg, at: new Date().toISOString() });
  if (from === "customer" && t.status === "answered") t.status = "open";
  if (from === "partner" && t.status === "open" && t.type === "inquiry") t.status = "answered";
  await save(t);
  return { ticket: t };
}
export async function escalate(t, from) {
  if (["refunded", "closed"].includes(t.status)) return { error: "종료된 요청이에요" };
  t.escalated = true; t.messages.push({ from: "system", text: (from === "customer" ? "고객" : "브랜드") + "이 운영자 확인을 요청했어요.", at: new Date().toISOString() });
  await save(t); return { ticket: t };
}
export async function decide(t, action, text) {
  if (t.type === "inquiry" || t.status !== "open") return { error: "처리할 수 없는 상태예요" };
  t.status = action === "approve" ? "approved" : "rejected";
  t.messages.push({ from: "partner", text: clip(text, 1000) || (action === "approve" ? "승인했어요." : "거절했어요."), at: new Date().toISOString() });
  await save(t); return { ticket: t };
}
export async function markExchangeSent(t, tracking) {
  if (t.type !== "exchange" || t.status !== "approved") return { error: "처리할 수 없는 상태예요" };
  t.status = "closed"; t.messages.push({ from: "partner", text: "교환품을 발송했어요." + (tracking ? " 송장번호 " + clip(tracking, 30) : ""), at: new Date().toISOString() });
  await save(t); return { ticket: t };
}
export async function close(t, from) {
  if (["refunded", "closed"].includes(t.status)) return { ticket: t };
  t.status = "closed"; t.messages.push({ from, text: "종료했어요.", at: new Date().toISOString() });
  await save(t); return { ticket: t };
}

/* 반품 입고 확인 -> 그 브랜드 상품 금액만 부분 환불(토스). 한 번만 실행 */
export async function receiveAndRefund(t) {
  if (t.type !== "return" || !["approved", "received"].includes(t.status)) return { error: "처리할 수 없는 상태예요" };
  if (t.status === "approved") { t.status = "received"; t.messages.push({ from: "partner", text: "반품 상품 입고를 확인했어요. 환불을 진행해요.", at: new Date().toISOString() }); }
  const st = orders(), o = await st.get(t.orderId, { type: "json" });
  if (!o) return { error: "주문 없음" };
  o.refunds = o.refunds || [];
  if (o.refunds.some((r) => r.ticketId === t.id)) { t.status = "refunded"; await save(t); return { ticket: t }; }
  const amount = o.items.filter((l) => l.brand === t.brand).reduce((a, l) => a + l.unit * l.q, 0);
  const already = o.refunds.reduce((a, r) => a + r.amount, 0);
  if (!(amount > 0) || already + amount > o.total) { t.refundError = "환불 금액을 확인해주세요"; await save(t); return { ticket: t, error: t.refundError }; }
  if (!o.paymentKey) { t.refundError = "결제 정보가 없어요"; await save(t); return { ticket: t, error: t.refundError }; }
  let r, j;
  try {
    r = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(o.paymentKey)}/cancel`, {
      method: "POST", headers: { authorization: tossAuth(), "content-type": "application/json", "Idempotency-Key": t.id },
      body: JSON.stringify({ cancelReason: "반품 환불 " + t.id, cancelAmount: amount }),
    });
    j = await r.json().catch(() => ({}));
  } catch (e) { r = { ok: false }; j = { message: "결제사 연결 실패" }; }
  if (!r.ok) { t.refundError = j.message || "환불 실패"; await save(t); return { ticket: t, error: t.refundError }; }
  o.refunds.push({ ticketId: t.id, brand: t.brand, amount, at: new Date().toISOString() });
  await st.setJSON(o.id, o);
  delete t.refundError; t.status = "refunded"; t.refundAmount = amount;
  t.messages.push({ from: "system", text: amount.toLocaleString("ko-KR") + "원이 환불됐어요.", at: new Date().toISOString() });
  await save(t);
  const mine = (BRANDS[t.brand] || {}).name || t.brand;
  if (o.userEmail) await mail(o.userEmail, "[스킨인사이드] 환불이 완료됐어요", `<p>${esc(mine)} 반품 건(${esc(o.id)})의 환불 ${amount.toLocaleString("ko-KR")}원이 진행됐어요. 카드사나 결제 수단에 따라 반영까지 며칠 걸릴 수 있어요.</p>`);
  return { ticket: t };
}

/* 고객에게는 이름/주소 같은 내부 정보를 빼고 보여준다 */
export const forCustomer = (t) => ({ id: t.id, orderId: t.orderId, brand: t.brand, brandName: (BRANDS[t.brand] || {}).name || t.brand, type: t.type, status: t.status, escalated: t.escalated, createdAt: t.createdAt, updatedAt: t.updatedAt, refundAmount: t.refundAmount || 0, messages: t.messages });
