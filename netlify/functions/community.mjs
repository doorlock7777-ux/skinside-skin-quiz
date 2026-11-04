import { loadBrands, json, getUser, loadProducts } from "./_lib.mjs";
import { allReviews } from "./_reviews.mjs";
import { feedPage, toggleLike, listComments, addComment, deleteComment, report } from "./_community.mjs";

/* 후기 피드(로그인한 회원만): 글 중심 목록 + 좋아요·댓글·신고. 구매하기 버튼은 화면에서 제품 상세로 후기 번호를 들고 간다 */
export default async (req) => { await loadBrands();
  const user = getUser(req);
  if (!user) return json({ error: "로그인이 필요해요" }, 401);
  const u = new URL(req.url), p = u.pathname.replace(/\/$/, "");
  if (p === "/api/feed" && req.method === "GET") {
    const { map } = await loadProducts(req);
    return json(await feedPage(await allReviews(), { page: Math.max(1, Math.floor(Number(u.searchParams.get("page")) || 1)), size: 10, me: user.id, productsMap: map, product: String(u.searchParams.get("product") || ""), only: String(u.searchParams.get("id") || "") }));
  }
  if (p === "/api/feed/comments" && req.method === "GET") { const r = await listComments(String(u.searchParams.get("id") || ""), user.id); return r.error ? json(r, 404) : json(r); }
  if (req.method !== "POST") return json({ error: "not found" }, 404);
  const b = await req.json().catch(() => ({})), id = String(b.id || "");
  let r;
  if (p === "/api/feed/like") r = await toggleLike(id, user.id);
  else if (p === "/api/feed/comment") r = await addComment(id, user, b.text);
  else if (p === "/api/feed/comment/delete") r = await deleteComment(id, String(b.cid || ""), user.id, false);
  else if (p === "/api/feed/report") r = await report(id, String(b.cid || ""), user.id, b.reason);
  else return json({ error: "not found" }, 404);
  return r.error ? json(r, 400) : json(r);
};
export const config = { path: ["/api/feed", "/api/feed/*"] };
