import { orders, tossAuth, adjustStock } from "./_lib.mjs";
import { bookCancel, payOf, refundsOf } from "./_money.mjs";
import { returnPoints } from "./_points.mjs";
import { notifyCancel } from "./_batch.mjs";
import { voidOrderReviews } from "./_reviews.mjs";

/* 지금까지 카드·계좌로 돌려준 금액 (포인트로 낸 몫은 제외) */
export const cashRefunded = (o) => refundsOf(o).reduce((a, r) => a + (r.cash !== undefined ? r.cash : r.amount), 0);
export const trackedAny = (o) => Object.values(o.shipments || {}).some((s) => s && s.tracking);

/* 주문 전체 취소(관리자, 고객 공통): 토스 환불 -> 환불 기록 -> 포인트 반환 -> 재고 복구 -> 브랜드 안내 -> 리뷰/적립 회수.
   고객은 아직 어느 브랜드도 발송하기 전(status paid)에만 직접 취소할 수 있다. */
export async function cancelOrder(o, { by = "admin", reason = "" } = {}) {
  if (!["paid", "partial", "shipped"].includes(o.status)) return { error: "취소할 수 없는 주문이에요" };
  if (by === "customer" && (o.status !== "paid" || trackedAny(o))) return { error: "이미 발송이 시작돼서 직접 취소할 수 없어요. 아래 교환·반품을 신청해주세요" };
  const cashLeft = payOf(o) - cashRefunded(o);
  let tx;
  if (cashLeft > 0) {
    if (!o.paymentKey) return { error: "결제 정보가 없어요" };
    let r, j;
    try {
      r = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(o.paymentKey)}/cancel`, {
        method: "POST", headers: { authorization: tossAuth(), "content-type": "application/json", "Idempotency-Key": "cancel-" + o.id },
        body: JSON.stringify({ cancelReason: String(reason || (by === "customer" ? "고객 취소" : "관리자 취소")).slice(0, 100) }),
      });
      j = await r.json().catch(() => ({}));
    } catch { return { error: "결제사 연결에 실패했어요. 잠시 뒤 다시 시도해주세요" }; }
    if (!r.ok) return { error: j.message || "취소 실패", code: j.code };
    tx = ((j.cancels || []).slice(-1)[0] || {}).transactionKey;
  }
  /* 취소는 남은 금액 전부를 "환불"로 기록한다. 취소한 달에서 차감되고 이미 확정한 정산은 바뀌지 않는다 */
  const made = bookCancel(o, new Date().toISOString(), tx); if (tx) (o.tossTx = o.tossTx || []).push(tx);
  let cash = cashLeft; for (const r of made) { r.cash = Math.min(r.amount, cash); cash -= r.cash; }
  o.canceledBy = by; if (reason) o.cancelReason = String(reason).slice(0, 100);
  const back = await returnPoints(o, (o.pointsUsed || 0) - (o.pointsReturned || 0), "주문 취소", "ret-all-" + o.id).catch(() => 0);
  try { await adjustStock(o.items.map((l) => [l.id, l.q])); } catch {}
  try { await notifyCancel(o); } catch {}
  await orders().setJSON(o.id, o);
  try { await voidOrderReviews(o.id); } catch {}
  return { ok: true, refundedCash: cashLeft, pointsBack: back };
}
