// 서버 함수 시험: 가짜 blob 저장소로 관리자 API를 호출해 본다.  사용: node scripts/test_functions.mjs
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const R = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = fs.mkdtempSync(path.join(os.tmpdir(), "fn-"));
fs.cpSync(path.join(R, "netlify/functions"), path.join(T, "functions"), { recursive: true });
fs.mkdirSync(path.join(T, "node_modules/@netlify/blobs"), { recursive: true });
fs.writeFileSync(path.join(T, "node_modules/@netlify/blobs/package.json"), '{"name":"@netlify/blobs","type":"module","main":"index.js"}');
fs.writeFileSync(path.join(T, "node_modules/@netlify/blobs/index.js"), `const D = globalThis.__BL = globalThis.__BL || {};
export const getStore = (o) => { const n = typeof o === "string" ? o : o.name; const m = (D[n] = D[n] || new Map());
  return { get: async (k, op) => { const v = m.get(k); if (v === undefined) return null; return op && op.type === "json" ? JSON.parse(v) : v; }, set: async (k, v) => { m.set(k, String(v)); }, setJSON: async (k, v) => { m.set(k, JSON.stringify(v)); }, delete: async (k) => { m.delete(k); }, list: async () => ({ blobs: [...m.keys()].map((key) => ({ key })) }) }; };`);
