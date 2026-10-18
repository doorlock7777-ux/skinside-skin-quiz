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
process.env.SESSION_SECRET = "x".repeat(20); process.env.TOSS_SECRET_KEY = "test_sk";
const products = fs.readFileSync(path.join(R, "public/data/products.json"), "utf-8");
const realFetch = globalThis.fetch;
const MAILS = [];
const TOSS = { calls: [], failCancel: false };
globalThis.fetch = async (u, o) => String(u).includes("api.tosspayments.com") ? (TOSS.calls.push({ u: String(u), body: JSON.parse(o.body || "{}") }), String(u).endsWith("/cancel") && TOSS.failCancel ? new Response(JSON.stringify({ message: "취소 불가" }), { status: 400 }) : new Response(JSON.stringify({ paymentKey: "pk_" + (JSON.parse(o.body || "{}").orderId || ""), method: "카드" }), { status: 200 })) : String(u).includes("api.resend.com") ? (MAILS.push(JSON.parse(o.body)), new Response("{}", { status: 200 })) : String(u).includes("/data/products.json") ? new Response(products, { headers: { "content-type": "application/json" } }) : realFetch(u, o);
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

/* ---- 주문 흐름 / 파트너 / 재고 / CS / 정산 ---- */
const lib = await import(pathToFileURL(path.join(T, "functions/_lib.mjs")));
const batch = await import(pathToFileURL(path.join(T, "functions/_batch.mjs")));
const brand = (await import(pathToFileURL(path.join(T, "functions/brand.mjs")))).default;
const orderApi = (await import(pathToFileURL(path.join(T, "functions/order.mjs")))).default;
const confirmApi = (await import(pathToFileURL(path.join(T, "functions/confirm.mjs")))).default;
const csApi = (await import(pathToFileURL(path.join(T, "functions/cs.mjs")))).default;
const brandmail = (await import(pathToFileURL(path.join(T, "functions/brandmail.mjs")))).default;
const NOW = Date.now(), ago = (h) => new Date(NOW - h * 36e5).toISOString(), month = new Date().toISOString().slice(0, 7);
const ship = { name: "김민수", phone: "010-1234-5678", zip: "06236", addr1: "서울 강남구 테헤란로 123", addr2: "456호", memo: "문 앞" };
const mk = (id, items, status, h, extra = {}) => ({ id, userId: "u1", userName: "김민수", userEmail: "c1@x.test", items, ship, sub: 1, shipFee: 3000, total: items.reduce((a, l) => a + l.unit * l.q, 0), status, createdAt: ago(h), paidAt: ago(h), shipments: {}, paymentKey: "pk_" + id, ...extra });
const BK = (q) => ({ id: "bonkorea-cl", brand: "bonkorea", name: "엔젤 탄산 효소 세안제", optName: "", q, unit: 29900 });
const GF = (q) => ({ id: "grafen-patch", brand: "grafen", name: "포어 올킬 원스텝 코팩", optName: "", q, unit: 9900 });
await lib.orders().setJSON("O1", mk("O1", [BK(2), GF(1)], "paid", 30));
await lib.orders().setJSON("O2", mk("O2", [{ id: "minic-allinone", brand: "minic", name: "올인원", optName: "1개", q: 1, unit: 21500 }], "paid", 2));
await lib.orders().setJSON("O3", mk("O3", [BK(1)], "pending", 1));
const mails = (to, sub) => MAILS.filter((m) => m.to[0] === to && (!sub || m.subject.includes(sub)));

