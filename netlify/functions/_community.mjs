import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { settings, orders } from "./_lib.mjs";
import { apply } from "./_points.mjs";
import { allReviews, getReview, mask } from "./_reviews.mjs";

/* 후기 커뮤니티: 피드(좋아요·댓글·신고), 후기를 보고 구매하면 작성자에게 포인트(구매확정 후), 성실리뷰어 뱃지(관리자 승인)면 적립률이 더 높다.
   적립 흐름: 구매하기(후기 번호를 들고 감) -> 주문에 기록 -> 결제 완료 시 "구매확정 예정"으로 등록 -> 구매확정(고객 또는 자동) 시 포인트 지급 -> 취소·환불되면 예정 소멸, 이미 준 것은 회수 */
export const DEFAULTS = { base: 3, badge: 5, cap: 30000, autoDays: 10, needReviews: 10, needPhotos: 5 };
const KST = 9 * 36e5;
export const monthOf = (iso) => new Date(new Date(iso).getTime() + KST).toISOString().slice(0, 7);

const reactStore = () => getStore({ name: "react", consistency: "strong" });
const refStore = () => getStore({ name: "refs", consistency: "strong" });
const miscStore = () => getStore({ name: "commmisc", consistency: "strong" });
const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function loadCfg() {
  const c = (await settings().get("community", { type: "json" })) || {};
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (Number.isFinite(Number(c[k])) && c[k] !== "" && c[k] !== null) out[k] = Number(c[k]);
  return out;
}
export async function saveCfg(b) {
  const lim = { base: [0, 30], badge: [0, 30], cap: [0, 1e7], autoDays: [1, 60], needReviews: [0, 1000], needPhotos: [0, 1000] }, c = {};
  for (const k of Object.keys(lim)) {
    const v = Number(b[k]);
    if (!Number.isFinite(v) || v < lim[k][0] || v > lim[k][1]) return { error: "설정 값을 확인해주세요 (" + k + ")" };
    c[k] = Math.round(v * 100) / 100;
  }
  if (c.badge < c.base) return { error: "뱃지 적립률은 기본 적립률보다 낮을 수 없어요" };
  await settings().setJSON("community", c); return { cfg: c };
}

/* ---------- 뱃지 ---------- */
const badgeDoc = async () => (await miscStore().get("badges", { type: "json" })) || {};
export const hasBadge = async (uid) => !!(await badgeDoc())[uid];
export async function setBadge(uid, on, name) {
  const d = await badgeDoc(); uid = String(uid || "");
  if (!uid) return { error: "회원을 확인해주세요" };
  if (on) d[uid] = { at: new Date().toISOString(), name: String(name || "") }; else delete d[uid];
  await miscStore().setJSON("badges", d); return { ok: true };
}
export async function rateFor(uid, cfg) { cfg = cfg || (await loadCfg()); return (await hasBadge(uid)) ? cfg.badge : cfg.base; }

/* ---------- 피드 ---------- */
const getReact = async (rid) => (await reactStore().get("r-" + rid, { type: "json" })) || { likes: [], comments: [] };
const vis = (r) => r && r.status !== "deleted";
/* 반응 집계(좋아요 수, 구매하기 누른 사람 수): 후기 순서를 정할 때 후기마다 읽지 않으려고 한 문서에 모은다 */
const getIdx = async () => (await reactStore().get("idx", { type: "json" })) || {};
async function bump(rid, key, n) { const d = await getIdx(); d[rid] = d[rid] || { l: 0, b: 0 }; d[rid][key] = Math.max(0, (d[rid][key] || 0) + n); await reactStore().setJSON("idx", d); }
export async function recordBuy(rid, uid) {
  const r = await getReview(rid); if (!vis(r)) return { error: "삭제된 후기예요" };
  const x = await getReact(rid); x.buyers = x.buyers || [];
  if (x.buyers.includes(uid) || r.userId === uid) return { ok: true, counted: false };
  x.buyers.push(uid); await reactStore().setJSON("r-" + rid, x); await bump(rid, "b", 1); return { ok: true, counted: true };
}
/* 후기 노출 순서. 별 5개 후기를 먼저 보여주되 다섯 갈래 줄에서 번갈아 한 개씩 꺼내 섞는다.
   1) 내가 최근에 본 제품의 후기  2) 좋아요 많은 후기  3) 구매하기 많이 받은 후기  4) 최신 후기  5) 별점 높은 후기
   한 제품이 몰리지 않게(최근 6개 중 2개까지), 같은 사람 글이 연달아 나오지 않게 건너뛴다. */
