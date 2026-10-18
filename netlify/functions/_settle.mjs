import { getStore } from "@netlify/blobs";
import { BRANDS, mail, esc } from "./_lib.mjs";
import { monthSettle } from "./_home.mjs";

/* 정산 확정(스냅샷)과 송금 완료 표시. {month: {month, confirmedAt, rows, paid:{brand: iso}}} */
export const settleStore = () => getStore({ name: "settlements", consistency: "strong" });
export const getSettlement = (m) => settleStore().get(m, { type: "json" });
const won = (n) => Number(n || 0).toLocaleString("ko-KR");

export async function confirmSettlement(os, m) {
  let s = await getSettlement(m);
  if (s) return { s, created: false };
  s = { month: m, confirmedAt: new Date().toISOString(), rows: monthSettle(os, m), paid: {} };
  await settleStore().setJSON(m, s);
  /* 브랜드에 정산서 메일 */
  const sent = [];
  for (const r of s.rows) {
    const b = BRANDS[r.brand];
    if (b && b.email) {
      const ok = await mail(b.email, `[스킨인사이드] ${m} 정산서`, `<div style="font-family:sans-serif;max-width:560px;color:#191f28"><p><b>${esc(b.name)}</b> 담당자님, ${esc(m)} 정산 내역입니다.</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:6px 0">판매 금액</td><td style="text-align:right">${won(r.sales)}원</td></tr><tr><td style="padding:6px 0">환불 금액</td><td style="text-align:right">-${won(r.refund)}원</td></tr><tr><td style="padding:6px 0">수수료 (${r.feeRate}%)</td><td style="text-align:right">-${won(r.fee)}원</td></tr><tr><td style="padding:6px 0;border-top:1px solid #e5e8eb"><b>지급 예정</b></td><td style="text-align:right;border-top:1px solid #e5e8eb"><b>${won(r.payout)}원</b></td></tr></table><p style="color:#6b7684;font-size:13px">지급이 완료되면 파트너 페이지 정산 탭에 표시돼요.</p></div>`);
      if (ok) sent.push(r.brand);
    }
  }
  s.mailed = sent; await settleStore().setJSON(m, s);
  return { s, created: true };
}
export async function markPaid(m, brand) {
  const s = await getSettlement(m);
  if (!s || !s.rows.some((r) => r.brand === brand)) return null;
  s.paid = s.paid || {}; s.paid[brand] = s.paid[brand] || new Date().toISOString();
  await settleStore().setJSON(m, s); return s;
}
export async function listSettlements() {
  const st = settleStore(); const { blobs } = await st.list();
  return (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean).sort((a, b) => (a.month < b.month ? 1 : -1));
}