// 아침 정리 메일: 아직 발송 안 한 주문 + 지연 표시 + 택배사/송장번호 칸이 있는 엑셀
let r1 = await batch.runBrandBatch({ dry: true }); ok(r1.length === 3 && MAILS.length === 0, "미리보기가 메일을 보내요");
ok(r1.find((x) => x.brand === "bonkorea").late === 1 && r1.find((x) => x.brand === "minic").late === 0, "지연 계산이 달라요");
const res = await batch.runBrandBatch({});
const bk = mails("bk@x.test")[0];
ok(res.find((x) => x.brand === "bonkorea").sent && res.find((x) => x.brand === "grafen").sent, "브랜드 정리 메일이 안 나가요");
ok(res.find((x) => x.brand === "minic").sent === false && /이메일/.test(res.find((x) => x.brand === "minic").reason), "이메일 없는 브랜드 처리가 달라요");
ok(bk && bk.subject.includes("미발송 주문 1건") && bk.subject.includes("지연 1건") && bk.html.includes("O1") && !bk.html.includes("O3"), "본코리아 메일 내용이 달라요 " + (bk && bk.subject));
ok(bk.html.includes("https://skinside.test/" + auth.PARTNER_DIR + "/") && !bk.html.includes("#k="), "메일에 파트너 주소가 없거나 토큰이 들어 있어요");
const csvText = Buffer.from(bk.attachments[0].content, "base64").toString("utf-8");
ok(csvText.includes("주문번호") && csvText.includes("택배사") && csvText.includes("송장번호") && csvText.includes("김민수") && csvText.includes("010-1234-5678") && csvText.includes("서울 강남구 테헤란로 123 456호"), "엑셀 내용이 달라요");
ok(!bk.html.includes("포어 올킬") && !csvText.includes("포어 올킬"), "다른 브랜드 제품이 보여요");
ok(MAILS.some((m) => m.to[0] === "me@x.test"), "운영자 결과 메일이 없어요");