const PATTERN = [1, 2, 1, 3, 1, 4, 2, 1, 3, 5], PATTERN0 = [2, 3, 4, 2, 3, 5, 2, 4, 3, 5]; /* 최근 본 제품이 없으면 1번 줄 자리를 나머지로 채운다 */
export function rankFeed(list, idx, recent) {
  const rec = Array.isArray(recent) ? recent.filter(Boolean).slice(0, 5) : [];
  const L = (r) => (idx[r.id] || {}).l || 0, B = (r) => (idx[r.id] || {}).b || 0, T = (r) => new Date(r.createdAt).getTime() || 0;
  const tier = (r) => (r.rating >= 5 ? 0 : r.rating === 4 ? 1 : 2);
  const by = (...f) => (a, b) => { for (const g of f) { const d = g(a, b); if (d) return d; } return 0; };
  const star = (a, b) => tier(a) - tier(b), likes = (a, b) => L(b) - L(a), buys = (a, b) => B(b) - B(a), fresh = (a, b) => T(b) - T(a);
  const q = {
    1: list.filter((r) => rec.includes(r.productId)).sort(by((a, b) => rec.indexOf(a.productId) - rec.indexOf(b.productId), star, likes, buys, fresh)),
    2: [...list].sort(by(star, likes, buys, fresh)),
    3: [...list].sort(by(star, buys, likes, fresh)),
    4: [...list].sort(by(star, fresh, likes)),
    5: [...list].sort(by((a, b) => b.rating - a.rating, likes, fresh)),
  };
  const out = [], used = new Set(), order = (k) => [k, 2, 3, 4, 5, 1].filter((v, i, a) => a.indexOf(v) === i);
  const okNext = (r) => {
    const last = out[out.length - 1];
    if (last && last.userId === r.userId) return false;
    return out.slice(-6).filter((o) => o.productId === r.productId).length < 2;
  };
  const pick = (k, strict) => { for (const r of q[k]) if (!used.has(r.id) && (!strict || okNext(r))) return r; return null; };
  for (let i = 0; out.length < list.length; i++) {
    const want = (rec.length ? PATTERN : PATTERN0)[i % PATTERN.length];
    let r = null;
    for (const strict of [true, false]) { for (const k of order(want)) { r = pick(k, strict); if (r) break; } if (r) break; }
    if (!r) break;
    used.add(r.id); out.push(r);
  }
  return out;
}
export async function feedPage(all, { page = 1, size = 10, me, productsMap, product, only, recent }) {
  let l = all.filter((r) => vis(r) && (!product || r.productId === product) && (!only || r.id === only));
  if (!only) l = rankFeed(l, await getIdx(), recent);
  const total = l.length, from = (Math.max(1, page) - 1) * size;
  l = l.slice(from, from + size);
  const badges = await badgeDoc();
  const rx = await Promise.all(l.map((r) => getReact(r.id)));
  return { total, page, hasMore: from + size < total, items: l.map((r, i) => {
    const p = (productsMap || {})[r.productId] || {}, x = rx[i];
    return { id: r.id, productId: r.productId, productName: r.productName, brandName: p.brandName || r.brand, img: p.img || "", price: p.price || 0, soldOut: !!p.soldOut, rating: r.rating, text: r.text, photos: r.photos || [], userName: r.userName, badge: !!badges[r.userId], best: !!r.best, createdAt: r.createdAt, likes: x.likes.length, liked: !!me && x.likes.includes(me), comments: x.comments.filter((c) => !c.del).length, mine: !!me && r.userId === me };
  }) };
}
export async function toggleLike(rid, uid) {
  const r = await getReview(rid); if (!vis(r)) return { error: "삭제된 후기예요" };
  const x = await getReact(rid), i = x.likes.indexOf(uid);
  if (i >= 0) x.likes.splice(i, 1); else x.likes.push(uid);
  await reactStore().setJSON("r-" + rid, x); await bump(rid, "l", i < 0 ? 1 : -1); return { liked: i < 0, likes: x.likes.length };
}
export async function listComments(rid, me) {
  const r = await getReview(rid); if (!vis(r)) return { error: "삭제된 후기예요" };
  const badges = await badgeDoc(), x = await getReact(rid);
  return { comments: x.comments.filter((c) => !c.del).slice(-100).map((c) => ({ id: c.id, name: c.name, badge: !!badges[c.uid], text: c.text, at: c.at, mine: !!me && c.uid === me })) };
}
export async function addComment(rid, user, text) {
  const r = await getReview(rid); if (!vis(r)) return { error: "삭제된 후기예요" };
  const t = clip(text, 200); if (t.length < 1) return { error: "댓글을 입력해주세요" };
  const now = Date.now(), day = new Date(now + KST).toISOString().slice(0, 10), rk = "cr-" + user.id + "-" + day;
  const used = (await miscStore().get(rk, { type: "json" })) || 0;
  if (used >= 50) return { error: "오늘은 댓글을 더 달 수 없어요" };
  const x = await getReact(rid);
  if (x.comments.filter((c) => c.uid === user.id && now - new Date(c.at).getTime() < 60e3).length >= 3) return { error: "댓글을 너무 빠르게 달고 있어요. 잠시 뒤에 다시 해주세요" };
  if (x.comments.some((c) => c.uid === user.id && !c.del && c.text === t && now - new Date(c.at).getTime() < 600e3)) return { error: "같은 댓글을 이미 달았어요" };
  const c = { id: "C" + now.toString(36) + randomBytes(2).toString("hex"), uid: user.id, name: mask(user.name), text: t, at: new Date(now).toISOString() };
  x.comments.push(c); x.comments = x.comments.slice(-300);
  await reactStore().setJSON("r-" + rid, x); await miscStore().setJSON(rk, used + 1);
  return { comment: { id: c.id, name: c.name, text: c.text, at: c.at, mine: true } };
}
export async function deleteComment(rid, cid, uid, admin) {
  const x = await getReact(rid), c = x.comments.find((y) => y.id === cid && !y.del);
  if (!c || (!admin && c.uid !== uid)) return { error: "삭제할 수 없어요" };
  c.del = true; await reactStore().setJSON("r-" + rid, x); return { ok: true };
}
export async function report(rid, cid, uid, reason) {
  const r = await getReview(rid); if (!vis(r)) return { error: "삭제된 후기예요" };
  const t = clip(reason, 100); if (t.length < 2) return { error: "신고 사유를 적어주세요" };
  const d = (await miscStore().get("reports", { type: "json" })) || [];
  if (d.some((x) => x.uid === uid && x.rid === rid && (x.cid || "") === (cid || "") && x.status === "open")) return { error: "이미 신고했어요" };
  d.push({ id: "P" + Date.now().toString(36) + randomBytes(2).toString("hex"), rid, cid: cid || "", uid, reason: t, at: new Date().toISOString(), status: "open" });
  await miscStore().setJSON("reports", d.slice(-500)); return { ok: true };
}
export async function reportList() {
  const d = ((await miscStore().get("reports", { type: "json" })) || []).filter((x) => x.status === "open");
  return Promise.all(d.slice(-100).reverse().map(async (x) => {
    const r = await getReview(x.rid), rx = await getReact(x.rid), c = x.cid ? rx.comments.find((y) => y.id === x.cid) : null;
    return { id: x.id, rid: x.rid, cid: x.cid, reason: x.reason, at: x.at, target: x.cid ? "댓글" : "후기", text: (c ? c.text : r && r.text) || "", gone: x.cid ? !c || !!c.del : !vis(r), name: c ? c.name : r ? r.userName : "" };
  }));
}
export async function resolveReport(id, action) {
  const d = (await miscStore().get("reports", { type: "json" })) || [], x = d.find((y) => y.id === id && y.status === "open");
  if (!x) return { error: "처리할 신고가 없어요" };
  if (action === "delete") {
    if (x.cid) await deleteComment(x.rid, x.cid, "", true);
    else { const { decide } = await import("./_reviews.mjs"), r = await getReview(x.rid); if (vis(r)) await decide(r, "delete"); }
  } else if (action !== "dismiss") return { error: "처리를 선택해주세요" };
  for (const y of d) if (y.status === "open" && y.rid === x.rid && (y.cid || "") === (x.cid || "")) y.status = action === "delete" ? "deleted" : "dismissed";
  await miscStore().setJSON("reports", d); return { ok: true };
}

