import { json, isAdmin, loadProducts, loadExtra, extraStore, extraImg, settings, events, stats, kday, addEvent } from "./_lib.mjs";

const EVENTS = ["kakao_click", "kakao_unlock", "quiz_start", "quiz_done"];

export default async (req) => {
  const u = new URL(req.url), p = u.pathname.replace(/\/$/, "");

  /* 공개: 진단 페이지 이벤트 집계, 추가 제품 목록, 제품 이미지, 카카오 채널 친구 수 */
  if (p === "/api/event" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (!EVENTS.includes(b.e)) return json({ error: "bad event" }, 400);
    await addEvent(b.e);
    return json({ ok: true });
  }
  if (p === "/api/extra") return json({ products: await loadExtra() }, 200, { "cache-control": "public, max-age=30" });
  if (p === "/api/extra-img") {
    const s = await extraImg().get(String(u.searchParams.get("id") || ""), { type: "text" });
    const m = s && s.match(/^data:(image\/(?:webp|jpeg|png));base64,(.+)$/);
    if (!m) return new Response("not found", { status: 404 });
    return new Response(Buffer.from(m[2], "base64"), { headers: { "content-type": m[1], "cache-control": "public, max-age=86400" } });
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
    return json({ days, top, events: evs, kakao: kk || { friends: 0, name: "", updated: null } });
  }
  if (p === "/api/manage/kakao" && req.method === "POST") {
    const friends = Math.max(0, Math.min(100000000, parseInt(b.friends, 10) || 0));
    const k = { friends, name: String(b.name || "").slice(0, 40), updated: new Date().toISOString() };
    await settings().setJSON("kakao", k);
    return json({ ok: true, kakao: k });
  }
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
    const id = "x" + Date.now().toString(36);
    await extraImg().set(id, im);
    const prod = { id, cat: b.cat, name, brand: "etc", brandName, price, list: list > price ? list : undefined, img: "/api/extra-img?id=" + id, url, directUrl: url, soldOut: false, note: "" };
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

export const config = { path: ["/api/event", "/api/extra", "/api/extra-img", "/api/kakao", "/api/manage/*"] };
