/* 정산·부가세가 함께 쓰는 돈 계산 규칙(순수 함수).
   - 결제가 된 적 있는 주문(paid/partial/shipped/canceled)은 결제일에 판매로 잡는다.
   - 취소·환불은 전부 "환불 이벤트"로 기록하고 환불한 날(달)에서 뺀다. 그래서 이미 확정한 달의 숫자는 바뀌지 않는다.
   - 배송비는 브랜드 몫이 아니라 플랫폼 몫이라 SHIP 칸에 따로 둔다.
   - 어느 브랜드 몫인지 알 수 없는 환불(토스에서 직접 부분취소한 묶음 주문)은 UNASSIGNED 로 두고 관리자가 지정할 때까지 확정을 막는다. */
export const LIVE = ["paid", "partial", "shipped"];
export const SALE = [...LIVE, "canceled"];
export const SHIP = "_ship", UNASSIGNED = "_unassigned";
export const dayOf = (iso) => new Date(new Date(iso).getTime() + 9 * 36e5).toISOString().slice(0, 10);
export const when = (o) => o.paidAt || o.createdAt;
export const isSale = (o) => SALE.includes(o.status);
export const lines = (o, b) => o.items.filter((l) => l.brand === b);
export const amt = (ls) => ls.reduce((a, l) => a + l.unit * l.q, 0);
export const brandsOf = (o) => [...new Set(o.items.map((l) => l.brand))];
const real = (o) => o.refunds || [];

/* 브랜드(또는 SHIP)별로 아직 환불되지 않은 금액 */
export function remaining(o, brand) {
  const base = brand === SHIP ? (o.shipFee || 0) : amt(lines(o, brand));
  return base - real(o).filter((r) => r.brand === brand).reduce((a, r) => a + r.amount, 0);
}

/* 남은 금액 전부를 환불로 기록 (전체 취소). 이미 기록했으면 아무것도 하지 않는다 */
export function bookCancel(o, at, tx) {
  if (o.cancelBooked) return [];
  const made = [];
  o.refunds = real(o);
  for (const b of [...brandsOf(o), SHIP]) {
    const left = remaining(o, b);
    if (left > 0) { const r = { brand: b, amount: left, at, source: "cancel" }; if (tx && !made.length) r.tx = tx; o.refunds.push(r); made.push(r); }
  }
  o.cancelBooked = true; o.status = "canceled"; o.canceledAt = o.canceledAt || at;
  return made;
}

/* 예전 방식(환불 기록 없이 canceled 로만 바뀐 주문)도 같은 규칙으로 읽는다 */
export function refundsOf(o) {
  const rs = real(o).slice();
  if (o.status === "canceled" && !o.cancelBooked) {
    const c = { ...o, refunds: rs }; bookCancel(c, o.canceledAt || when(o));
    return c.refunds.filter((r) => !rs.includes(r)).concat(rs);
  }
  return rs;
}
export const hasUnassigned = (o) => refundsOf(o).some((r) => r.brand === UNASSIGNED);
