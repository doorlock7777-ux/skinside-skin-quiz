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
export function makeCookie(name, obj, maxAge) {
  const v = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${name}=${v}.${sign(v)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
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

export function isAdmin(req) {
  const t = process.env.ADMIN_TOKEN || "";
  const h = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(t), b = Buffer.from(h);
  return t.length >= 12 && a.length === b.length && timingSafeEqual(a, b);
}

export async function loadProducts(req) {
  const r = await fetch(new URL("/data/products.json", req.url));
  const d = await r.json();
  const map = {};
  d.products.forEach((p) => (map[p.id] = p));
  return { data: d, map };
}

export function shipFee(shipping, sub) {
  return sub >= (shipping.freeOver || 0) || !sub ? 0 : shipping.fee || 0;
}

export async function mail(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "스킨인사이드 <onboarding@resend.dev>", to: [].concat(to), subject, html }),
    });
    return r.ok;
  } catch { return false; }
}
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const tossAuth = () => "Basic " + Buffer.from((process.env.TOSS_SECRET_KEY || "") + ":").toString("base64");
