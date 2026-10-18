import { getStore } from "@netlify/blobs";
import { BRANDS, mail, esc, kday } from "./_lib.mjs";
import { monthSettle } from "./_home.mjs";
import { getAdj, addAdj, getLast } from "./_adj.mjs";
import { payOf, pointsOf, isSale, refundsOf, hasUnassigned, dayOf, when, SHIP, UNASSIGNED, brandsOf, lines, amt } from "./_money.mjs";

/* 정산 확정(스냅샷)과 송금 완료 표시. {month: {month, confirmedAt, rows, paid:{brand: iso}}} */
export const settleStore = () => getStore({ name: "settlements", consistency: "strong" });
export const getSettlement = (m) => settleStore().get(m, { type: "json" });
const won = (n) => Number(n || 0).toLocaleString("ko-KR");

const nextMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? (y + 1) + "-01" : y + "-" + String(mo + 1).padStart(2, "0"); };

/* 확정 전에 막아야 하는 문제. 하나라도 있으면 확정할 수 없다 */
export function settleBlockers(os, m) {
  const out = [];
  if (!/^\d{4}-\d{2}$/.test(String(m || ""))) out.push("월을 확인해주세요");
  else if (m >= (process.env.SETTLE_TEST_MONTH || kday(0).slice(0, 7))) out.push("아직 끝나지 않은 달이라 확정할 수 없어요 (다음 달부터 확정할 수 있어요)");
  const un = os.reduce((a, o) => a + refundsOf(o).filter((r) => r.brand === UNASSIGNED).length, 0);
  if (un) out.push(`어느 브랜드 몫인지 정해지지 않은 환불 ${un}건이 있어요. 정산 탭에서 지정해주세요`);
  const mm = os.filter((o) => o.mismatch).length;
  if (mm) out.push(`토스 결제액과 금액이 다른 주문 ${mm}건이 있어요. 확인이 필요해요`);
  return out;
}