// 파트너 로그인 (관리자가 발급한 코드)
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
// 주문은 결제 즉시 파트너에게 보인다(브랜드 메일을 기다리지 않음). 자기 브랜드 것만.
[s, j] = await call(brand, "/api/partner/orders", "GET", null, BH); ok(s === 200 && j.orders.length === 1 && j.orders[0].id === "O1" && j.orders[0].items.length === 1 && j.orders[0].items[0].name.includes("엔젤"), "브랜드가 자기 주문만 보지 못해요 " + JSON.stringify(j).slice(0, 200));
ok(!JSON.stringify(j).includes("포어 올킬") && !JSON.stringify(j).includes("O3"), "다른 브랜드/결제 전 주문이 파트너 화면에 보여요");
// 엑셀 다운로드
{ const r = await brand(new Request(H + "/api/partner/orders.csv", { headers: BH })); const t = await r.text(); ok(r.status === 200 && r.headers.get("content-type").includes("csv") && t.includes("O1") && t.includes("송장번호") && !t.includes("O2") && !t.includes("포어 올킬"), "발송 대기 엑셀 다운로드가 달라요"); }
{ const r = await brand(new Request(H + "/api/partner/orders.csv")); ok(r.status === 401, "로그인 없이 엑셀이 내려가요"); }
// 송장: 한 건
[s, j] = await call(brand, "/api/partner/ship", "POST", { orderId: "O2", carrier: "cj", tracking: "123456789012" }, BH); ok(s === 400, "남의 주문에 송장이 입력돼요");
[s, j] = await call(brand, "/api/partner/ship", "POST", { orderId: "O1", carrier: "cj", tracking: "12" }, BH); ok(s === 400, "짧은 송장번호가 통과해요");
[s, j] = await call(brand, "/api/partner/ship", "POST", { orderId: "O1", carrier: "CJ대한통운", tracking: "123456789012" }, BH); ok(s === 200, "송장 입력 실패");
let o1 = await lib.orders().get("O1", { type: "json" }); ok(o1.status === "partial" && o1.shipments.bonkorea.tracking === "123456789012" && o1.shipments.bonkorea.carrier === "cj", "송장 반영/상태가 달라요 " + o1.status);
ok(mails("c1@x.test", "발송됐어요").length === 1 && mails("c1@x.test", "발송됐어요")[0].html.includes("123456789012") && mails("c1@x.test")[0].html.includes("CJ대한통운"), "고객 발송 안내 메일이 달라요");
await call(brand, "/api/partner/ship", "POST", { orderId: "O1", carrier: "cj", tracking: "123456789012" }, BH); ok(mails("c1@x.test", "발송됐어요").length === 1, "같은 송장으로 고객 메일이 또 나가요");
// 송장: 엑셀 일괄 (행마다 결과)
[s, j] = await call(brand, "/api/partner/ship-bulk", "POST", { rows: [{ orderId: "O1", carrier: "롯데택배", tracking: "998877665544" }, { orderId: "O2", carrier: "cj", tracking: "111122223333" }, { orderId: "O1", carrier: "모름택배", tracking: "111122223333" }, { orderId: "O1", carrier: "cj", tracking: "1" }, { orderId: "", carrier: "cj", tracking: "111122223333" }] }, BH);
ok(s === 200 && j.done === 1 && j.results[0].ok && /내 브랜드/.test(j.results[1].error) && /택배사/.test(j.results[2].error) && /송장/.test(j.results[3].error) && /주문번호/.test(j.results[4].error), "일괄 입력 결과가 달라요 " + JSON.stringify(j.results));
o1 = await lib.orders().get("O1", { type: "json" }); ok(o1.shipments.bonkorea.carrier === "lotte" && o1.shipments.bonkorea.tracking === "998877665544", "일괄 입력이 반영되지 않아요");
[s, j] = await call(brand, "/api/partner/ship-bulk", "POST", { rows: [{ orderId: "O1", carrier: "cj", tracking: "5555666677778888" }] }, gh); ok(s === 200 && j.done === 1, "GRAFEN 일괄 입력 실패");
o1 = await lib.orders().get("O1", { type: "json" }); ok(o1.status === "shipped", "모든 브랜드 송장 입력 후 발송 완료가 안 돼요");
[s, j] = await call(brand, "/api/partner/ship-bulk", "POST", { rows: [{ orderId: "O1", carrier: "cj", tracking: "5555666677778888" }] }); ok(s === 401, "로그인 없이 일괄 입력이 돼요");
ok(Buffer.from(await (await brand(new Request(H + "/api/partner/orders.csv", { headers: BH }))).arrayBuffer()).toString("utf-8").includes("O1") === false, "발송한 주문이 대기 엑셀에 남아요");

