import { json, getUser, orders } from "./_lib.mjs";
import { allReviews, createReview, publicList } from "./_reviews.mjs";

/* 소비자용 리뷰: 제품별 목록은 누구나(베스트 먼저, 최신순), 작성은 배송이 시작된 본인 주문만 */
export default async (req) => {
  const u = new URL(req.url), p = u.pathname.replace(/\/$/, "");
  if (p === "/api/review" && req.method === "GET") {
    const id = String(u.searchParams.get("product") || "");
    if (!id) return json({ error: "제품을 확인해주세요" }, 400);
    return json(publicList(await allReviews(), id), 200, { "cache-control": "public, max-age=30" });
  }
  const user = getUser(req);
  if (!user) return json({ error: "로그인이 필요해요" }, 401);
  if (p === "/api/review/mine" && req.method === "GET") return json({ done: (await allReviews()).filter((r) => r.userId === user.id).map((r) => r.orderId + "|" + r.productId) });
  if (p === "/api/review/new" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const o = await orders().get(String(b.orderId || ""), { type: "json" });
    const r = await createReview(user, o, String(b.productId || ""), b.rating, b.text);
    return r.error ? json({ error: r.error }, 400) : json({ ok: true });
  }
  return json({ error: "not found" }, 404);
};
export const config = { path: ["/api/review", "/api/review/*"] };
