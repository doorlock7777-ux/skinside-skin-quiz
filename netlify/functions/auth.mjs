import { randomBytes } from "node:crypto";
import { json, makeCookie, clearCookie, readCookie, getUser } from "./_lib.mjs";

export default async (req) => {
  const u = new URL(req.url), p = u.pathname, origin = u.origin;
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;

  if (p === "/api/me") {
    const s = getUser(req);
    return json(s ? { user: { id: s.id, name: s.name, email: s.email, phone: s.phone } } : { user: null });
  }
  if (p === "/api/logout") {
    return json({ ok: true }, 200, { "set-cookie": clearCookie("sk_s") });
  }
  if (!id || !secret) return new Response("네이버 로그인이 아직 설정되지 않았어요.", { status: 503 });

  if (p === "/api/auth/naver/start") {
    const next = u.searchParams.get("next") || "";
    const st = randomBytes(12).toString("hex");
    const a = new URL("https://nid.naver.com/oauth2.0/authorize");
    a.search = new URLSearchParams({ response_type: "code", client_id: id, redirect_uri: origin + "/api/auth/naver/callback", state: st }).toString();
    return new Response(null, { status: 302, headers: { location: a.toString(), "set-cookie": makeCookie("sk_st", { st, next, exp: Date.now() + 600000 }, 600) } });
  }

  if (p === "/api/auth/naver/callback") {
    const c = readCookie(req, "sk_st");
    const code = u.searchParams.get("code"), state = u.searchParams.get("state");
    if (!c || !code || c.st !== state) return new Response("로그인 요청이 만료됐어요. 다시 시도해주세요.", { status: 400 });
    const t = await (await fetch("https://nid.naver.com/oauth2.0/token?" + new URLSearchParams({ grant_type: "authorization_code", client_id: id, client_secret: secret, code, state }))).json();
    if (!t.access_token) return new Response("네이버 인증에 실패했어요.", { status: 401 });
    const me = await (await fetch("https://openapi.naver.com/v1/nid/me", { headers: { authorization: "Bearer " + t.access_token } })).json();
    const r = me.response;
    if (!r || !r.id) return new Response("네이버 회원 정보를 가져오지 못했어요.", { status: 401 });
    const sess = { id: "n_" + r.id, name: r.name || r.nickname || "", email: r.email || "", phone: r.mobile || "", exp: Date.now() + 30 * 864e5 };
    const next = /^#\/[\w\-\/%.]*$/.test(c.next || "") ? c.next : "";
    const h = new Headers({ location: "/" + next });
    h.append("set-cookie", makeCookie("sk_s", sess, 30 * 86400));
    h.append("set-cookie", clearCookie("sk_st"));
    return new Response(null, { status: 302, headers: h });
  }
  return json({ error: "not found" }, 404);
};

export const config = { path: ["/api/me", "/api/logout", "/api/auth/naver/start", "/api/auth/naver/callback"] };
