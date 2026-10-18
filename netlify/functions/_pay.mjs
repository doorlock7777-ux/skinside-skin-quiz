import { orders, mail, esc, addStat, adjustStock } from "./_lib.mjs";
import { notifyNewOrder } from "./_batch.mjs";

/* 주문이 결제되면 운영자와 해당 브랜드에 바로 알린다 */
async function notify(o) {
  const rows = o.items.map((l) => `<li>${esc(l.name)} ${l.optName ? "(" + esc(l.optName) + ")" : ""} x ${l.q}</li>`).join("");
  if (process.env.NOTIFY_EMAIL) await mail(process.env.NOTIFY_EMAIL, `[주문] ${o.id} ${o.total}원`, `<p>주문번호 <b>${esc(o.id)}</b></p><ul>${rows}</ul><p>브랜드에는 바로 알림이 갔어요.</p>`);
  return {};
}

/* 결제 완료 뒤 처리(통계, 재고, 알림). 주문마다 한 번만 실행한다 */
export async function finalizePaid(o) {
  const st = orders();
  const fresh = await st.get(o.id, { type: "json" });
  if (fresh && fresh.finalized) return false;
  o.finalized = new Date().toISOString();
  await st.setJSON(o.id, o);
  try { await addStat(o.items.map((l) => [l.id, "b", l.q])); } catch {}
  try { await adjustStock(o.items.map((l) => [l.id, -l.q])); } catch {}
  try { await notifyNewOrder(o); await st.setJSON(o.id, o); } catch {}
  try { o.notified = await notify(o); await st.setJSON(o.id, o); } catch {}
  return true;
}
