import { BRANDS } from "./_lib.mjs";

/* 브랜드별 부가가치세 신고용 매출 자료. 기준: 결제 완료일(취소·환불은 환불한 달에서 차감), 금액은 부가세 포함 */
const LIVE = ["paid", "partial", "shipped"];
const dayOf = (iso) => new Date(new Date(iso).getTime() + 9 * 36e5).toISOString().slice(0, 10);
const when = (o) => o.paidAt || o.createdAt;
const lines = (o, b) => o.items.filter((l) => l.brand === b);
const amt = (ls) => ls.reduce((a, l) => a + l.unit * l.q, 0);
/* 카드·간편결제(네이버페이 등)는 신용카드 매출, 그 외(계좌이체 등)는 기타 */
const isCard = (m) => /카드|간편|페이|pay/i.test(String(m || "")) || !m;

export const monthsBetween = (from, to) => {
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to) || from > to) return null;
  const out = []; let [y, m] = from.split("-").map(Number);
  while ((y + "-" + String(m).padStart(2, "0")) <= to && out.length < 13) { out.push(y + "-" + String(m).padStart(2, "0")); m++; if (m > 12) { m = 1; y++; } }
  return out.length > 12 ? null : out;
};

/* 거래 내역(건별): 판매 + 환불을 한 줄씩 */
export function txns(os, brand, month) {
  const t = [];
  os.filter((o) => LIVE.includes(o.status) && lines(o, brand).length && dayOf(when(o)).startsWith(month)).forEach((o) => {
    const ls = lines(o, brand);
    t.push({ at: when(o), day: dayOf(when(o)), orderId: o.id, kind: "판매", items: ls.map((l) => l.name + (l.optName ? " (" + l.optName + ")" : "")).join(" / "), q: ls.reduce((a, l) => a + l.q, 0), amount: amt(ls), method: o.method || "", card: isCard(o.method) });
  });
  os.forEach((o) => (o.refunds || []).forEach((r) => { if (r.brand === brand && dayOf(r.at).startsWith(month)) t.push({ at: r.at, day: dayOf(r.at), orderId: o.id, kind: "환불", items: lines(o, brand).map((l) => l.name).join(" / "), q: 0, amount: -r.amount, method: o.method || "", card: isCard(o.method) }); }));
  return t.sort((a, b) => (a.at < b.at ? -1 : 1));
}
const sum = (t) => {
  const card = t.filter((x) => x.card).reduce((a, x) => a + x.amount, 0), other = t.filter((x) => !x.card).reduce((a, x) => a + x.amount, 0), net = card + other;
  const supply = Math.round(net / 1.1);
  return { orders: t.filter((x) => x.kind === "판매").length, gross: t.filter((x) => x.kind === "판매").reduce((a, x) => a + x.amount, 0), refund: -t.filter((x) => x.kind === "환불").reduce((a, x) => a + x.amount, 0), net, exempt: 0, card, other, supply, vat: net - supply };
};
export function vatMonths(os, brand, months) {
  const rows = months.map((m) => ({ month: m, ...sum(txns(os, brand, m)) }));
  const total = { month: "합계", ...["orders", "gross", "refund", "net", "exempt", "card", "other", "supply", "vat"].reduce((o, k) => ((o[k] = rows.reduce((a, r) => a + r[k], 0)), o), {}) };
  return { rows, total };
}
export function vatDays(os, brand, month) {
  const t = txns(os, brand, month), days = [...new Set(t.map((x) => x.day))].sort();
  return days.map((d) => ({ day: d, ...sum(t.filter((x) => x.day === d)) }));
}

const q = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const csv = (head, rows) => "﻿" + [head].concat(rows).map((r) => r.map(q).join(",")).join("\r\n");
const HEAD = ["과세매출액(부가세 포함)", "면세매출액", "신용카드·간편결제 매출", "기타(계좌이체 등)", "공급가액", "부가세"];
export const monthsCsv = (v, brand) => csv(["부가세 신고기간", "주문 건수", "총 판매금액", "환불금액", ...HEAD], v.rows.concat([v.total]).map((r) => [r.month, r.orders, r.gross, r.refund, r.net, r.exempt, r.card, r.other, r.supply, r.vat]));
export const daysCsv = (days) => csv(["일자", "주문 건수", "총 판매금액", "환불금액", ...HEAD], days.map((r) => [r.day, r.orders, r.gross, r.refund, r.net, r.exempt, r.card, r.other, r.supply, r.vat]));
export const ordersCsv = (t) => csv(["일시(KST)", "구분", "주문번호", "상품", "수량", "금액(환불은 음수)", "결제수단", "공급가액", "부가세"], t.map((x) => { const s = Math.round(x.amount / 1.1); return [new Date(new Date(x.at).getTime() + 9 * 36e5).toISOString().slice(0, 19).replace("T", " "), x.kind, x.orderId, x.items, x.q, x.amount, x.method || "", s, x.amount - s]; }));