/* ---------- 구매 연결 적립 ---------- */
const refsOf = async (uid) => (await refStore().get("u-" + uid, { type: "json" })) || [];
const saveRefs = (uid, l) => refStore().setJSON("u-" + uid, l.slice(-500));
const pendIdx = async () => (await refStore().get("pending", { type: "json" })) || [];
const setPend = (l) => refStore().setJSON("pending", [...new Set(l)].slice(-2000));

/* 주문 생성: 후기 번호가 올바른 줄만 기록한다(본인 후기, 삭제된 후기, 다른 제품 후기는 조용히 무시). 이 시점의 작성자 적립률을 잠근다 */
export async function validateRef(refId, productId, buyerId) {
  const r = refId ? await getReview(String(refId)) : null;
  if (!vis(r) || r.productId !== productId || r.userId === buyerId) return null;
  return r;
}
/* 결제 완료 시 한 번: 구매확정 예정으로 등록. 월 한도와 같은 구매자의 반복 구매는 여기서 걸러낸다 */
export async function registerRefs(o) {
  const lines = (o.items || []).filter((l) => l.ref && l.refUser && l.refUser !== o.userId);
  if (!lines.length) return 0;
  const cfg = await loadCfg(), month = monthOf(o.paidAt || o.createdAt), now = new Date().toISOString(); let n = 0;
  for (const l of lines) {
    const list = await refsOf(l.refUser), key = o.id + "|" + l.id;
    if (list.some((x) => x.key === key)) continue;
    const used = list.filter((x) => x.status !== "void" && monthOf(x.createdAt) === month).reduce((a, x) => a + x.amount, 0);
    const dup = list.some((x) => x.status !== "void" && x.buyerId === o.userId && x.reviewId === l.ref && Date.now() - new Date(x.createdAt).getTime() < 30 * 864e5);
    const rate = Number.isFinite(l.refRate) ? l.refRate : cfg.base;
    const want = Math.floor((l.unit * l.q * rate) / 100), amount = dup ? 0 : Math.max(0, Math.min(want, cfg.cap - used));
    list.push({ key, orderId: o.id, productId: l.id, productName: l.name, reviewId: l.ref, buyerId: o.userId, rate, base: l.unit * l.q, amount, status: amount > 0 ? "pending" : "void", note: amount > 0 ? "" : dup ? "같은 후기 반복 구매" : "월 한도", createdAt: now });
    await saveRefs(l.refUser, list);
    if (amount > 0) { await setPend([...(await pendIdx()), o.id]); n++; }
  }
  return n;
}
/* 구매확정: 주문이 모두 발송된 뒤 고객이 누르거나, 마지막 발송 후 autoDays 일이 지나면 자동 */
export const lastShipAt = (o) => Math.max(0, ...Object.values(o.shipments || {}).filter((s) => s && s.tracking).map((s) => new Date(s.at).getTime() || 0));
export async function confirmOrder(o, by = "customer", cfg) {
  if (o.confirmedAt) return { ok: true, already: true };
  if (o.status !== "shipped") return { error: "배송이 모두 시작된 주문만 구매확정할 수 있어요" };
  o.confirmedAt = new Date().toISOString(); o.confirmedBy = by;
  await orders().setJSON(o.id, o);
  return { ok: true, paid: await settleRefs(o) };
}
export async function autoConfirmIfDue(o, cfg) {
  cfg = cfg || (await loadCfg());
  if (o.confirmedAt || o.status !== "shipped" || Date.now() - lastShipAt(o) < cfg.autoDays * 864e5) return false;
  return !!(await confirmOrder(o, "auto", cfg)).ok;
}
export async function settleRefs(o) {
  let paid = 0;
  for (const l of (o.items || []).filter((x) => x.ref && x.refUser)) {
    const list = await refsOf(l.refUser), x = list.find((y) => y.key === o.id + "|" + l.id);
    if (!x || x.status !== "pending") continue;
    const r = await apply(l.refUser, x.amount, "ref", "후기 구매 적립 · " + String(l.name).slice(0, 20), "ref-" + x.key, { orderId: o.id });
    x.status = "earned"; x.doneAt = new Date().toISOString(); await saveRefs(l.refUser, list); if (r.done) paid += x.amount;
  }
  await setPend((await pendIdx()).filter((id) => id !== o.id));
  return paid;
}
/* 취소·환불: 예정은 소멸, 이미 지급했다면 회수. brand 를 주면 그 브랜드 제품 줄만 */
export async function voidRefs(o, brand) {
  let n = 0;
  for (const l of (o.items || []).filter((x) => x.ref && x.refUser && (!brand || x.brand === brand))) {
    const list = await refsOf(l.refUser), x = list.find((y) => y.key === o.id + "|" + l.id);
    if (!x || x.status === "void") continue;
    if (x.status === "earned") await apply(l.refUser, -x.amount, "claw", "후기 구매 적립 회수", "refc-" + x.key, { orderId: o.id });
    x.status = "void"; x.note = "취소·환불"; x.doneAt = new Date().toISOString(); await saveRefs(l.refUser, list); n++;
  }
  if (n) { const still = (await Promise.all((o.items || []).filter((x) => x.refUser).map(async (l) => (await refsOf(l.refUser)).some((y) => y.key === o.id + "|" + l.id && y.status === "pending")))).some(Boolean); if (!still) await setPend((await pendIdx()).filter((id) => id !== o.id)); }
  return n;
}
export async function pendingFor(uid) {
  const l = (await refsOf(uid)).filter((x) => x.status === "pending");
  return { total: l.reduce((a, x) => a + x.amount, 0), items: l.slice(-20).reverse().map((x) => ({ productName: x.productName, amount: x.amount, rate: x.rate, at: x.createdAt })) };
}
/* 내 후기 활동 통계 (관리자 뱃지 후보용) */
export async function reviewerStats(all) {
  const m = {}; const badges = await badgeDoc(), cfg = await loadCfg();
  for (const r of all.filter(vis)) { const s = (m[r.userId] = m[r.userId] || { uid: r.userId, name: r.userName, reviews: 0, photos: 0, rating: 0 }); s.reviews++; if ((r.photos || []).length) s.photos++; s.rating += r.rating; }
  const ids = Object.keys(m);
  await Promise.all(ids.map(async (id) => { const s = m[id]; s.avg = Math.round((s.rating / s.reviews) * 10) / 10; delete s.rating; const rf = await refsOf(id); s.refs = rf.filter((x) => x.status === "earned").length; s.badge = !!badges[id]; s.eligible = s.reviews >= cfg.needReviews && s.photos >= cfg.needPhotos; }));
  return Object.values(m).sort((a, b) => (b.badge - a.badge) || (b.eligible - a.eligible) || b.reviews - a.reviews).slice(0, 100);
}
