import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { BRANDS, mail, esc } from "./_lib.mjs";
import { earnReview, clawReview, REVIEW_POINTS } from "./_points.mjs";

/* 리뷰. 브랜드는 리뷰를 직접 지울 수 없고, 악의적인 리뷰는 삭제 요청만 할 수 있다. 관리자가 승인하면 소비자 화면에서 사라진다(기록은 남김). */
export const reviewStore = () => getStore({ name: "reviews", consistency: "strong" });
export const LOW = 2; /* 이 점수 이하가 낮은 평점 */
export const BEST_MAX = 3; /* 제품당 베스트 리뷰 수 */
const clip = (s, n) => String(s ?? "").replace(/\s+$/g, "").slice(0, n);
const mask = (n) => { const s = String(n || "고객").trim(); return s.length <= 1 ? s + "*" : s.length === 2 ? s[0] + "*" : s[0] + "*".repeat(s.length - 2) + s[s.length - 1]; };

export async function allReviews() {
  const st = reviewStore(), { blobs } = await st.list();
  return (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
export const getReview = (id) => reviewStore().get(String(id || ""), { type: "json" });
const save = (r) => reviewStore().setJSON(r.id, r);
const vis = (r) => r.status !== "deleted";

/* 결제가 끝난 본인 주문의 제품에 작성(배송 전에도 가능). 주문+제품당 1개. 작성하면 500P 적립 */
/* 포토리뷰: 사진은 최대 3장, 장당 700KB 이하(화면에서 줄여서 보냄). 형식은 파일 앞부분(매직바이트)까지 확인한다 */
export const imgStore = () => getStore({ name: "reviewimg", consistency: "strong" });
export const MAX_PHOTOS = 3, MAX_PHOTO_BYTES = 700 * 1024;
const MAGIC = { jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, webp: (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" };
export function parsePhotos(arr) {
  const list = Array.isArray(arr) ? arr : [];
  if (list.length > MAX_PHOTOS) return { error: `사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요` };
  const out = [];
  for (const d of list) {
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ""));
    if (!m) return { error: "사진 형식을 확인해주세요 (JPG, PNG, WEBP)" };
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > MAX_PHOTO_BYTES) return { error: "사진 한 장이 너무 커요. 다시 선택해주세요" };
    if (!MAGIC[m[1]](buf)) return { error: "사진 파일이 올바르지 않아요" };
    out.push({ t: m[1], d: m[2] });
  }
  return { files: out };
}

export async function createReview(user, o, productId, rating, text, photos) {
  const line = o && o.userId === user.id ? o.items.find((l) => l.id === productId) : null;
  if (!line) return { error: "주문한 제품이 아니에요" };
  if (!["paid", "partial", "shipped"].includes(o.status)) return { error: "취소된 주문에는 리뷰를 쓸 수 없어요" };
  const n = Math.round(Number(rating));
  if (!(n >= 1 && n <= 5)) return { error: "별점을 선택해주세요" };
  const t = clip(text, 500).trim();
  if (t.length < 5) return { error: "리뷰는 5자 이상 적어주세요" };
  const ph = parsePhotos(photos); if (ph.error) return { error: ph.error };
  if ((await allReviews()).some((x) => x.orderId === o.id && x.productId === productId)) return { error: "이미 리뷰를 작성했어요" };
  const r = { id: "R" + Date.now().toString(36).toUpperCase() + randomBytes(2).toString("hex").toUpperCase(), productId, productName: line.name, brand: line.brand, orderId: o.id, userId: user.id, userName: mask(o.userName || user.name), rating: n, text: t, photos: [], createdAt: new Date().toISOString(), status: "visible", best: false, read: { brand: false, admin: false }, delReq: null };
  for (let i = 0; i < ph.files.length; i++) { await imgStore().setJSON(r.id + "-" + i, ph.files[i]); r.photos.push(`/api/review/img?id=${r.id}&n=${i}`); }
  await save(r);
  const pt = await earnReview(user.id, o.id, productId).catch(() => null);
  const b = BRANDS[r.brand];
  if (n <= LOW && b && b.email) await mail(b.email, `[스킨인사이드] 낮은 평점 리뷰가 등록됐어요 (${n}점)`, `<p>${esc(r.productName)}에 ${n}점 리뷰가 등록됐어요.</p><p style="padding:12px;background:#f2f4f6;border-radius:8px">${esc(r.text)}</p><p>파트너 페이지의 리뷰 메뉴에서 확인하고, 악의적인 내용이면 삭제 요청을 할 수 있어요.</p>`);
  return { review: r, points: pt && pt.done ? REVIEW_POINTS : 0 };
}

/* 소비자에게 보이는 목록: 베스트(최신순) 먼저, 그 다음 최신순 */
export function publicList(all, productId) {
  const l = all.filter((r) => r.productId === productId && vis(r));
  const strip = (r) => ({ id: r.id, rating: r.rating, text: r.text, photos: r.photos || [], userName: r.userName, createdAt: r.createdAt, best: !!r.best });
  const best = l.filter((r) => r.best), rest = l.filter((r) => !r.best);
  const cnt = l.length, avg = cnt ? Math.round((l.reduce((a, r) => a + r.rating, 0) / cnt) * 10) / 10 : 0;
  return { count: cnt, avg, reviews: best.concat(rest).map(strip) };
}

export function summary(all, brand) {
  const l = all.filter((r) => vis(r) && (!brand || r.brand === brand)), who = brand ? "brand" : "admin";
  return { total: l.length, new: l.filter((r) => !r.read[who]).length, low: l.filter((r) => r.rating <= LOW).length, delReq: l.filter((r) => r.delReq && r.delReq.status === "pending").length };
}
/* 브랜드/관리자 화면용 (작성자 식별 정보는 이름 마스킹만) */
export function manageView(all, brand) {
  const who = brand ? "brand" : "admin";
  const list = all.filter((r) => vis(r) && (!brand || r.brand === brand)).map((r) => ({ id: r.id, productId: r.productId, productName: r.productName, brand: r.brand, brandName: (BRANDS[r.brand] || {}).name || r.brand, orderId: r.orderId, userName: r.userName, rating: r.rating, text: r.text, photos: r.photos || [], createdAt: r.createdAt, best: !!r.best, isNew: !r.read[who], low: r.rating <= LOW, delReq: r.delReq }));
  return { counts: summary(all, brand), reviews: list };
}
export async function markRead(all, who, ids, brand) {
  const set = ids === "all" ? null : new Set(Array.isArray(ids) ? ids : []);
  let n = 0;
  for (const r of all) if (vis(r) && (!brand || r.brand === brand) && (!set || set.has(r.id)) && !r.read[who]) { r.read[who] = true; await save(r); n++; }
  return n;
}
export async function setBest(r, on) {
  if (!vis(r)) return { error: "삭제된 리뷰예요" };
  if (on) {
    if (r.rating < 4) return { error: "별점 4점 이상 리뷰만 베스트로 고를 수 있어요" };
    const cnt = (await allReviews()).filter((x) => x.productId === r.productId && vis(x) && x.best && x.id !== r.id).length;
    if (cnt >= BEST_MAX) return { error: `베스트 리뷰는 제품당 ${BEST_MAX}개까지예요. 다른 리뷰를 해제한 뒤 선택해주세요` };
  }
  r.best = !!on; await save(r); return { review: r };
}
export async function requestDelete(r, reason) {
  if (!vis(r)) return { error: "이미 삭제된 리뷰예요" };
  const t = clip(reason, 300).trim();
  if (t.length < 5) return { error: "삭제 요청 사유를 5자 이상 적어주세요" };
  if (r.delReq) return { error: r.delReq.status === "pending" ? "이미 삭제를 요청했어요" : "이미 처리된 요청이에요. 다시 요청할 수 없어요" };
  r.delReq = { at: new Date().toISOString(), reason: t, status: "pending" }; r.read.admin = false; await save(r);
  if (process.env.NOTIFY_EMAIL) await mail(process.env.NOTIFY_EMAIL, `[스킨인사이드] 리뷰 삭제 요청 (${(BRANDS[r.brand] || {}).name || r.brand})`, `<p>${esc(r.productName)} ${r.rating}점 리뷰에 삭제 요청이 들어왔어요.</p><p>${esc(r.text)}</p><p><b>사유</b> ${esc(t)}</p><p>관리자 페이지 리뷰 메뉴에서 승인 또는 거부해주세요.</p>`);
  return { review: r };
}
/* 관리자: approve(삭제 요청 승인) / reject(거부) / delete(직접 삭제) */
export async function decide(r, action) {
  if (!vis(r)) return { error: "이미 삭제된 리뷰예요" };
  const now = new Date().toISOString();
  if (action === "approve" || action === "reject") {
    if (!r.delReq || r.delReq.status !== "pending") return { error: "처리할 삭제 요청이 없어요" };
    r.delReq.status = action === "approve" ? "approved" : "rejected"; r.delReq.decidedAt = now;
    if (action === "approve") { r.status = "deleted"; r.best = false; r.deletedAt = now; }
  } else if (action === "delete") { r.status = "deleted"; r.best = false; r.deletedAt = now; }
  else return { error: "처리를 선택해주세요" };
  await save(r);
  if (r.status === "deleted") await clawReview(r.userId, r.orderId, r.productId, "삭제된 리뷰").catch(() => {});
  const b = BRANDS[r.brand];
  if (r.delReq && r.delReq.status && b && b.email) await mail(b.email, `[스킨인사이드] 리뷰 삭제 요청이 ${r.delReq.status === "approved" ? "승인" : "거부"}됐어요`, `<p>${esc(r.productName)} 리뷰 삭제 요청이 ${r.delReq.status === "approved" ? "승인되어 삭제됐어요" : "거부됐어요"}.</p>`);
  return { review: r };
}

/* 주문이 취소되면 그 주문의 리뷰를 숨기고 적립한 포인트를 회수한다 */
export async function voidOrderReviews(orderId) {
  let n = 0;
  for (const r of (await allReviews()).filter((x) => x.orderId === orderId && vis(x))) {
    r.status = "deleted"; r.best = false; r.deletedAt = new Date().toISOString(); r.deletedReason = "주문 취소"; await save(r);
    await clawReview(r.userId, r.orderId, r.productId, "주문 취소").catch(() => {}); n++;
  }
  return n;
}