// 재고: 파트너가 수량을 두면 주문 차단/차감/자동 품절/복구
[s, j] = await call(brand, "/api/partner/stock", "POST", { id: "livna-calm", qty: 3 }, BH); ok(s === 400, "다른 브랜드 재고를 바꿀 수 있어요");
[s, j] = await call(brand, "/api/partner/stock", "POST", { id: "bonkorea-cl", qty: 1 }, BH); ok(s === 200, "재고 수량 저장 실패");
[s, j] = await call(brand, "/api/partner/stock", "GET", null, BH); ok(j.products.length > 0 && j.products.find((x) => x.id === "bonkorea-cl").qty === 1, "재고 목록이 달라요");
[s, j] = await call(brand, "/api/partner/stock", "GET"); ok(s === 401, "로그인 없이 재고가 보여요");
const cu = (id, name) => ({ cookie: lib.makeCookie("sk_s", { id, name, email: id + "@x.test", phone: "010-0000-0000", exp: Date.now() + 36e5 }, 3600), "content-type": "application/json" });
const U1 = cu("u1", "김민수"), U2 = cu("u2", "다른사람");
const shipBody = { name: "홍길동", phone: "010-1111-2222", zip: "12345", addr1: "서울", addr2: "", memo: "" };
[s, j] = await call(orderApi, "/api/order", "POST", { items: [{ id: "bonkorea-cl", q: 2 }], ship: shipBody }, U1); ok(s === 400 && /재고/.test(j.error), "재고보다 많이 주문돼요 " + JSON.stringify(j));
[s, j] = await call(orderApi, "/api/order", "POST", { items: [{ id: "bonkorea-cl", q: 1 }], ship: shipBody }, U2); ok(s === 200, "재고 1개 주문 실패 " + JSON.stringify(j));
const O4 = j.orderId;
const nm = MAILS.length;
[s, j] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_x", orderId: O4, amount: 29900 + 3000 }, U2); ok(s === 200, "결제 확인 실패 " + JSON.stringify(j));
ok(MAILS.slice(nm).some((m) => m.to[0] === "bk@x.test" && m.subject.includes("새 주문 " + O4)), "결제 직후 브랜드 알림 메일이 안 나가요");
ok(MAILS.slice(nm).some((m) => m.to[0] === "me@x.test" && m.subject.includes(O4)), "결제 직후 운영자 알림이 없어요");
let o4 = await lib.orders().get(O4, { type: "json" }); ok(o4.status === "paid" && o4.sent.bonkorea, "결제 후 상태/알림 기록이 달라요");
[s, j] = await call(site, "/api/stock"); ok(j.soldOut.includes("bonkorea-cl"), "재고 0이 되어도 품절 표시가 안 돼요");
[s, j] = await call(orderApi, "/api/order", "POST", { items: [{ id: "bonkorea-cl", q: 1 }], ship: shipBody }, U2); ok(s === 400, "품절 제품이 주문돼요");
[s, j] = await call(brand, "/api/partner/stock", "POST", { id: "bonkorea-cl", qty: 5 }, BH); [s, j] = await call(site, "/api/stock"); ok(!j.soldOut.includes("bonkorea-cl"), "재고를 채웠는데 품절이 안 풀려요");
await call(brand, "/api/partner/stock", "POST", { id: "bonkorea-vit", soldOut: true }, BH); [s, j] = await call(site, "/api/stock"); ok(j.soldOut.includes("bonkorea-vit"), "수동 품절 표시가 안 돼요");
await call(brand, "/api/partner/stock", "POST", { id: "bonkorea-vit", soldOut: false }, BH);