fs.writeFileSync(path.join(T, "functions/_brands.mjs"), 'export default {"bonkorea":{"name":"본코리아","email":"bk@x.test","fee":10},"grafen":{"name":"GRAFEN","email":"gf@x.test","fee":0},"minic":{"name":"MINIC","email":"","fee":0}};');
process.env.RESEND_API_KEY = "re_test"; process.env.NOTIFY_EMAIL = "me@x.test"; process.env.SITE_URL = "https://skinside.test";
process.env.SESSION_SECRET = "x".repeat(20);
const products = fs.readFileSync(path.join(R, "public/data/products.json"), "utf-8");
const realFetch = globalThis.fetch;
const MAILS = [];
globalThis.fetch = async (u, o) => String(u).includes("api.resend.com") ? (MAILS.push(JSON.parse(o.body)), new Response("{}", { status: 200 })) : String(u).includes("/data/products.json") ? new Response(products, { headers: { "content-type": "application/json" } }) : realFetch(u, o);
const site = (await import(pathToFileURL(path.join(T, "functions/site.mjs")))).default;
const stats = (await import(pathToFileURL(path.join(T, "functions/stats.mjs")))).default;
const auth = await import(pathToFileURL(path.join(T, "functions/_auth.mjs")));
const adminApi = (await import(pathToFileURL(path.join(T, "functions/admin.mjs")))).default;
process.env.ADMIN_ID = "tester"; process.env.ADMIN_PW_HASH = auth.hashSecret("pw-one-123"); process.env.ADMIN_PW2_HASH = auth.hashSecret("2222");
const H = "https://x.test";
let A = { "content-type": "application/json" };
const LAST = {};
const call = async (fn, p, method = "GET", body, h = {}) => { const r = await fn(new Request(H + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined })); LAST.cookie = (r.headers.get("set-cookie") || "").split(";")[0]; return [r.status, r.headers.get("content-type")?.includes("json") ? await r.json() : await r.arrayBuffer()]; };
const errs = []; const ok = (c, m) => { if (!c) errs.push(m); };
let [s, j] = await call(site, "/api/manage/dashboard"); ok(s === 401, "로그인 없이 대시보드가 열려요");
[s, j] = await call(site, "/api/manage/dashboard", "GET", null, { authorization: "Bearer test-admin-token-123" }); ok(s === 401, "예전 토큰 방식이 아직 통과해요");
[s, j] = await call(site, "/api/manage/dashboard", "GET", null, { cookie: "sk_adm=forged.value" }); ok(s === 401, "위조 쿠키가 통과해요");
/* 관리자 로그인: 세 가지를 모두 맞게 입력해야 한다 */
for (const [b, why] of [[{ id: "tester", pw: "pw-one-123", pw2: "0000" }, "2차 비밀번호 틀림"], [{ id: "tester", pw: "bad", pw2: "2222" }, "비밀번호 틀림"], [{ id: "nobody", pw: "pw-one-123", pw2: "2222" }, "아이디 틀림"], [{ id: "tester", pw: "pw-one-123" }, "2차 비밀번호 없음"]]) {
  [s, j] = await call(adminApi, "/api/admin/login", "POST", b, { "x-nf-client-connection-ip": "9.9.9." + why.length }); ok(s === 401 && !LAST.cookie, "잘못된 로그인이 통과해요: " + why);
}
/* 같은 IP에서 5번 틀리면 잠긴다 (올바른 입력도 막힘) */
for (let i = 0; i < 5; i++) await call(adminApi, "/api/admin/login", "POST", { id: "tester", pw: "x", pw2: "y" }, { "x-nf-client-connection-ip": "7.7.7.7" });
[s, j] = await call(adminApi, "/api/admin/login", "POST", { id: "tester", pw: "pw-one-123", pw2: "2222" }, { "x-nf-client-connection-ip": "7.7.7.7" }); ok(s === 429, "5회 실패 후에도 로그인이 돼요");
[s, j] = await call(adminApi, "/api/admin/login", "POST", { id: "tester", pw: "pw-one-123", pw2: "2222" }, { "x-nf-client-connection-ip": "1.2.3.4" }); ok(s === 200 && /sk_adm=/.test(LAST.cookie), "올바른 관리자 로그인 실패");
A = { cookie: LAST.cookie, "content-type": "application/json" };
{ const r = await adminApi(new Request(H + "/api/admin/login", { method: "POST", body: JSON.stringify({ id: "tester", pw: "pw-one-123", pw2: "2222" }), headers: { "x-nf-client-connection-ip": "1.2.3.5" } })); const sc = r.headers.get("set-cookie"); ok(/HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Strict/.test(sc), "관리자 쿠키 보안 속성이 부족해요: " + sc); }
[s] = await call(adminApi, "/api/admin/me", "GET", null, A); ok(s === 200, "로그인 뒤 me 실패");
[s] = await call(adminApi, "/api/admin/orders"); ok(s === 401, "로그인 없이 주문이 보여요");
for (let i = 0; i < 3; i++) await call(stats, "/api/track", "POST", { id: "bonkorea-cl", e: "c" });
await call(stats, "/api/track", "POST", { id: "bonkorea-cl", e: "v" });
await call(stats, "/api/track", "POST", { id: "minic-allinone", e: "c" });
[s, j] = await call(site, "/api/event", "POST", { e: "kakao_click" }); ok(s === 200, "이벤트 저장 실패");
[s, j] = await call(site, "/api/event", "POST", { e: "hack" }); ok(s === 400, "잘못된 이벤트가 통과해요");
[s, j] = await call(site, "/api/manage/dashboard?days=7", "GET", null, A);
ok(s === 200 && j.top[0].id === "bonkorea-cl" && j.top[0].clicks === 3 && j.top[0].views === 1 && j.top.length === 2, "TOP 집계가 달라요 " + JSON.stringify(j.top));
ok(j.events.kakao_click === 1, "이벤트 집계가 달라요");
[s, j] = await call(site, "/api/manage/kakao", "POST", { friends: "8144", name: "문장군" }, A); ok(s === 200 && j.kakao.friends === 8144, "카카오 저장 실패");
[s, j] = await call(site, "/api/kakao"); ok(j.friends === 8144, "공개 친구 수가 달라요");
const img = "data:image/webp;base64," + Buffer.from("fakeimage").toString("base64");
const good = { name: "테스트 앰플", brandName: "TEST", list: 30000, price: 21000, cat: "sk", url: "https://example.com/a", img };
for (const [bad, why] of [[{ ...good, cat: "zz" }, "카테고리"], [{ ...good, price: 40000 }, "가격"], [{ ...good, url: "javascript:1" }, "링크"], [{ ...good, img: "" }, "이미지"], [{ ...good, name: "" }, "이름"]]) { [s] = await call(site, "/api/manage/product", "POST", bad, A); ok(s === 400, why + " 검증이 안 돼요"); }
[s] = await call(site, "/api/manage/product", "POST", good); ok(s === 401, "토큰 없이 제품이 추가돼요");
[s, j] = await call(site, "/api/manage/product", "POST", good, A); ok(s === 200 && j.product.img.startsWith("/api/extra-img?id="), "제품 추가 실패 " + JSON.stringify(j));
const id = j.product.id;
[s, j] = await call(site, "/api/extra"); ok(j.products.length === 1 && j.products[0].id === id, "공개 제품 목록에 안 나와요");
const r = await site(new Request(H + "/api/extra-img?id=" + id)); ok(r.status === 200 && r.headers.get("content-type") === "image/webp", "이미지 응답 실패");
[s, j] = await call(stats, "/api/track", "POST", { id, e: "c" }); ok(s === 200, "추가 제품 클릭이 집계되지 않아요");
[s, j] = await call(site, "/api/manage/product-delete", "POST", { id }, A); [s, j] = await call(site, "/api/extra"); ok(j.products.length === 0, "삭제 실패");

