import { BRANDS, kday } from "./_lib.mjs";

/* 홈 화면용 요약(읽기 전용). 주문 목록만 받아 계산하는 순수 함수라 시험하기 쉽다. */
const LIVE = ["paid", "partial", "shipped"];
const dayOf = (iso) => new Date(new Date(iso).getTime() + 9 * 36e5).toISOString().slice(0, 10);
const when = (o) => o.paidAt || o.createdAt;
const trk = (o, b) => !!(o.shipments && o.shipments[b] && o.shipments[b].tracking);
const brandsOf = (o) => [...new Set(o.items.map((l) => l.brand))];
const lines = (o, b) => o.items.filter((l) => l.brand === b);
const amt = (ls) => ls.reduce((a, l) => a + l.unit * l.q, 0);
const feeOf = (b) => (BRANDS[b] && BRANDS[b].fee) || 0;
const HOUR = 36e5;
export const LATE_HOURS = 24; /* 브랜드에 전달된 뒤 이 시간이 지나도 송장이 없으면 지연 */

/* 한 주문의 브랜드별 상태: wait(발송 대기) / done(발송 완료). 주문은 결제 즉시 브랜드에 보이고 알림이 간다 */
function parcelState(o, b) { return trk(o, b) ? "done" : "wait"; }

export function monthSettle(os, m, only) {
  const agg = {};
  const slot = (b) => (agg[b] = agg[b] || { sales: 0, n: 0, refund: 0 });
  os.filter((o) => LIVE.includes(o.status) && dayOf(when(o)).startsWith(m)).forEach((o) => brandsOf(o).forEach((b) => {
    if (only && b !== only) return;
    const a = slot(b);
    a.sales += amt(lines(o, b)); a.n += lines(o, b).reduce((x, l) => x + l.q, 0);
  }));
  /* 환불은 환불한 달의 정산에서 뺀다 */
  os.forEach((o) => (o.refunds || []).forEach((r) => { if (dayOf(r.at).startsWith(m) && (!only || r.brand === only)) slot(r.brand).refund += r.amount; }));
  return Object.keys(agg).map((b) => {
    const net = agg[b].sales - agg[b].refund, fee = Math.round((net * feeOf(b)) / 100);
    return { brand: b, name: (BRANDS[b] && BRANDS[b].name) || b, n: agg[b].n, sales: agg[b].sales, refund: agg[b].refund, feeRate: feeOf(b), fee, payout: net - fee };
  }).sort((x, y) => y.sales - x.sales);
}

const prevMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 1 ? (y - 1) + "-12" : y + "-" + String(mo - 1).padStart(2, "0"); };
export const LOW_STOCK = 5;

export function adminHome(os, ctx = {}, now = Date.now()) {
  const idx = ctx.idx || {}, tickets = ctx.tickets || [], settles = ctx.settles || [];
  const today = kday(0), yest = kday(1), live = os.filter((o) => LIVE.includes(o.status));
  const sales = (d) => live.filter((o) => dayOf(when(o)) === d).reduce((a, o) => a + (o.total || 0), 0);
  const cnt = (d) => live.filter((o) => dayOf(when(o)) === d).length;
  const flow = { wait: 0, done: 0, canceled: os.filter((o) => o.status === "canceled").length };
  const late = [], rows = {};
  Object.keys(BRANDS).forEach((b) => (rows[b] = { brand: b, name: BRANDS[b].name, today: 0, open: 0, late: 0, hasCode: !!idx[b], lastLogin: (idx[b] && idx[b].lastLogin) || null, hasEmail: !!BRANDS[b].email }));
  live.forEach((o) => brandsOf(o).forEach((b) => {
    const r = rows[b] || (rows[b] = { brand: b, name: b, today: 0, open: 0, late: 0, hasCode: false, hasEmail: false });
    const s = parcelState(o, b); flow[s]++;
    if (dayOf(when(o)) === today) r.today++;
    if (s === "wait") {
      r.open++;
      const since = new Date(when(o)).getTime();
      if (now - since > LATE_HOURS * HOUR) { r.late++; late.push({ id: o.id, brand: b, name: r.name, hours: Math.floor((now - since) / HOUR) }); }
    }
  }));
  const withOrders = Object.values(rows).filter((r) => r.open || r.today);
  const openT = tickets.filter((t) => !["refunded", "closed", "rejected"].includes(t.status));
  const cs = { open: openT.filter((t) => t.status === "open").length, escalated: openT.filter((t) => t.escalated).length, refundFail: tickets.filter((t) => t.refundError && t.status === "received").length };
  const m = today.slice(0, 7), pm = prevMonth(m), settle = monthSettle(os, m);
  const prevRows = monthSettle(os, pm), conf = settles.find((x) => x.month === pm);
  const needConfirm = prevRows.length && !conf ? prevRows.length : 0;
  const unpaid = settles.reduce((a, x) => a + x.rows.filter((r) => r.payout > 0 && !(x.paid || {})[r.brand]).length, 0);
  const sum = (k) => settle.reduce((a, r) => a + r[k], 0);
  const rv = ctx.reviews || { total: 0, new: 0, low: 0, delReq: 0 }, sk = ctx.stock || { selling: 0, soldOut: 0 };
  const todo = [
    { k: "reviewDel", label: "리뷰 삭제 요청 승인·거부", n: rv.delReq, tab: "reviews" },
    { k: "late", label: "발송이 지연된 주문", n: late.length, tab: "orders" },
    { k: "escalated", label: "운영자 확인이 필요한 CS", n: cs.escalated, tab: "cs" },
    { k: "refundFail", label: "환불에 실패한 반품", n: cs.refundFail, tab: "cs" },
    { k: "confirm", label: pm.slice(5) + "월 정산 확정 필요", n: needConfirm ? 1 : 0, tab: "settle" },
    { k: "unpaid", label: "송금 표시가 안 된 정산", n: unpaid, tab: "settle" },
    { k: "noemail", label: "이메일이 없어 알림을 못 받는 브랜드", n: Object.values(rows).filter((r) => r.open && !r.hasEmail).length, tab: "brands" },
    { k: "nocode", label: "접속 코드가 없는 주문 브랜드", n: withOrders.filter((r) => !r.hasCode).length, tab: "brands" },
  ].filter((x) => x.n > 0);
  return {
    today: { sales: sales(today), orders: cnt(today), yestSales: sales(yest), yestOrders: cnt(yest) },
    flow, late: late.slice(0, 20), cs, brands: Object.values(rows).sort((a, b) => b.today - a.today || b.open - a.open),
    reviews: rv, stock: sk, todo, month: { m, sales: sum("sales"), refund: sum("refund"), fee: sum("fee"), payout: sum("payout"), rows: settle.slice(0, 8) },
  };
}

