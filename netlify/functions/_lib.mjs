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
export async function loadProducts(req) {
  const r = await fetch(new URL("/data/products.json", req.url));
  const d = await r.json();
  const extra = await loadExtra();
  d.products = d.products.concat(extra);
  const map = {};
  d.products.forEach((p) => (map[p.id] = p));
  return { data: d, map };
}

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
export function setShipment(o, brand, carrier, tracking) {
  o.shipments = o.shipments || {};
  o.shipments[brand] = { carrier: String(carrier || ""), tracking: String(tracking || "").replace(/[^0-9A-Za-z\-]/g, ""), at: new Date().toISOString() };
  const brands = [...new Set(o.items.map((l) => l.brand))];
  const n = brands.filter((x) => o.shipments[x] && o.shipments[x].tracking).length;
  o.status = n === brands.length ? "shipped" : n ? "partial" : "paid";
  return o;
}
