import { runBrandBatch } from "./_batch.mjs";
import { isAdmin } from "./_auth.mjs";
import { beat } from "./_live.mjs";
import { loadBrands, BRANDS, json, loadStock, isSoldOut, loadProducts, loadExtra, extraStore, extraImg, settings, events, stats, kday, addEvent } from "./_lib.mjs";

/* 히든 버튼 타이머: 시각은 모두 한국 시간(KST, UTC+9)으로 해석한다 */
const KST = 9 * 3600e3;
const kstEpoch = (str) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(str || ""));
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const t = Date.UTC(y, mo - 1, d, h, mi) - KST, k = new Date(t + KST);
  return k.getUTCMonth() === mo - 1 && k.getUTCDate() === d ? t : null; /* 2월 31일 같은 날짜 거르기 */
};
/* 기본 설정: 다가오는 일요일 밤 12시(= 월요일 0시, KST). 이미 지났으면 다음 주. 스토어의 주간 구매 수 초기화 시각과 같다 */
const nextSundayEnd = (now) => {
  const k = new Date(now + KST), add = (8 - k.getUTCDay()) % 7 || 7;
  return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + add, 0, 0) - KST;
};
const hiddenView = (h, now) => {
  const useDefault = h.useDefault !== false;
  const end = useDefault ? nextSundayEnd(now) : kstEpoch(h.endAt);
  return { useDefault, end: end || null, expired: !useDefault && !!end && end <= now };
};
const EVENTS = ["kakao_click", "kakao_unlock", "quiz_start", "quiz_done", "hidden_click"];