/* ---- 브랜드 일괄 메일 / 브랜드 화면 ---- */
const lib = await import(pathToFileURL(path.join(T, "functions/_lib.mjs")));
const batch = await import(pathToFileURL(path.join(T, "functions/_batch.mjs")));
const brand = (await import(pathToFileURL(path.join(T, "functions/brand.mjs")))).default;
const ship = { name: "김민수", phone: "010-1234-5678", zip: "06236", addr1: "서울 강남구 테헤란로 123", addr2: "456호", memo: "문 앞" };
const mk = (id, items, status = "paid") => ({ id, userId: "u1", items, ship, sub: 1, shipFee: 3000, total: 1, status, createdAt: "2026-10-17T10:00:00.000Z", paidAt: "2026-10-17T10:01:00.000Z", shipments: {} });
await lib.orders().setJSON("O1", mk("O1", [{ id: "a", brand: "bonkorea", name: "엔젤 탄산 효소 세안제", optName: "", q: 2, unit: 29900 }, { id: "b", brand: "grafen", name: "포어 올킬 원스텝 코팩", optName: "", q: 1, unit: 9900 }]));
await lib.orders().setJSON("O2", mk("O2", [{ id: "c", brand: "minic", name: "올인원", optName: "1개", q: 1, unit: 21500 }]));
await lib.orders().setJSON("O3", mk("O3", [{ id: "a", brand: "bonkorea", name: "엔젤 탄산 효소 세안제", optName: "", q: 1, unit: 29900 }], "pending"));
let r1 = await batch.runBrandBatch({ dry: true }); ok(r1.length === 3 && MAILS.length === 0, "미리보기가 메일을 보내요");
const res = await batch.runBrandBatch({});
const bk = MAILS.find((m) => m.to[0] === "bk@x.test");
ok(res.find((x) => x.brand === "bonkorea").sent && res.find((x) => x.brand === "grafen").sent, "브랜드 메일이 안 나가요");
ok(res.find((x) => x.brand === "minic").sent === false && /이메일/.test(res.find((x) => x.brand === "minic").reason), "이메일 없는 브랜드 처리가 달라요");
ok(bk && bk.subject.includes("신규 주문 1건") && bk.html.includes("O1") && !bk.html.includes("O3"), "본코리아 메일 내용이 달라요(결제 전 주문 제외)");
ok(bk.html.includes("https://skinside.test/" + auth.PARTNER_DIR + "/") && !bk.html.includes("#k="), "메일에 파트너 주소가 없거나 토큰이 들어 있어요");
const csvText = Buffer.from(bk.attachments[0].content, "base64").toString("utf-8");
ok(csvText.includes("주문번호") && csvText.includes("김민수") && csvText.includes("010-1234-5678") && csvText.includes("서울 강남구 테헤란로 123 456호") && csvText.includes("53820"), "CSV 항목이 달라요 (정산 53,820원 = 59,800 - 수수료 10%)");
ok(!bk.html.includes("포어 올킬"), "다른 브랜드 제품이 보여요");
ok(MAILS.some((m) => m.to[0] === "me@x.test"), "운영자 결과 메일이 없어요");
const n0 = MAILS.length; await batch.runBrandBatch({}); ok(MAILS.filter((m) => m.to[0] === "bk@x.test").length === 1, "같은 주문이 두 번 전달돼요"); 
// 파트너 화면: 관리자가 발급한 코드로만 로그인
const ph = (c) => ({ cookie: c, "content-type": "application/json" });
[s, j] = await call(brand, "/api/partner/orders"); ok(s === 401, "로그인 없이 파트너 주문이 보여요");
[s, j] = await call(brand, "/api/partner/login", "POST", { code: "AAAA-BBBB-CCCC-DDDD" }, { "x-nf-client-connection-ip": "5.5.5.1" }); ok(s === 401, "발급 안 된 코드가 통과해요");
[s, j] = await call(adminApi, "/api/admin/partners/issue", "POST", { brand: "bonkorea" }); ok(s === 401, "로그인 없이 코드가 발급돼요");
[s, j] = await call(adminApi, "/api/admin/partners/issue", "POST", { brand: "bonkorea" }, A); ok(s === 200 && /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(j.code), "코드 발급 실패");
const codeB = j.code;
[s, j] = await call(adminApi, "/api/admin/partners/issue", "POST", { brand: "grafen" }, A); const codeG = j.code;
[s, j] = await call(brand, "/api/partner/login", "POST", { code: codeB.toLowerCase().replace(/-/g, " ") }, { "x-nf-client-connection-ip": "5.5.5.2" }); ok(s === 200 && j.brand === "본코리아", "발급된 코드로 로그인 실패(소문자/공백 허용)");
const BH = ph(LAST.cookie);
[s, j] = await call(brand, "/api/partner/login", "POST", { code: codeG }, { "x-nf-client-connection-ip": "5.5.5.3" }); const gh = ph(LAST.cookie);
[s, j] = await call(brand, "/api/partner/orders", "GET", null, { cookie: "sk_prt=forged.x" }); ok(s === 401, "위조 파트너 쿠키가 통과해요");
[s, j] = await call(brand, "/api/partner/orders", "GET", null, { cookie: BH.cookie.replace(/.$/, "x") }); ok(s === 401, "변조한 파트너 쿠키가 통과해요");
[s, j] = await call(brand, "/api/partner/orders", "GET", null, BH); ok(s === 200 && j.orders.length === 1 && j.orders[0].items.length === 1 && j.orders[0].items[0].name.includes("엔젤"), "브랜드가 자기 주문만 보지 못해요 " + JSON.stringify(j).slice(0, 200));
ok(!JSON.stringify(j).includes("포어 올킬"), "다른 브랜드 제품이 파트너 화면에 보여요");
[s, j] = await call(brand, "/api/partner/ship", "POST", { orderId: "O2", carrier: "cj", tracking: "123456789012" }, BH); ok(s === 400, "남의 주문에 송장이 입력돼요");
[s, j] = await call(brand, "/api/partner/ship", "POST", { orderId: "O1", carrier: "cj", tracking: "12" }, BH); ok(s === 400, "짧은 송장번호가 통과해요");
[s, j] = await call(brand, "/api/partner/ship", "POST", { orderId: "O1", carrier: "cj", tracking: "123456789012" }, BH); ok(s === 200, "송장 입력 실패");
let o1 = await lib.orders().get("O1", { type: "json" }); ok(o1.status === "partial" && o1.shipments.bonkorea.tracking === "123456789012", "송장 반영/상태가 달라요 " + o1.status);
await call(brand, "/api/partner/ship", "POST", { orderId: "O1", carrier: "lotte", tracking: "998877665544" }, gh);
o1 = await lib.orders().get("O1", { type: "json" }); ok(o1.status === "shipped", "모든 브랜드 송장 입력 후 발송 완료가 안 돼요");
// 홈 요약: 파트너는 자기 것만, 관리자는 전체
[s, j] = await call(brand, "/api/partner/home", "GET", null, BH); ok(s === 200 && j.brand === "본코리아" && j.counts.done === 1 && j.counts.todo === 0 && j.month.sales === 59800 && j.month.feeRate === 10 && j.month.payout === 53820, "파트너 홈 요약이 달라요 " + JSON.stringify(j.counts) + JSON.stringify(j.month));
[s, j] = await call(brand, "/api/partner/home"); ok(s === 401, "로그인 없이 파트너 홈이 보여요");
[s, j] = await call(adminApi, "/api/admin/home", "GET", null, A); ok(s === 200 && j.flow.done === 2 && j.flow.wait === 0 && j.month.sales > 0 && Array.isArray(j.brands) && j.brands.some((b) => b.name === "본코리아" && b.hasCode), "관리자 홈 요약이 달라요 " + JSON.stringify(j.flow));
[s, j] = await call(adminApi, "/api/admin/home"); ok(s === 401, "로그인 없이 관리자 홈이 보여요");
[s, j] = await call(adminApi, "/api/admin/settlement?format=json&month=2026-10", "GET", null, A); ok(s === 200 && j.rows.find((r) => r.name === "본코리아").payout === 53820, "정산 JSON이 달라요");
// 코드 재발급: 이전 코드와 접속 중 로그인이 바로 끊긴다
[s, j] = await call(adminApi, "/api/admin/partners/issue", "POST", { brand: "bonkorea" }, A); const codeB2 = j.code;
[s, j] = await call(brand, "/api/partner/orders", "GET", null, BH); ok(s === 401, "재발급 후에도 이전 로그인이 유지돼요");
[s, j] = await call(brand, "/api/partner/login", "POST", { code: codeB }, { "x-nf-client-connection-ip": "5.5.5.4" }); ok(s === 401, "재발급 후에도 이전 코드가 통과해요");
[s, j] = await call(brand, "/api/partner/login", "POST", { code: codeB2 }, { "x-nf-client-connection-ip": "5.5.5.5" }); ok(s === 200, "새 코드 로그인 실패"); const BH2 = ph(LAST.cookie);
[s, j] = await call(adminApi, "/api/admin/partners", "GET", null, A); ok(s === 200 && j.dir && j.partners.find((x) => x.key === "bonkorea").issuedAt && !JSON.stringify(j).includes(codeB2), "코드 목록이 달라요(코드 원문이 노출되면 안 돼요)");
// 폐기
await call(adminApi, "/api/admin/partners/revoke", "POST", { brand: "grafen" }, A);
[s, j] = await call(brand, "/api/partner/orders", "GET", null, gh); ok(s === 401, "폐기한 브랜드가 접속돼요");
// 코드 5회 오입력 잠금
for (let i = 0; i < 5; i++) await call(brand, "/api/partner/login", "POST", { code: "ZZZZ-ZZZZ-ZZZZ-ZZ" + i }, { "x-nf-client-connection-ip": "6.6.6.6" });
[s, j] = await call(brand, "/api/partner/login", "POST", { code: codeB2 }, { "x-nf-client-connection-ip": "6.6.6.6" }); ok(s === 429, "코드 5회 오입력 뒤에도 로그인이 돼요");
// 취소 안내
o1.status = "canceled"; await lib.orders().setJSON("O1", o1);
const before = MAILS.length; await batch.runBrandBatch({});
ok(MAILS.slice(before).filter((m) => m.subject.includes("취소")).length === 2, "취소 안내 메일이 안 나가요");
[s, j] = await call(brand, "/api/partner/ship", "POST", { orderId: "O1", carrier: "cj", tracking: "123456789012" }, BH2); ok(s === 400, "취소된 주문에 송장이 입력돼요");
const cnt = MAILS.filter((m) => m.to[0] !== "me@x.test").length; await batch.runBrandBatch({}); ok(MAILS.filter((m) => m.to[0] !== "me@x.test").length === cnt, "취소 안내가 반복돼요");
console.log(errs.length ? "FAIL\n" + errs.join("\n") : "OK: 관리자 API 시험 통과"); process.exit(errs.length ? 1 : 0);
