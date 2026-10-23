import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import BRANDS from "./_brands.mjs";
export { BRANDS };

export const json = (o, s = 200, h = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } });
export const orders = () => getStore({ name: "orders", consistency: "strong" });
export const userIdx = () => getStore({ name: "userorders", consistency: "strong" });

function sign(v) {
  const k = process.env.SESSION_SECRET;
  if (!k || k.length < 16) throw new Error("SESSION_SECRET 환경변수가 필요합니다");
  return createHmac("sha256", k).update(v).digest("base64url");
}
export function makeCookie(name, obj, maxAge, same = "Lax") {
  const v = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${name}=${v}.${sign(v)}; Path=/; HttpOnly; Secure; SameSite=${same}; Max-Age=${maxAge}`;
}
export function clearCookie(name, same = "Lax") {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=${same}; Max-Age=0`;
}
export function readCookie(req, name) {
  const m = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(name + "="));
  if (!m) return null;
  const [v, s] = m.slice(name.length + 1).split(".");
  try {
    const a = Buffer.from(sign(v)), b = Buffer.from(s || "");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const o = JSON.parse(Buffer.from(v, "base64url").toString());
    if (o.exp && o.exp < Date.now()) return null;
    return o;
  } catch { return null; }
}
export const getUser = (req) => readCookie(req, "sk_s");

/* 관리자 페이지에서 추가한 제품(blob "extra")과 설정(blob "settings"), 이벤트 집계(blob "events") */
export const extraStore = () => getStore({ name: "extra", consistency: "strong" });
export const extraImg = () => getStore({ name: "extraimg", consistency: "strong" });
export const settings = () => getStore({ name: "settings", consistency: "strong" });
export const events = () => getStore({ name: "events", consistency: "strong" });
export async function loadExtra() {
  try { return (await extraStore().get("list", { type: "json" })) || []; } catch { return []; }
}
/* 재고/품절: 파트너가 관리. {제품id: {soldOut: 품절 표시, qty: 남은 수량(없으면 null)}} */
export const stockStore = () => getStore({ name: "stock", consistency: "strong" });
export async function loadStock() {
  try { return (await stockStore().get("all", { type: "json" })) || {}; } catch { return {}; }
}
export const isSoldOut = (p, st) => !!(p.soldOut || (st[p.id] && (st[p.id].soldOut || (st[p.id].qty !== null && st[p.id].qty !== undefined && st[p.id].qty <= 0))));
export async function loadProducts(req) {
  const r = await fetch(new URL("/data/products.json", req.url));
  const d = await r.json();
  const extra = await loadExtra(), st = await loadStock();
  d.products = d.products.concat(extra);
  const map = {};
  d.products.forEach((p) => {
    p.soldOut = isSoldOut(p, st);
    p.stockQty = st[p.id] && st[p.id].qty !== undefined ? st[p.id].qty : null;
    map[p.id] = p;
  });
  return { data: d, map };
}
/* 재고 수량 증감 (수량을 관리 중인 제품만). 0이 되면 자동으로 품절 */
export async function adjustStock(list) {
  const st = await loadStock();
  list.forEach(([id, n]) => { const s = st[id]; if (s && s.qty !== null && s.qty !== undefined) s.qty = Math.max(0, s.qty + n); });
  await stockStore().setJSON("all", st);
}

export const CARRIERS = { cj: "CJ대한통운", lotte: "롯데택배", hanjin: "한진택배", post: "우체국", logen: "로젠택배" };
const CAR_ALIAS = { cj: "cj", cj대한통운: "cj", 대한통운: "cj", cj택배: "cj", 롯데: "lotte", 롯데택배: "lotte", 롯데글로벌로지스: "lotte", lotte: "lotte", 한진: "hanjin", 한진택배: "hanjin", hanjin: "hanjin", 우체국: "post", 우체국택배: "post", post: "post", 로젠: "logen", 로젠택배: "logen", logen: "logen" };
export const normCarrier = (v) => CAR_ALIAS[String(v || "").replace(/\s/g, "").toLowerCase()] || "";

export function shipFee(shipping, sub) {
  return sub >= (shipping.freeOver || 0) || !sub ? 0 : shipping.fee || 0;
}

export async function mail(to, subject, html, attachments) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  try {
    const body = { from: process.env.MAIL_FROM || "스킨인사이드 <onboarding@resend.dev>", to: [].concat(to), subject, html };
    if (attachments && attachments.length) body.attachments = attachments;
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" }, body: JSON.stringify(body) });
    return r.ok;
  } catch { return false; }
}
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const tossAuth = () => "Basic " + Buffer.from((process.env.TOSS_SECRET_KEY || "") + ":").toString("base64");