export async function confirmSettlement(os, m) {
  let s = await getSettlement(m);
  if (s) return { s, created: false };
  const block = settleBlockers(os, m);
  if (block.length) return { error: block[0], blockers: block };
  const adj = await getAdj(m);
  const rows = monthSettle(os, m, undefined, adj);
  /* 환불이 더 커서 지급액이 마이너스인 브랜드는 0으로 두고, 모자란 금액을 다음 달 정산에서 빼도록 이월한다 */
  for (const r of rows) if (r.payout < 0) { r.carried = -r.payout; r.payout = 0; await addAdj(nextMonth(m), r.brand, -r.carried, m + " 정산 이월", true); }
  s = { month: m, confirmedAt: new Date().toISOString(), rows, paid: {} };
  await settleStore().setJSON(m, s);
  /* 브랜드에 정산서 메일 */
  const sent = [];
  for (const r of s.rows) {
    const b = BRANDS[r.brand];
    if (b && b.email) {
      const ok = await mail(b.email, `[스킨인사이드] ${m} 정산서`, `<div style="font-family:sans-serif;max-width:560px;color:#191f28"><p><b>${esc(b.name)}</b> 담당자님, ${esc(m)} 정산 내역입니다.</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:6px 0">판매 금액</td><td style="text-align:right">${won(r.sales)}원</td></tr><tr><td style="padding:6px 0">환불 금액</td><td style="text-align:right">-${won(r.refund)}원</td></tr><tr><td style="padding:6px 0">수수료 (${r.feeRate}%)</td><td style="text-align:right">-${won(r.fee)}원</td></tr>${r.adj ? `<tr><td style="padding:6px 0">조정</td><td style="text-align:right">${r.adj > 0 ? "+" : "-"}${won(Math.abs(r.adj))}원</td></tr>` : ""}${r.carried ? `<tr><td style="padding:6px 0">다음 달로 이월</td><td style="text-align:right">-${won(r.carried)}원</td></tr>` : ""}<tr><td style="padding:6px 0;border-top:1px solid #e5e8eb"><b>지급 예정</b></td><td style="text-align:right;border-top:1px solid #e5e8eb"><b>${won(r.payout)}원</b></td></tr></table><p style="color:#6b7684;font-size:13px">지급이 완료되면 파트너 페이지 정산 탭에 표시돼요.</p></div>`);
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

/* 정산 화면에 띄우는 주의 사항과 토스 대조용 합계 */
export async function settleReport(os, m) {
  const warns = [], last = await getLast();
  const rows = monthSettle(os, m, undefined, await getAdj(m));
  const inM = os.filter((o) => isSale(o) && dayOf(when(o)).startsWith(m));
  const un = os.reduce((a, o) => a + refundsOf(o).filter((r) => r.brand === UNASSIGNED).length, 0);
  if (un) warns.push({ level: "bad", text: `브랜드가 정해지지 않은 환불 ${un}건 — 아래에서 지정해야 정산을 확정할 수 있어요` });
  const mm = os.filter((o) => o.mismatch);
  if (mm.length) warns.push({ level: "bad", text: `토스 결제액과 금액이 다른 주문 ${mm.length}건 (${mm.slice(0, 3).map((o) => o.id).join(", ")})` });
  const bad = inM.filter((o) => o.sub !== undefined && (o.sub !== amt(o.items) || o.total !== o.sub + (o.shipFee || 0) || payOf(o) !== o.total - pointsOf(o)));
  if (bad.length) warns.push({ level: "bad", text: `상품 금액 합계와 결제액이 맞지 않는 주문 ${bad.length}건 (할인·쿠폰 같은 금액이 끼었는지 확인)` });
  for (const r of rows) {
    if (!r.feeRate) warns.push({ level: "warn", text: `${r.name}: 수수료율이 0%예요 (서버 설정 파일 확인)` });
    else if (r.feeRate < 1) warns.push({ level: "warn", text: `${r.name}: 수수료율이 ${r.feeRate}%예요. 15%를 0.15로 적은 건 아닌지 확인하세요 (단위는 %)` });
    if (!(BRANDS[r.brand] && BRANDS[r.brand].email)) warns.push({ level: "warn", text: `${r.name}: 이메일이 없어 정산서가 메일로 가지 않아요` });
    if (r.payout < 0) warns.push({ level: "warn", text: `${r.name}: 환불이 더 커서 지급액이 마이너스예요. 확정하면 다음 달로 이월돼요` });
  }
  const unshipped = inM.filter((o) => o.status !== "canceled" && o.items.some((l) => !(o.shipments && o.shipments[l.brand] && o.shipments[l.brand].tracking))).length;
  if (unshipped) warns.push({ level: "info", text: `이 달 결제 주문 중 아직 발송 전이거나 일부만 발송된 주문 ${unshipped}건이 포함돼 있어요 (결제일 기준 정산)` });
  const age = last ? (Date.now() - new Date(last.at).getTime()) / 36e5 : null;
  if (age === null) warns.push({ level: "warn", text: "토스와 대조한 적이 없어요. 아래 '토스와 대조하기'를 눌러주세요" });
  else if (age > 36) warns.push({ level: "warn", text: `마지막 토스 대조가 ${Math.floor(age)}시간 전이에요` });
  /* 토스 정산서와 맞춰볼 합계: 이 달 결제 총액 - 이 달 환불 총액(배송비, 미지정 포함) */
  const refunds = os.flatMap((o) => refundsOf(o)).filter((r) => dayOf(r.at).startsWith(m));
  /* 토스 정산서와 맞춰볼 합계: 실제 결제액(포인트 제외) - 실제 환불액. 포인트로 낸 몫은 플랫폼이 부담하고 브랜드 정산(판매가 기준)은 그대로다 */
  const cashPaid = inM.reduce((a, o) => a + payOf(o), 0), gross = inM.reduce((a, o) => a + o.total, 0), ship = inM.reduce((a, o) => a + (o.shipFee || 0), 0);
  const rf = (f) => refunds.filter(f).reduce((a, r) => a + r.amount, 0), cashRf = refunds.reduce((a, r) => a + (r.cash !== undefined ? r.cash : r.amount), 0);
  const pointsUsed = inM.reduce((a, o) => a + pointsOf(o), 0), pointsBack = inM.reduce((a, o) => a + (o.pointsReturned || 0), 0);
  const recon = { gross, ship, pointsUsed, pointsBack, cashPaid, refundBrand: rf((r) => r.brand !== SHIP && r.brand !== UNASSIGNED), refundShip: rf((r) => r.brand === SHIP), refundUnassigned: rf((r) => r.brand === UNASSIGNED), cashRefund: cashRf, net: cashPaid - cashRf };
  return { rows, warns, recon, last };
}
