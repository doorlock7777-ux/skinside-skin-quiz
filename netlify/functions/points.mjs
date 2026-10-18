import { json, getUser } from "./_lib.mjs";
import { history, releaseStale } from "./_points.mjs";

/* 내 포인트: 잔액과 최근 내역 (결제하지 않은 주문이 잡고 있는 포인트는 먼저 풀어준다) */
export default async (req) => {
  const user = getUser(req);
  if (!user) return json({ error: "로그인이 필요해요" }, 401);
  if (req.method !== "GET") return json({ error: "method" }, 405);
  await releaseStale(user.id).catch(() => {});
  const h = await history(user.id);
  return json({ balance: h.balance, log: h.log.map((x) => ({ type: x.type, amount: x.applied === undefined ? x.amount : x.amount, note: x.note, at: x.at })) });
};
export const config = { path: "/api/points" };