/* 실시간 인기 집계: 날짜별 {제품id:{v:조회, c:담기/구매클릭, b:구매수량, d:화면에 표시하는 구매 수}} */
export const stats = () => getStore({ name: "stats", consistency: "strong" });
export const kday = (off = 0) => new Date(Date.now() + 9 * 36e5 - off * 864e5).toISOString().slice(0, 10);
/* 이번 주(월요일 0시 한국 시간부터 오늘까지)의 kday 오프셋. 구매 수는 매주 월요일 0시에 0부터 다시 센다 */
export const weekOffs = () => Array.from({ length: ((new Date(Date.now() + 9 * 36e5).getUTCDay() + 6) % 7) + 1 }, (_, i) => i);
export async function addStat(list) {
  const st = stats(), k = kday();
  const o = (await st.get(k, { type: "json" })) || {};
  list.forEach(([id, e, n]) => { const s = (o[id] = o[id] || { v: 0, c: 0, b: 0, d: 0 }); s[e] = (s[e] || 0) + n; });
  await st.setJSON(k, o);
}

export async function addEvent(name, n = 1) {
  const st = events(), k = kday();
  const o = (await st.get(k, { type: "json" })) || {};
  o[name] = (o[name] || 0) + n;
  await st.setJSON(k, o);
}

/* 송장 저장 + 주문 상태 갱신 (관리자, 브랜드 화면 공통) */
export const TRACK_RE = /^[0-9A-Za-z\-]{6,30}$/;
export function setShipment(o, brand, carrier, tracking) {
  o.shipments = o.shipments || {};
  o.shipments[brand] = { carrier: String(carrier || ""), tracking: String(tracking || "").replace(/[^0-9A-Za-z\-]/g, ""), at: new Date().toISOString() };
  const brands = [...new Set(o.items.map((l) => l.brand))];
  const n = brands.filter((x) => o.shipments[x] && o.shipments[x].tracking).length;
  o.status = n === brands.length ? "shipped" : n ? "partial" : "paid";
  return o;
}

/* 발송 안내 메일(고객): 브랜드가 송장을 입력하면 한 번만 보낸다 */
export async function notifyShipped(o, brand) {
  o.shipNotified = o.shipNotified || {};
  const sh = (o.shipments || {})[brand];
  if (!sh || !sh.tracking || !o.userEmail) return false;
  const key = sh.carrier + ":" + sh.tracking;
  if (o.shipNotified[brand] === key) return false;
  const ls = o.items.filter((l) => l.brand === brand);
  const ok = await mail(o.userEmail, "[스킨인사이드] 주문하신 상품이 발송됐어요", `<div style="font-family:sans-serif;max-width:560px;color:#191f28"><p>${esc(o.userName || "고객")}님, 주문하신 상품이 발송됐어요.</p><p>주문번호 <b>${esc(o.id)}</b><br>${ls.map((l) => esc(l.name) + (l.optName ? " (" + esc(l.optName) + ")" : "") + " x " + l.q).join("<br>")}</p><p>택배사 <b>${esc(CARRIERS[sh.carrier] || sh.carrier)}</b><br>송장번호 <b>${esc(sh.tracking)}</b></p><p style="color:#6b7684;font-size:13px">택배사 사이트에서 송장번호로 배송 상황을 확인할 수 있어요.</p></div>`);
  if (ok) o.shipNotified[brand] = key;
  return ok;
}

/* 브랜드 이메일·수수료율은 관리자 페이지에서 저장한 값이 서버 설정 파일(_brands.mjs)보다 우선한다 */
const brandCfg = () => getStore({ name: "brandcfg", consistency: "strong" });
let _bc = { at: 0 };
export async function loadBrands(force) {
  if (!force && Date.now() - _bc.at < 5000) return;
  try {
    const cfg = (await brandCfg().get("all", { type: "json" })) || {};
    for (const k of Object.keys(cfg)) if (cfg[k] && cfg[k].added && !BRANDS[k]) BRANDS[k] = { name: cfg[k].name, email: "", fee: 0 };
    for (const k of Object.keys(BRANDS)) if (cfg[k]) { BRANDS[k].email = cfg[k].email || ""; BRANDS[k].fee = Number(cfg[k].fee) || 0; }
    _bc = { at: Date.now() };
  } catch { /* 읽기에 실패하면 설정 파일 값으로 계속 동작 */ }
}
export async function saveBrand(key, email, fee) {
  const cfg = (await brandCfg().get("all", { type: "json" })) || {};
  cfg[key] = { ...(cfg[key] || {}), email, fee }; await brandCfg().setJSON("all", cfg); await loadBrands(true);
}

/* 관리자 화면에서 브랜드 추가: 이름으로 주소용 키를 만들고, 이미 있는 이름·키와 겹치면 거부한다 */
export async function addBrand(name, email, fee) {
  await loadBrands(true);
  const nm = String(name || "").trim().slice(0, 30);
  if (nm.length < 1) return { error: "브랜드 이름을 입력해주세요" };
  if (Object.values(BRANDS).some((b) => String(b.name).toLowerCase() === nm.toLowerCase())) return { error: "이미 있는 브랜드예요" };
  let key = nm.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "b" + Date.now().toString(36);
  while (BRANDS[key] || key === "etc") key += Math.floor(Math.random() * 10);
  const cfg = (await brandCfg().get("all", { type: "json" })) || {};
  cfg[key] = { added: true, name: nm, email, fee }; await brandCfg().setJSON("all", cfg); await loadBrands(true);
  return { key };
}