export default async (req) => { await loadBrands();
  const u = new URL(req.url), p = u.pathname.replace(/\/$/, "");

  /* 공개: 진단 페이지 이벤트 집계, 추가 제품 목록, 제품 이미지, 카카오 채널 친구 수 */
  if (p === "/api/event" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (!EVENTS.includes(b.e)) return json({ error: "bad event" }, 400);
    await addEvent(b.e);
    /* 진단 완료에는 피부타입(예: CRNT-O)을 함께 모은다. 형식이 맞는 것만 받는다 (간이 진단은 타입을 보내지 않는다) */
    if (b.e === "quiz_done" && /^[DOC][SR][PN][WT](-[OD])?$/.test(String(b.t || ""))) await addEvent("type:" + b.t);
    return json({ ok: true });
  }
  /* 실시간 접속 신호(스토어·진단 화면이 열려 있는 동안 1분마다). 임의 id와 화면 이름만 받는다 */
  if (p === "/api/live" && req.method === "POST") {
    const r = await beat(await req.json().catch(() => ({})));
    return json(r, r.error ? 400 : 200, { "cache-control": "no-store" });
  }
  if (p === "/api/stock") {
    const st = await loadStock();
    return json({ soldOut: Object.keys(st).filter((id) => isSoldOut({ id }, st)) }, 200, { "cache-control": "public, max-age=20" });
  }
  if (p === "/api/extra") return json({ products: await loadExtra() }, 200, { "cache-control": "public, max-age=30" });
  if (p === "/api/extra-img") {
    const s = await extraImg().get(String(u.searchParams.get("id") || ""), { type: "text" });
    const m = s && s.match(/^data:(image\/(?:webp|jpeg|png));base64,(.+)$/);
    if (!m) return new Response("not found", { status: 404 });
    return new Response(Buffer.from(m[2], "base64"), { headers: { "content-type": m[1], "cache-control": "public, max-age=86400" } });
  }
  /* 히든 버튼(스토어 하단 특가 버튼): 문구·링크·노출 여부는 관리자가 정한다 */
  if (p === "/api/hidden") {
    const h = (await settings().get("hidden", { type: "json" })) || {}, now = Date.now(), v = hiddenView(h, now);
    const on = !!(h.on && h.text && h.url) && !v.expired;
    return json(on ? { on: true, text: h.text, url: h.url, end: v.end, now } : { on: false }, 200, { "cache-control": "public, max-age=10" });
  }
  if (p === "/api/kakao") {
    const k = (await settings().get("kakao", { type: "json" })) || {};
    return json({ friends: k.friends || 0, name: k.name || "" }, 200, { "cache-control": "public, max-age=300" });
  }

  /* 관리자 */
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (p === "/api/manage/dashboard") {
    const days = Math.min(30, Math.max(1, parseInt(u.searchParams.get("days"), 10) || 7));
    const st = stats(), ev = events();
    const keys = Array.from({ length: days }, (_, i) => kday(i));
    const [sd, ed, { map }, kk] = await Promise.all([
      Promise.all(keys.map((k) => st.get(k, { type: "json" }))),
      Promise.all(keys.map((k) => ev.get(k, { type: "json" }))),
      loadProducts(req),
      settings().get("kakao", { type: "json" }),
    ]);
    const sum = {};
    sd.forEach((o) => o && Object.keys(o).forEach((id) => { const s = (sum[id] = sum[id] || { c: 0, v: 0 }); s.c += o[id].c || 0; s.v += o[id].v || 0; }));
    const top = Object.keys(sum).filter((id) => map[id] && sum[id].c > 0)
      .sort((a, b2) => sum[b2].c - sum[a].c || sum[b2].v - sum[a].v).slice(0, 10)
      .map((id) => ({ id, name: map[id].name, brand: map[id].brandName, clicks: sum[id].c, views: sum[id].v }));
    const evs = {};
    EVENTS.forEach((e) => (evs[e] = ed.reduce((a, o) => a + ((o && o[e]) || 0), 0)));
    const types = {};
    ed.forEach((o) => o && Object.keys(o).forEach((k) => { if (k.startsWith("type:")) types[k.slice(5)] = (types[k.slice(5)] || 0) + o[k]; }));
    return json({ days, top, events: evs, types, kakao: kk || { friends: 0, name: "", updated: null } });
  }
  if (p === "/api/manage/hidden" && req.method === "GET") {
    const h = (await settings().get("hidden", { type: "json" })) || {}, now = Date.now(), v = hiddenView(h, now);
    return json({ on: !!h.on, text: h.text || "", url: h.url || "", useDefault: v.useDefault, endAt: h.endAt || "", end: v.end, defaultEnd: nextSundayEnd(now), now, expired: v.expired, updated: h.updated || null });
  }
  if (p === "/api/manage/hidden" && req.method === "POST") {
    const text = String(b.text || "").replace(/\s+/g, " ").trim().slice(0, 30), url = String(b.url || "").trim(), on = !!b.on, useDefault = b.useDefault !== false, endAt = String(b.endAt || "").trim();
    if (url && !/^https?:\/\/[^\s<>"']{3,480}$/i.test(url)) return json({ error: "링크는 https:// 로 시작하는 주소만 쓸 수 있어요." }, 400);
    if (on && (!text || !url)) return json({ error: "문구와 링크를 모두 입력해야 켤 수 있어요." }, 400);
    if (endAt && kstEpoch(endAt) === null) return json({ error: "타이머 날짜와 시간이 올바르지 않아요." }, 400);
    if (!useDefault && on && (!endAt || kstEpoch(endAt) <= Date.now())) return json({ error: endAt ? "타이머 종료 시각이 이미 지났어요. 앞으로의 시각을 골라주세요." : "타이머 종료 시각을 정하거나 기본 설정을 선택해주세요." }, 400);
    const h = { on, text, url, useDefault, endAt, updated: new Date().toISOString() };
    await settings().setJSON("hidden", h);
    return json({ ok: true, ...h });
  }
  if (p === "/api/manage/kakao" && req.method === "POST") {
    const friends = Math.max(0, Math.min(100000000, parseInt(b.friends, 10) || 0));
    const k = { friends, name: String(b.name || "").slice(0, 40), updated: new Date().toISOString() };
    await settings().setJSON("kakao", k);
    return json({ ok: true, kakao: k });
  }
  if (p === "/api/manage/brand-mail" && req.method === "POST") return json({ results: await runBrandBatch({ dry: !!b.dry }) });
  if (p === "/api/manage/products") return json({ products: await loadExtra() });
  if (p === "/api/manage/product" && req.method === "POST") {
    const { data } = await loadProducts(req);
    const name = String(b.name || "").trim().slice(0, 80), brandName = String(b.brandName || "").trim().slice(0, 40);
    const list = Math.round(Number(b.list)), price = Math.round(Number(b.price));
    const url = String(b.url || "").trim();
    if (!name || !brandName) return json({ error: "제품명과 브랜드명을 입력해주세요" }, 400);
    if (!data.categories[b.cat]) return json({ error: "카테고리를 선택해주세요" }, 400);
    if (!(price > 0) || !(list >= price)) return json({ error: "정가와 할인가를 확인해주세요 (정가는 할인가 이상)" }, 400);
    if (!/^https?:\/\/\S+$/.test(url)) return json({ error: "바로가기 링크는 http(s)로 시작해야 해요" }, 400);
    const im = String(b.img || "");
    if (!/^data:image\/(webp|jpeg|png);base64,/.test(im) || im.length > 900000) return json({ error: "이미지를 확인해주세요 (900KB 이하)" }, 400);
    const bk = Object.keys(BRANDS).find((k) => String(BRANDS[k].name).toLowerCase() === brandName.toLowerCase()), brandKey = bk || "etc";
    const id = "x" + Date.now().toString(36);
    await extraImg().set(id, im);
    const prod = { id, cat: b.cat, name, brand: brandKey, brandName, price, list: list > price ? list : undefined, img: "/api/extra-img?id=" + id, url, directUrl: url, soldOut: false, note: "" };
    const cur = await loadExtra();
    cur.push(prod);
    await extraStore().setJSON("list", cur);
    return json({ ok: true, product: prod });
  }
  if (p === "/api/manage/product-delete" && req.method === "POST") {
    const cur = (await loadExtra()).filter((x) => x.id !== b.id);
    await extraStore().setJSON("list", cur);
    try { await extraImg().delete(String(b.id)); } catch {}
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
};

export const config = { path: ["/api/event", "/api/live", "/api/stock", "/api/extra", "/api/extra-img", "/api/kakao", "/api/hidden", "/api/manage/*"] };
