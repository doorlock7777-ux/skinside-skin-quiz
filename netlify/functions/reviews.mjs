import { json, getUser, orders } from "./_lib.mjs";
import { allReviews, createReview, publicList, getReview, imgStore } from "./_reviews.mjs";

/* 소비자용 리뷰: 제품별 목록은 누구나(베스트 먼저, 최신순), 작성은 결제가 끝난 본인 주문(배송 전에도 가능, 500P 적립) */
export default async (req) => {
  const u = new URL(req.url), p = u.pathname.replace(/\/$/, "");
  if (p === "/api/review" && req.method === "GET") {
    const id = String(u.searchParams.get("product") || "");
    if (!id) return json({ error: "제품을 확인해주세요" }, 400);
    return json(publicList(await allReviews(), id), 200, { "cache-control": "public, max-age=30" });
  }
  if (p === "/api/review/img" && req.method === "GET") {
    const id = String(u.searchParams.get("id") || ""), n = Number(u.searchParams.get("n"));
    const r = await getReview(id);
    if (!r || r.status === "deleted" || !(n >= 0 && n < (r.photos || []).length)) return new Response("not found", { status: 404 });
    const f = await imgStore().get(id + "-" + n, { type: "json" });
    if (!f) return new Response("not found", { status: 404 });
    return new Response(Buffer.from(f.d, "base64"), { headers: { "content-type": "image/" + f.t, "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" } });
  }
  const user = getUser(req);
  if (!user) return json({ error: "로그인이 필요해요" }, 401);
  if (p === "/api/review/mine" && req.method === "GET") return json({ done: (await allReviews()).filter((r) => r.userId === user.id).map((r) => r.orderId + "|" + r.productId) });
  if (p === "/api/review/new" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const o = await orders().get(String(b.orderId || ""), { type: "json" });
    const r = await createReview(user, o, String(b.productId || ""), b.rating, b.text, b.photos);
    return r.error ? json({ error: r.error }, 400) : json({ ok: true, points: r.points || 0 });
  }
  return json({ error: "not found" }, 404);
};
export const config = { path: ["/api/review", "/api/review/*"] };