// CS: 문의 / 교환 / 반품 / 자동 환불
[s, j] = await call(csApi, "/api/cs/mine"); ok(s === 401, "로그인 없이 CS가 보여요");
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "O1", brand: "bonkorea", type: "inquiry", text: "배송이 언제 오나요?" }, U2); ok(s === 400, "남의 주문으로 문의가 만들어져요");
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "O1", brand: "bonkorea", type: "inquiry", text: "배송이 언제 오나요?" }, U1); ok(s === 200 && j.ticket.status === "open", "문의 생성 실패 " + JSON.stringify(j)); const T1 = j.ticket.id;
ok(MAILS.some((m) => m.to[0] === "bk@x.test" && m.subject.includes("문의 요청")), "문의가 브랜드에 안 알려져요");
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "O1", brand: "bonkorea", type: "inquiry", text: "x" }, U1); ok(s === 400, "한 글자 문의가 통과해요");
[s, j] = await call(csApi, "/api/cs/mine", "GET", null, U2); ok(j.tickets.length === 0, "남의 문의가 보여요");
[s, j] = await call(brand, "/api/partner/cs", "GET", null, BH); ok(j.tickets.length === 1 && j.tickets[0].customer.name === "김민수" && !("userId" in j.tickets[0]), "파트너 CS 목록이 달라요");
[s, j] = await call(brand, "/api/partner/cs", "GET", null, gh); ok(j.tickets.length === 0, "다른 브랜드 CS가 보여요");
[s, j] = await call(brand, "/api/partner/cs/reply", "POST", { id: T1, text: "내일 도착해요." }, gh); ok(s === 404, "다른 브랜드가 답변할 수 있어요");
[s, j] = await call(brand, "/api/partner/cs/reply", "POST", { id: T1, text: "내일 도착해요." }, BH); ok(s === 200 && j.ticket.status === "answered", "파트너 답변 실패");
[s, j] = await call(csApi, "/api/cs/mine", "GET", null, U1); ok(j.tickets[0].messages.length === 2 && !("userId" in j.tickets[0]), "고객이 답변을 못 봐요");
[s, j] = await call(csApi, "/api/cs/reply", "POST", { id: T1, text: "감사합니다" }, U2); ok(s === 404, "남이 내 문의에 답글을 달 수 있어요");
[s, j] = await call(csApi, "/api/cs/reply", "POST", { id: T1, text: "감사합니다" }, U1); ok(j.ticket.status === "open", "고객 재문의 시 답변 대기로 안 돌아가요");
// 반품: 발송 전(GRAFEN은 발송됨, 새 주문 O5는 미발송)
await lib.orders().setJSON("O5", mk("O5", [GF(1)], "paid", 5, { userEmail: "c1@x.test" }));
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "O5", brand: "grafen", type: "return", text: "반품할게요" }, U1); ok(s === 400, "발송 전 주문에 반품이 신청돼요");
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "O1", brand: "bonkorea", type: "return", text: "사이즈가 안 맞아요" }, U1); ok(s === 200, "반품 신청 실패 " + JSON.stringify(j)); const T2 = j.ticket.id;
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "O1", brand: "bonkorea", type: "exchange", text: "교환도" }, U1); ok(s === 400, "진행 중인 반품이 있는데 또 신청돼요");
[s, j] = await call(brand, "/api/partner/cs/received", "POST", { id: T2 }, BH); ok(s === 400, "승인 전에 입고 확인/환불이 돼요");
[s, j] = await call(brand, "/api/partner/cs/decide", "POST", { id: T2, action: "approve", text: "반송해주세요" }, BH); ok(s === 200 && j.ticket.status === "approved", "반품 승인 실패");
TOSS.failCancel = true; TOSS.calls.length = 0;
[s, j] = await call(brand, "/api/partner/cs/received", "POST", { id: T2 }, BH); ok(s === 400 && /취소 불가/.test(j.error) && j.ticket.status === "received", "환불 실패 처리가 달라요 " + JSON.stringify(j));
{ const h = await call(adminApi, "/api/admin/home", "GET", null, A); ok(h[1].cs.refundFail === 1 && h[1].todo.some((x) => x.k === "refundFail"), "환불 실패가 관리자 할 일에 없어요"); }
TOSS.failCancel = false; TOSS.calls.length = 0;
[s, j] = await call(adminApi, "/api/admin/cs/refund", "POST", { id: T2 }, A); ok(s === 200 && j.ticket.status === "refunded", "관리자 환불 재시도 실패 " + JSON.stringify(j));
ok(TOSS.calls.length === 1 && TOSS.calls[0].body.cancelAmount === 59800 && TOSS.calls[0].u.includes("pk_O1"), "부분 환불 금액이 달라요 " + JSON.stringify(TOSS.calls));
o1 = await lib.orders().get("O1", { type: "json" }); ok(o1.refunds.length === 1 && o1.refunds[0].amount === 59800, "환불 기록이 없어요");
[s, j] = await call(brand, "/api/partner/cs/received", "POST", { id: T2 }, BH); ok(s === 400 && TOSS.calls.length === 1, "같은 반품이 두 번 환불돼요");
ok(mails("c1@x.test", "환불이 완료").length === 1, "환불 안내 메일이 없어요");
// 교환 + 운영자 확인 요청
await lib.orders().setJSON("O6", mk("O6", [GF(1)], "shipped", 40, { shipments: { grafen: { carrier: "cj", tracking: "777788889999", at: ago(30) } } }));
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "O6", brand: "grafen", type: "exchange", text: "불량이에요" }, U1); const T3 = j.ticket.id;
[s, j] = await call(brand, "/api/partner/cs/decide", "POST", { id: T3, action: "approve" }, gh); [s, j] = await call(brand, "/api/partner/cs/exchange-sent", "POST", { id: T3, tracking: "321321321" }, gh); ok(s === 200 && j.ticket.status === "closed", "교환품 발송 처리 실패");
[s, j] = await call(csApi, "/api/cs/escalate", "POST", { id: T1 }, U1); ok(s === 200 && j.ticket.escalated, "운영자 확인 요청 실패");
{ const h = await call(adminApi, "/api/admin/home", "GET", null, A); ok(h[1].cs.escalated === 1 && h[1].todo.some((x) => x.k === "escalated"), "확인 요청이 관리자 할 일에 없어요"); }
[s, j] = await call(adminApi, "/api/admin/cs", "GET", null, A); ok(j.tickets.length === 3 && j.tickets.every((t) => !("userId" in t)), "관리자 CS 목록이 달라요");
[s, j] = await call(adminApi, "/api/admin/cs/reply", "POST", { id: T1, text: "운영자가 확인했어요" }, A); ok(s === 200 && j.ticket.messages.slice(-1)[0].from === "admin", "관리자 답변 실패");
[s, j] = await call(adminApi, "/api/admin/cs/close", "POST", { id: T1 }, A); ok(j.ticket.status === "closed", "관리자 종료 실패");
[s] = await call(adminApi, "/api/admin/cs"); ok(s === 401, "로그인 없이 관리자 CS가 보여요");

