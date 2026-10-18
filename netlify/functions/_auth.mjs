import { scryptSync, randomBytes, randomInt, timingSafeEqual, createHmac } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { makeCookie, readCookie, clearCookie, json } from "./_lib.mjs";

/* 비공개 페이지 경로 (폴더 이름과 같아야 해요) */
export const ADMIN_DIR = "admin-answkdrnschkfdudth";
export const PARTNER_DIR = "partner-k3x9m2";

const authStore = () => getStore({ name: "auth", consistency: "strong" });
export const partnerStore = () => getStore({ name: "partners", consistency: "strong" });
const SESSION_MS = 12 * 3600e3;

/* ---------- 비밀번호 확인: 환경변수에는 해시만 둔다 (scrypt$솔트$해시) ---------- */
export function hashSecret(secret) {
  const salt = randomBytes(16).toString("hex");
  return "scrypt$" + salt + "$" + scryptSync(String(secret), salt, 32).toString("hex");
}
function checkSecret(input, stored) {
  /* 값이 없거나 형식이 틀려도 같은 시간을 쓰고 false */
  const [kind, salt, hash] = String(stored || "scrypt$00$00").split("$");
  const a = scryptSync(String(input ?? ""), salt || "00", 32), b = Buffer.from(hash || "", "hex");
  return kind === "scrypt" && b.length === 32 && timingSafeEqual(a, b);
}
function same(a, b) {
  const x = Buffer.from(String(a ?? "")), y = Buffer.from(String(b ?? ""));
  const len = Math.max(x.length, y.length, 1);
  const px = Buffer.alloc(len), py = Buffer.alloc(len); x.copy(px); y.copy(py);
  return timingSafeEqual(px, py) && x.length === y.length;
}

/* ---------- 시도 제한: IP당 / 전체 ---------- */
const ipOf = (req) => (req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "unknown").trim();
async function gate(scope, req) {
  const st = authStore(), now = Date.now();
  const keys = ["rl:" + scope + ":ip:" + ipOf(req), "rl:" + scope + ":all"];
  const limits = [{ max: 5, lock: 15 * 60e3, win: 15 * 60e3 }, { max: 30, lock: 30 * 60e3, win: 3600e3 }];
  const cur = await Promise.all(keys.map((k) => st.get(k, { type: "json" })));
  for (let i = 0; i < 2; i++) if (cur[i] && cur[i].until > now) return { locked: true, wait: Math.ceil((cur[i].until - now) / 60e3), keys, cur, limits, st };
  return { locked: false, keys, cur, limits, st };
}
async function fail(g) {
  const now = Date.now();
  for (let i = 0; i < 2; i++) {
    let c = g.cur[i];
    if (!c || now - c.first > g.limits[i].win) c = { n: 0, first: now };
    c.n++;
    if (c.n >= g.limits[i].max) { c.until = now + g.limits[i].lock; c.n = 0; c.first = now; }
    await g.st.setJSON(g.keys[i], c);
  }
}
async function clearIp(g) { try { await g.st.delete(g.keys[0]); } catch {} }
const locked = (g) => json({ error: `시도가 너무 많아요. ${g.wait}분 뒤에 다시 해주세요.` }, 429);

/* ---------- 관리자 로그인: 아이디 + 비밀번호 + 2차 비밀번호 ---------- */
export async function adminLogin(req) {
  const g = await gate("admin", req);
  if (g.locked) return locked(g);
  const b = await req.json().catch(() => ({}));
  const e = process.env;
  /* 세 가지를 항상 모두 계산한다 */
  const c1 = same(b.id, e.ADMIN_ID || "\0");
  const c2 = checkSecret(b.pw, e.ADMIN_PW_HASH);
  const c3 = checkSecret(b.pw2, e.ADMIN_PW2_HASH);
  if (!(c1 && c2 && c3) || !e.ADMIN_ID || !e.ADMIN_PW_HASH || !e.ADMIN_PW2_HASH) { await fail(g); return json({ error: "입력한 정보가 맞지 않아요" }, 401); }
  await clearIp(g);
  return json({ ok: true }, 200, { "set-cookie": makeCookie("sk_adm", { r: "admin", exp: Date.now() + SESSION_MS }, SESSION_MS / 1000, "Strict") });
}
export const adminLogout = () => json({ ok: true }, 200, { "set-cookie": clearCookie("sk_adm", "Strict") });
export const isAdmin = (req) => { const c = readCookie(req, "sk_adm"); return !!(c && c.r === "admin"); };

/* ---------- 파트너 브랜드: 브랜드별 접속 코드 ---------- */
const codeHash = (code) => createHmac("sha256", process.env.SESSION_SECRET || "").update("pc:" + String(code).toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
const AL = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newCode = () => Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => AL[randomInt(AL.length)]).join("")).join("-");
export async function partnerIdx() { return (await partnerStore().get("idx", { type: "json" })) || {}; }
export async function issueCode(brand) {
  const idx = await partnerIdx(), code = newCode();
  idx[brand] = { h: codeHash(code), issuedAt: new Date().toISOString(), lastLogin: null };
  await partnerStore().setJSON("idx", idx);
  return code;
}
export async function revokeCode(brand) {
  const idx = await partnerIdx(); delete idx[brand]; await partnerStore().setJSON("idx", idx);
}
export async function partnerLogin(req, BRANDS) {
  const g = await gate("partner", req);
  if (g.locked) return locked(g);
  const b = await req.json().catch(() => ({}));
  const h = codeHash(b.code || ""), idx = await partnerIdx();
  let hit = null;
  for (const k of Object.keys(idx)) { if (same(idx[k].h, h) && BRANDS[k]) hit = k; }
  if (!hit || String(b.code || "").replace(/[^A-Za-z0-9]/g, "").length < 12) { await fail(g); return json({ error: "코드가 맞지 않아요" }, 401); }
  await clearIp(g);
  idx[hit].lastLogin = new Date().toISOString(); await partnerStore().setJSON("idx", idx);
  return json({ ok: true, brand: BRANDS[hit].name }, 200, { "set-cookie": makeCookie("sk_prt", { r: "partner", b: hit, v: idx[hit].h.slice(0, 12), exp: Date.now() + SESSION_MS }, SESSION_MS / 1000, "Strict") });
}
export const partnerLogout = () => json({ ok: true }, 200, { "set-cookie": clearCookie("sk_prt", "Strict") });
/* 로그인한 파트너의 브랜드 키. 코드가 재발급/폐기되면 바로 무효 */
export async function partnerFromReq(req, BRANDS) {
  const c = readCookie(req, "sk_prt");
  if (!c || c.r !== "partner" || !BRANDS[c.b]) return null;
  const idx = await partnerIdx();
  return idx[c.b] && idx[c.b].h.slice(0, 12) === c.v ? c.b : null;
}
