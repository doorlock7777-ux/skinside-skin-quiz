import { orders, tossAuth } from "./_lib.mjs";
import { bookCancel, brandsOf, remaining, SHIP, UNASSIGNED, isSale } from "./_money.mjs";
import { finalizePaid } from "./_pay.mjs";
import { setLast } from "./_adj.mjs";

/* 토스 결제 정보와 우리 주문을 맞춘다.
   - 결제는 됐는데 주문이 pending/failed 로 남은 경우를 복구하고
   - 토스 대시보드·카드사에서 직접 한 취소·부분취소를 환불로 가져온다. */
const RECENT_MS = 3 * 60 * 1000; /* 방금 우리가 낸 환불과 겹치지 않게, 아주 최근 취소는 다음 대조 때 가져온다 */

export async function tossPayment(o) {
  const url = o.paymentKey ? `https://api.tosspayments.com/v1/payments/${encodeURIComponent(o.paymentKey)}` : `https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(o.id)}`;
  try {
    const r = await fetch(url, { headers: { authorization: tossAuth() } });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, p: j } : { ok: false, status: r.status, code: j.code };
  } catch { return { ok: false, status: 0 }; }
}

export function applyPayment(o, p, now = Date.now()) {
  const res = { recovered: false, external: 0, unassigned: 0, mismatch: false, changed: false };
  const paidState = ["DONE", "PARTIAL_CANCELED", "CANCELED"].includes(p.status);
  if (["pending", "failed"].includes(o.status) && paidState) {
    if (Number(p.totalAmount) !== o.total) { o.mismatch = { toss: Number(p.totalAmount), ours: o.total }; res.mismatch = res.changed = true; return res; }
    o.status = "paid"; o.paidAt = p.approvedAt || new Date(now).toISOString(); o.paymentKey = p.paymentKey; o.method = p.method || ""; o.recovered = true; delete o.failReason;
    res.recovered = res.changed = true;
  }
  if (!isSale(o)) return res;
  if (p.totalAmount !== undefined && Number(p.totalAmount) !== o.total) { if (!o.mismatch) { o.mismatch = { toss: Number(p.totalAmount), ours: o.total }; res.changed = true; } res.mismatch = true; return res; }
  if (o.mismatch) { delete o.mismatch; res.changed = true; }
  o.refunds = o.refunds || [];
  const cancels = (p.cancels || []).filter((c) => c && c.transactionKey);
  const known = new Set([...(o.tossTx || []), ...o.refunds.map((r) => r.tx).filter(Boolean)]);
  let unknown = cancels.filter((c) => !known.has(c.transactionKey));
  /* 우리가 직접 낸 환불(거래키 없이 저장된 것)과 금액이 같은 취소는 같은 건으로 본다 */
  o.refunds.filter((r) => !r.tx && r.source !== "cancel" && r.source !== "toss").forEach((r) => {
    const i = unknown.findIndex((c) => Number(c.cancelAmount) === r.amount);
    if (i >= 0) { r.tx = unknown[i].transactionKey; unknown.splice(i, 1); res.changed = true; }
  });
  const old = unknown.filter((c) => now - new Date(c.canceledAt || 0).getTime() >= RECENT_MS);
  unknown.filter((c) => !old.includes(c)).forEach((c) => (res.skippedRecent = (res.skippedRecent || 0) + 1));
  for (const c of old) {
    const amount = Number(c.cancelAmount), at = c.canceledAt || new Date(now).toISOString();
    const fullNow = p.status === "CANCELED" && old[old.length - 1] === c && o.status !== "canceled";
    if (fullNow) { const made = bookCancel(o, at, c.transactionKey); res.external += amount; res.changed = true; if (!made.length) o.status = "canceled"; }
    else {
      const bs = brandsOf(o), one = bs.length === 1 ? bs[0] : null;
      /* 한 브랜드 주문이거나 배송비만 남은 환불이면 바로 배정, 묶음 주문은 관리자가 지정 */
      o.refunds.push({ brand: one || UNASSIGNED, amount, at, source: "toss", tx: c.transactionKey, note: c.cancelReason || "" });
      res.external += amount; if (!one) res.unassigned++; res.changed = true;
    }
    (o.tossTx = o.tossTx || []).push(c.transactionKey);
  }
  /* 우리 환불에 붙은 거래키도 기록 */
  const keys = new Set(o.tossTx || []);
  o.refunds.forEach((r) => { if (r.tx && !keys.has(r.tx)) { (o.tossTx = o.tossTx || []).push(r.tx); keys.add(r.tx); } });
  return res;
}

/* 주문 하나를 토스와 맞추고 저장 */
export async function syncOrder(id) {
  const st = orders(), o = await st.get(String(id), { type: "json" });
  if (!o) return { error: "주문 없음" };
  const t = await tossPayment(o);
  if (!t.ok) return t.status === 404 ? { skipped: true } : { error: "토스 조회 실패" + (t.status ? " " + t.status : "") };
  const r = applyPayment(o, t.p);
  if (r.changed) await st.setJSON(o.id, o);
  if (r.recovered) await finalizePaid(o);
  return r;
}

/* 최근 주문 전체 대조: 결제 복구 + 외부 취소 반영 + 금액 불일치 표시 */
export async function reconcileAll({ days = 40, cap = 400 } = {}) {
  const st = orders(), { blobs } = await st.list();
  const os = (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean);
  const cut = Date.now() - days * 864e5, cutPending = Date.now() - 3 * 864e5;
  const list = os.filter((o) => (["pending", "failed"].includes(o.status) ? new Date(o.createdAt).getTime() > cutPending : isSale(o) && o.paymentKey && new Date(o.paidAt || o.createdAt).getTime() > cut)).slice(0, cap);
  const out = { at: new Date().toISOString(), checked: 0, recovered: 0, external: 0, unassigned: 0, mismatch: 0, errors: 0, ids: [] };
  for (const o0 of list) {
    const r = await syncOrder(o0.id);
    if (r.skipped) continue;
    out.checked++;
    if (r.error) { out.errors++; continue; }
    if (r.recovered) { out.recovered++; out.ids.push(o0.id); }
    if (r.external) { out.external += r.external; out.ids.push(o0.id); }
    out.unassigned += r.unassigned || 0; if (r.mismatch) out.mismatch++;
  }
  await setLast(out);
  return out;
}
export { SHIP, remaining };