// 취소: 재고 복구, 브랜드에 즉시 취소 안내(중복 없음)
const stockBefore = (await lib.loadStock())["bonkorea-cl"].qty;
[s, j] = await call(adminApi, "/api/admin/cancel", "POST", { orderId: O4 }, A); ok(s === 200, "관리자 취소 실패 " + JSON.stringify(j));
ok((await lib.loadStock())["bonkorea-cl"].qty === stockBefore + 1, "취소해도 재고가 복구되지 않아요");
ok(mails("bk@x.test", "주문 취소 " + O4).length === 1, "취소 즉시 브랜드 안내가 없어요");
const before = MAILS.length; await batch.runBrandBatch({});
ok(!MAILS.slice(before).some((m) => m.subject.includes("취소")), "이미 알린 취소가 아침 메일에 또 나와요");

// 정산: 환불 반영 -> 확정(정산서 메일) -> 송금 완료 표시
[s, j] = await call(adminApi, "/api/admin/settlement?format=json&month=" + month, "GET", null, A);
const sb = j.rows.find((r) => r.name === "본코리아"); ok(s === 200 && sb && sb.sales >= 59800 && sb.refund === 59800 && sb.payout === Math.round((sb.sales - 59800) * 0.9), "정산에 환불이 반영되지 않아요 " + JSON.stringify(sb));
[s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month: month }); ok(s === 401, "로그인 없이 정산 확정이 돼요");
[s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month: "bad" }, A); ok(s === 400, "잘못된 월이 통과해요");
const mm = MAILS.length;
[s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month }, A); ok(s === 200 && j.created && j.settlement.rows.length >= 2, "정산 확정 실패");
ok(MAILS.slice(mm).some((m) => m.to[0] === "bk@x.test" && m.subject.includes("정산서") && m.html.includes("환불")) && MAILS.slice(mm).some((m) => m.to[0] === "gf@x.test" && m.subject.includes("정산서")), "정산서 메일이 안 나가요");
const m2 = MAILS.length; [s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month }, A); ok(j.created === false && MAILS.length === m2, "정산이 두 번 확정/발송돼요");
[s, j] = await call(adminApi, "/api/admin/settlement/paid", "POST", { month, brand: "bonkorea" }, A); ok(s === 200 && j.settlement.paid.bonkorea, "송금 표시 실패");
[s, j] = await call(adminApi, "/api/admin/settlement/paid", "POST", { month, brand: "nobody" }, A); ok(s === 400, "없는 브랜드 송금 표시가 통과해요");
[s, j] = await call(brand, "/api/partner/settlements", "GET", null, BH); ok(j.settlements.length === 1 && j.settlements[0].paidAt && j.settlements[0].brand === "bonkorea", "파트너 정산 내역이 달라요 " + JSON.stringify(j));
[s, j] = await call(brand, "/api/partner/settlements", "GET", null, gh); ok(j.settlements.length === 1 && !j.settlements[0].paidAt, "다른 브랜드 송금 표시가 보여요");

