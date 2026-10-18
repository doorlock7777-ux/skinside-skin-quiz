import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { orders, userIdx } from "./_lib.mjs";

/* 포인트: 현금처럼 결제에 쓸 수 있다. 장부(ledger)에 한 줄씩 남기고, 같은 사건(key)은 한 번만 반영한다.
   적립 500P(리뷰) / 사용(주문 생성 때 미리 잡아둠) / 반환(취소·환불·결제 실패) / 회수(삭제된 리뷰, 취소된 주문의 리뷰) */
export const REVIEW_POINTS = 500;
export const MIN_PAY = 100; /* 토스는 0원 결제를 받지 않아서 최소 이만큼은 결제해야 한다 */
export const HOLD_MIN = 30; /* 결제를 끝내지 않은 주문이 포인트를 잡아두는 최대 시간(분) */
const st = () => getStore({ name: "points", consistency: "strong" });
const blank = () => ({ balance: 0, log: [] });
const get = async (uid) => (await st().get("u-" + uid, { type: "json" })) || blank();

export async function balance(uid) { return (await get(uid)).balance; }
export async function history(uid) { const a = await get(uid); return { balance: a.balance, log: a.log.slice(-50).reverse() }; }

/* 같은 key 는 한 번만. 잔액은 0 밑으로 내려가지 않는다(회수할 포인트가 모자라면 있는 만큼만 회수) */
export async function apply(uid, delta, type, note, key, extra = {}) {
  const a = await get(uid);
  if (key && a.log.some((x) => x.key === key)) return { done: false, applied: 0, balance: a.balance };
  const applied = delta < 0 ? -Math.min(-delta, a.balance) : delta;
  a.balance += applied;
  a.log.push({ id: "P" + randomBytes(4).toString("hex"), key: key || "", type, amount: applied, asked: delta, note: String(note || "").slice(0, 60), at: new Date().toISOString(), ...extra });
  a.log = a.log.slice(-200);
  await st().setJSON("u-" + uid, a);
  return { done: true, applied, balance: a.balance };
}
export const earnReview = (uid, orderId, productId) => apply(uid, REVIEW_POINTS, "earn", "리뷰 작성", "rv-" + orderId + "-" + productId, { orderId });
export const clawReview = (uid, orderId, productId, why) => apply(uid, -REVIEW_POINTS, "claw", why || "리뷰 삭제", "rvc-" + orderId + "-" + productId, { orderId });
export const holdForOrder = (uid, o, n) => apply(uid, -n, "use", "주문 결제", "use-" + o.id, { orderId: o.id });
/* 주문에 쓴 포인트 중 아직 돌려주지 않은 만큼 돌려준다 (취소·실패·부분환불) */
export async function returnPoints(o, n, why, key) {
  const left = (o.pointsUsed || 0) - (o.pointsReturned || 0), give = Math.min(left, Math.max(0, Math.round(n)));
  if (give <= 0) return 0;
  const r = await apply(o.userId, give, "return", why || "주문 취소", key || "ret-" + o.id + "-" + (o.pointsReturned || 0), { orderId: o.id });
  if (r.done) o.pointsReturned = (o.pointsReturned || 0) + give;
  return r.done ? give : 0;
}
/* 결제가 끝나지 않은 주문이 잡고 있는 포인트 풀어주기. immediate 면 나이와 상관없이(새 주문을 만들 때), 아니면 HOLD_MIN 분이 지난 것만 */
export async function releaseStale(uid, { immediate = false, exceptId = "", now = Date.now() } = {}) {
  /* 최근 주문 10개만 병렬로 확인한다 (이보다 오래된 미결제 주문은 새 주문을 만들 때 이미 풀렸다) */
  const os = orders(), ids = ((await userIdx().get(uid, { type: "json" })) || []).filter((id) => id !== exceptId).slice(-10); let n = 0;
  const list = await Promise.all(ids.map((id) => os.get(id, { type: "json" })));
  for (const o of list) {
    if (!o || o.userId !== uid || !o.pointsUsed || o.pointsReleased) continue;
    const open = ["pending", "failed"].includes(o.status);
    if (!open || (!immediate && now - new Date(o.createdAt).getTime() <= HOLD_MIN * 6e4)) continue;
    n += await releaseOrder(o);
  }
  return n;
}
export async function releaseOrder(o) {
  const got = await returnPoints(o, o.pointsUsed - (o.pointsReturned || 0), "결제하지 않은 주문", "rel-" + o.id);
  o.pointsReleased = new Date().toISOString(); await orders().setJSON(o.id, o); return got;
}
/* 풀어준 주문이 뒤늦게 결제되면 다시 잡는다. 잔액이 모자라면 false(토스 승인 전에 막아야 한다) */
export async function rehold(o) {
  if (!o.pointsReleased) return true;
  const need = o.pointsUsed - 0;
  if ((await balance(o.userId)) < need) return false;
  const r = await apply(o.userId, -need, "use", "주문 결제", "use2-" + o.id + "-" + o.pointsReleased, { orderId: o.id });
  if (r.done && r.applied === -need) { delete o.pointsReleased; o.pointsReturned = 0; return true; }
  return false;
}
