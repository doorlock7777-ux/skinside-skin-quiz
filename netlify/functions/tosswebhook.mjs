import { loadBrands } from "./_lib.mjs";
import { json, orders } from "./_lib.mjs";
import { syncOrder } from "./_toss.mjs";

/* 토스 웹훅: 내용을 믿지 않고 주문번호만 받아 토스에 직접 다시 조회해서 맞춘다.
   (토스 개발자센터 > 웹훅에 https://사이트/api/toss-webhook 등록, 이벤트: PAYMENT_STATUS_CHANGED, CANCEL_STATUS_CHANGED) */
export default async (req) => { await loadBrands();
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const b = await req.json().catch(() => ({}));
  const id = String((b.data && b.data.orderId) || b.orderId || "");
  if (!/^SK[0-9A-Z]{6,40}$/.test(id) || !(await orders().get(id, { type: "json" }))) return json({ ok: true });
  const r = await syncOrder(id);
  return r.error ? json({ error: r.error }, 502) : json({ ok: true });
};
export const config = { path: "/api/toss-webhook" };