// 홈 요약
[s, j] = await call(brand, "/api/partner/home", "GET", null, BH); ok(s === 200 && j.brand === "본코리아" && j.counts.done === 1 && j.counts.todo === 0 && j.cs.open === 0 && Array.isArray(j.stock.alerts) && j.month.refund === 59800, "파트너 홈 요약이 달라요 " + JSON.stringify(j.counts) + JSON.stringify(j.month));
[s, j] = await call(brand, "/api/partner/home"); ok(s === 401, "로그인 없이 파트너 홈이 보여요");
[s, j] = await call(adminApi, "/api/admin/home", "GET", null, A); ok(s === 200 && j.flow.wait >= 1 && Array.isArray(j.brands) && j.brands.some((b) => b.name === "본코리아" && b.hasCode) && j.cs && j.month.m === month, "관리자 홈 요약이 달라요 " + JSON.stringify(j.flow));
[s, j] = await call(adminApi, "/api/admin/home"); ok(s === 401, "로그인 없이 관리자 홈이 보여요");
// 아침 요약: 처리할 일이 있으면 대표님께 메일
const mo = MAILS.length; await brandmail(); ok(MAILS.slice(mo).some((m) => m.to[0] === "me@x.test" && m.subject.includes("오늘 처리할 일")), "대표님 아침 요약 메일이 안 나가요");

// 코드 재발급/폐기/잠금
[s, j] = await call(adminApi, "/api/admin/partners/issue", "POST", { brand: "bonkorea" }, A); const codeB2 = j.code;
[s, j] = await call(brand, "/api/partner/orders", "GET", null, BH); ok(s === 401, "재발급 후에도 이전 로그인이 유지돼요");
[s, j] = await call(brand, "/api/partner/login", "POST", { code: codeB }, { "x-nf-client-connection-ip": "5.5.5.4" }); ok(s === 401, "재발급 후에도 이전 코드가 통과해요");
[s, j] = await call(brand, "/api/partner/login", "POST", { code: codeB2 }, { "x-nf-client-connection-ip": "5.5.5.5" }); ok(s === 200, "새 코드 로그인 실패");
[s, j] = await call(adminApi, "/api/admin/partners", "GET", null, A); ok(s === 200 && j.dir && j.partners.find((x) => x.key === "bonkorea").issuedAt && !JSON.stringify(j).includes(codeB2), "코드 목록이 달라요(코드 원문이 노출되면 안 돼요)");
await call(adminApi, "/api/admin/partners/revoke", "POST", { brand: "grafen" }, A);
[s, j] = await call(brand, "/api/partner/orders", "GET", null, gh); ok(s === 401, "폐기한 브랜드가 접속돼요");
for (let i = 0; i < 5; i++) await call(brand, "/api/partner/login", "POST", { code: "ZZZZ-ZZZZ-ZZZZ-ZZ" + i }, { "x-nf-client-connection-ip": "6.6.6.6" });
[s, j] = await call(brand, "/api/partner/login", "POST", { code: codeB2 }, { "x-nf-client-connection-ip": "6.6.6.6" }); ok(s === 429, "코드 5회 오입력 뒤에도 로그인이 돼요");
console.log(errs.length ? "FAIL\n" + errs.join("\n") : "OK: 관리자 API 시험 통과"); process.exit(errs.length ? 1 : 0);
