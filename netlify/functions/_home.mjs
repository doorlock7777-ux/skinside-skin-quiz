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

/* 한 주문의 브랜드별 상태: new(브랜드 전달 전) / wait(발송 대기) / done(발송 완료) */
function parcelState(o, b) { return trk(o, b) ? "done" : (o.sent || {})[b] ? "wait" : "new"; }

export function monthSettle(os, m, only) {
  const agg = {};
  os.filter((o) => LIVE.includes(o.status) && dayOf(when(o)).startsWith(m)).forEach((o) => brandsOf(o).forEach((b) => {
    if (only && b !== only) return;
    const a = (agg[b] = agg[b] || { sales: 0, n: 0 });
    a.sales += amt(lines(o, b)); a.n += lines(o, b).reduce((x, l) => x + l.q, 0);
  }));
  return Object.keys(agg).map((b) => {
    const fee = Math.round((agg[b].sales * feeOf(b)) / 100);
    return { brand: b, name: (BRANDS[b] && BRANDS[b].name) || b, n: agg[b].n, sales: agg[b].sales, feeRate: feeOf(b), fee, payout: agg[b].sales - fee };
  }).sort((x, y) => y.sales - x.sales);
}

export function adminHome(os, idx = {}, now = Date.now()) {
  const today = kday(0), yest = kday(1), live = os.filter((o) => LIVE.includes(o.status));
  const sales = (d) => live.filter((o) => dayOf(when(o)) === d).reduce((a, o) => a + (o.total || 0), 0);
  const cnt = (d) => live.filter((o) => dayOf(when(o)) === d).length;
  const flow = { new: 0, wait: 0, done: 0, canceled: os.filter((o) => o.status === "canceled").length };
  const late = [], rows = {};
  Object.keys(BRANDS).forEach((b) => (rows[b] = { brand: b, name: BRANDS[b].name, today: 0, open: 0, late: 0, hasCode: !!idx[b], lastLogin: (idx[b] && idx[b].lastLogin) || null, hasEmail: !!BRANDS[b].email }));
  live.forEach((o) => brandsOf(o).forEach((b) => {
    const r = rows[b] || (rows[b] = { brand: b, name: b, today: 0, open: 0, late: 0, hasCode: false, hasEmail: false });
    const s = parcelState(o, b); flow[s]++;
    if (dayOf(when(o)) === today) r.today++;
    if (s !== "done") {
      r.open++;
      const since = s === "wait" ? new Date(o.sent[b]).getTime() : new Date(when(o)).getTime();
      const lim = s === "wait" ? LATE_HOURS : LATE_HOURS + 12;
      if (now - since > lim * HOUR) { r.late++; late.push({ id: o.id, brand: b, name: r.name, hours: Math.floor((now - since) / HOUR), state: s }); }
    }
  }));
  const withOrders = Object.values(rows).filter((r) => r.open || r.today);
  const todo = [
    { k: "late", label: "발송이 지연된 주문", n: late.length, tab: "orders" },
    { k: "noemail", label: "이메일이 없어 전달 못 한 브랜드", n: Object.values(rows).filter((r) => r.open && !r.hasEmail).length, tab: "brands" },
    { k: "nocode", label: "접속 코드가 없는 주문 브랜드", n: withOrders.filter((r) => !r.hasCode).length, tab: "brands" },
  ].filter((x) => x.n > 0);
  const m = today.slice(0, 7), settle = monthSettle(os, m);
  const sum = (k) => settle.reduce((a, r) => a + r[k], 0);
  return {
    today: { sales: sales(today), orders: cnt(today), yestSales: sales(yest), yestOrders: cnt(yest) },
    flow, late: late.slice(0, 20), brands: Object.values(rows).sort((a, b) => b.today - a.today || b.open - a.open),
    todo, month: { m, sales: sum("sales"), fee: sum("fee"), payout: sum("payout"), rows: settle.slice(0, 8) },
  };
}

export function partnerHome(os, brand, now = Date.now()) {
  const today = kday(0), mine = os.filter((o) => brandsOf(o).includes(brand));
  const shown = mine.filter((o) => (o.sent || {})[brand] && [...LIVE, "canceled"].includes(o.status));
  const live = shown.filter((o) => LIVE.includes(o.status));
  const c = { todo: 0, done: 0, canceled: shown.filter((o) => o.status === "canceled").length, doneToday: 0 };
  let late = 0, oldest = null;
  live.forEach((o) => {
    if (trk(o, brand)) { c.done++; if (dayOf(o.shipments[brand].at) === today) c.doneToday++; return; }
    c.todo++;
    const t = new Date(o.sent[brand]).getTime(); if (oldest === null || t < oldest) oldest = t;
    if (now - t > LATE_HOURS * HOUR) late++;
  });
  const days = Array.from({ length: 7 }, (_, i) => kday(6 - i)), per = Object.fromEntries(days.map((d) => [d, 0]));
  live.forEach((o) => { const d = dayOf(when(o)); if (d in per) per[d]++; });
  const m = today.slice(0, 7), top = {};
  mine.filter((o) => LIVE.includes(o.status) && dayOf(when(o)).startsWith(m)).forEach((o) => lines(o, brand).forEach((l) => { top[l.name] = (top[l.name] || 0) + l.q; }));
  const st = monthSettle(os, m, brand)[0] || { sales: 0, fee: 0, payout: 0, feeRate: feeOf(brand), n: 0 };
  return {
    counts: c, late, oldestHours: oldest === null ? 0 : Math.floor((now - oldest) / HOUR),
    week: days.map((d) => ({ d: d.slice(5), n: per[d] })),
    top: Object.keys(top).sort((a, b) => top[b] - top[a]).slice(0, 5).map((n) => ({ name: n, q: top[n] })),
    month: { m, sales: st.sales, fee: st.fee, payout: st.payout, feeRate: st.feeRate, n: st.n },
  };
}