export function partnerHome(os, brand, ctx = {}, now = Date.now()) {
  const tickets = (ctx.tickets || []).filter((t) => t.brand === brand), stock = ctx.stock || [], settles = ctx.settles || [];
  const today = kday(0), mine = os.filter((o) => brandsOf(o).includes(brand));
  const shown = mine.filter((o) => [...LIVE, "canceled"].includes(o.status));
  const live = shown.filter((o) => LIVE.includes(o.status));
  const c = { todo: 0, done: 0, canceled: shown.filter((o) => o.status === "canceled").length, doneToday: 0 };
  let late = 0, oldest = null;
  live.forEach((o) => {
    if (trk(o, brand)) { c.done++; if (dayOf(o.shipments[brand].at) === today) c.doneToday++; return; }
    c.todo++;
    const t = new Date(when(o)).getTime(); if (oldest === null || t < oldest) oldest = t;
    if (now - t > LATE_HOURS * HOUR) late++;
  });
  const days = Array.from({ length: 7 }, (_, i) => kday(6 - i)), per = Object.fromEntries(days.map((d) => [d, 0]));
  live.forEach((o) => { const d = dayOf(when(o)); if (d in per) per[d]++; });
  const m = today.slice(0, 7), top = {};
  mine.filter((o) => LIVE.includes(o.status) && dayOf(when(o)).startsWith(m)).forEach((o) => lines(o, brand).forEach((l) => { top[l.name] = (top[l.name] || 0) + l.q; }));
  const st = monthSettle(os, m, brand)[0] || { sales: 0, refund: 0, fee: 0, payout: 0, feeRate: feeOf(brand), n: 0 };
  const openT = tickets.filter((t) => !["refunded", "closed", "rejected"].includes(t.status));
  const cs = { open: openT.filter((t) => t.status === "open").length, waitingReturn: tickets.filter((t) => t.type === "return" && t.status === "approved").length };
  const alerts = stock.filter((x) => x.soldOut || (x.qty !== null && x.qty !== undefined && x.qty <= LOW_STOCK));
  const paid = settles.filter((x) => x.rows.some((r) => r.brand === brand)).slice(0, 3).map((x) => { const r = x.rows.find((y) => y.brand === brand); return { month: x.month, payout: r.payout, paidAt: (x.paid || {})[brand] || null }; });
  return {
    counts: c, late, oldestHours: oldest === null ? 0 : Math.floor((now - oldest) / HOUR), cs, stock: { total: stock.length, selling: stock.filter((x) => !x.soldOut).length, soldOut: stock.filter((x) => x.soldOut).length, alerts: alerts.slice(0, 6) }, reviews: ctx.reviews || { total: 0, new: 0, low: 0, delReq: 0 },
    week: days.map((d) => ({ d: d.slice(5), n: per[d] })),
    top: Object.keys(top).sort((a, b) => top[b] - top[a]).slice(0, 5).map((n) => ({ name: n, q: top[n] })),
    month: { m, sales: st.sales, refund: st.refund, fee: st.fee, payout: st.payout, feeRate: st.feeRate, n: st.n }, history: paid,
  };
}
