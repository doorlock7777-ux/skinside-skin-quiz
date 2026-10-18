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
const TOSS = { calls: [], failCancel: false, pay: {}, confirmFail: null, confirmThrow: false, seq: 0 };
const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st });
globalThis.fetch = async (u, o) => {
  const url = String(u);
  if (url.includes("api.tosspayments.com")) {
    if (!o || !o.method || o.method === "GET") { const k = decodeURIComponent(url.split("/").pop()); return TOSS.pay[k] ? J(TOSS.pay[k]) : J({ code: "NOT_FOUND_PAYMENT", message: "없음" }, 404); }
    const body = JSON.parse(o.body || "{}");
    TOSS.calls.push({ u: url, body });
    if (url.endsWith("/confirm")) { if (TOSS.confirmThrow) throw new Error("net"); if (TOSS.confirmFail) return J(TOSS.confirmFail, 400); }
    if (url.endsWith("/cancel")) { if (TOSS.failCancel) return J({ message: "취소 불가" }, 400); return J({ paymentKey: "x", cancels: [{ cancelAmount: body.cancelAmount || 0, transactionKey: "tx-own-" + (++TOSS.seq), canceledAt: new Date().toISOString() }] }); }
    return J({ paymentKey: "pk_" + (body.orderId || ""), method: "카드" });
  }
  if (url.includes("api.resend.com")) { MAILS.push(JSON.parse(o.body)); return new Response("{}", { status: 200 }); }
  if (url.includes("/data/products.json")) return new Response(products, { headers: { "content-type": "application/json" } });
  return realFetch(u, o);
};
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
const sb = j.rows.find((r) => r.name === "본코리아"); ok(s === 200 && sb && sb.sales >= 59800 && sb.refund === 59800 + 29900 && sb.payout === Math.round((sb.sales - 59800 - 29900) * 0.9), "정산에 환불이 반영되지 않아요 " + JSON.stringify(sb));
[s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month: month }); ok(s === 401, "로그인 없이 정산 확정이 돼요");
[s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month: "bad" }, A); ok(s === 400, "잘못된 월이 통과해요");
[s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month }, A); ok(s === 400 && /끝나지 않은/.test(j.error), "진행 중인 달이 확정돼요 " + JSON.stringify(j));
process.env.SETTLE_TEST_MONTH = "2099-01"; /* 시험에서만: 이번 달을 끝난 달로 취급 */
const mm = MAILS.length;
[s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month }, A); ok(s === 200 && j.created && j.settlement.rows.length >= 2, "정산 확정 실패");
ok(MAILS.slice(mm).some((m) => m.to[0] === "bk@x.test" && m.subject.includes("정산서") && m.html.includes("환불")) && MAILS.slice(mm).some((m) => m.to[0] === "gf@x.test" && m.subject.includes("정산서")), "정산서 메일이 안 나가요");
const m2 = MAILS.length; [s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month }, A); ok(j.created === false && MAILS.length === m2, "정산이 두 번 확정/발송돼요");
[s, j] = await call(adminApi, "/api/admin/settlement/paid", "POST", { month, brand: "bonkorea" }, A); ok(s === 200 && j.settlement.paid.bonkorea, "송금 표시 실패");
[s, j] = await call(adminApi, "/api/admin/settlement/paid", "POST", { month, brand: "nobody" }, A); ok(s === 400, "없는 브랜드 송금 표시가 통과해요");
[s, j] = await call(brand, "/api/partner/settlements", "GET", null, BH); ok(j.settlements.length === 1 && j.settlements[0].paidAt && j.settlements[0].brand === "bonkorea", "파트너 정산 내역이 달라요 " + JSON.stringify(j));
[s, j] = await call(brand, "/api/partner/settlements", "GET", null, gh); ok(j.settlements.length === 1 && !j.settlements[0].paidAt, "다른 브랜드 송금 표시가 보여요");

// 홈 요약
[s, j] = await call(brand, "/api/partner/home", "GET", null, BH); ok(s === 200 && j.brand === "본코리아" && j.counts.done === 1 && j.counts.todo === 0 && j.cs.open === 0 && Array.isArray(j.stock.alerts) && j.month.refund === 59800 + 29900, "파트너 홈 요약이 달라요 " + JSON.stringify(j.counts) + JSON.stringify(j.month));
[s, j] = await call(brand, "/api/partner/home"); ok(s === 401, "로그인 없이 파트너 홈이 보여요");
[s, j] = await call(adminApi, "/api/admin/home", "GET", null, A); ok(s === 200 && j.flow.wait >= 1 && Array.isArray(j.brands) && j.brands.some((b) => b.name === "본코리아" && b.hasCode) && j.cs && j.month.m === month, "관리자 홈 요약이 달라요 " + JSON.stringify(j.flow));
[s, j] = await call(adminApi, "/api/admin/home"); ok(s === 401, "로그인 없이 관리자 홈이 보여요");
// 아침 요약: 처리할 일이 있으면 대표님께 메일
const mo = MAILS.length; await brandmail(); ok(MAILS.slice(mo).some((m) => m.to[0] === "me@x.test" && m.subject.includes("오늘 처리할 일")), "대표님 아침 요약 메일이 안 나가요");

// 부가세 신고용 매출 자료
const reviewsApi = (await import(pathToFileURL(path.join(T, "functions/reviews.mjs")))).default;
await lib.orders().setJSON("O7", mk("O7", [BK(1)], "shipped", 3, { method: "간편결제", shipments: { bonkorea: { carrier: "cj", tracking: "700070007000", at: ago(2) } } }));
await lib.orders().setJSON("O8", mk("O8", [BK(1)], "paid", 3, { method: "가상계좌" }));
[s, j] = await call(brand, "/api/partner/vat?from=" + month + "&to=" + month); ok(s === 401, "로그인 없이 부가세 자료가 보여요");
[s, j] = await call(brand, "/api/partner/vat?from=2026-10&to=2025-01", "GET", null, BH); ok(s === 400, "거꾸로 된 기간이 통과해요");
[s, j] = await call(brand, "/api/partner/vat?from=2025-01&to=2026-10", "GET", null, BH); ok(s === 400, "12개월을 넘는 기간이 통과해요");
[s, j] = await call(brand, "/api/partner/vat?from=" + month + "&to=" + month, "GET", null, BH);
ok(s === 200 && j.rows.length === 1 && j.rows[0].gross === 149500 && j.rows[0].refund === 89700 && j.rows[0].net === 59800 && j.rows[0].card === 29900 && j.rows[0].other === 29900 && j.rows[0].supply === 54364 && j.rows[0].vat === 5436 && j.total.net === 59800, "부가세 월별 내역이 달라요 " + JSON.stringify(j.rows && j.rows[0]));
[s, j] = await call(brand, "/api/partner/vat?from=2026-08&to=" + month, "GET", null, BH); ok(j.rows.length >= 3 && j.rows[0].net === 0 && j.total.net === 59800, "기간 안의 빈 달 처리가 달라요");
{ const r = await brand(new Request(H + "/api/partner/vat.csv?from=" + month + "&to=" + month, { headers: BH })), t = await r.text(); ok(r.status === 200 && r.headers.get("content-type").includes("csv") && t.includes("부가세 신고기간") && t.includes(month) && t.includes("합계"), "부가세 월별 엑셀이 달라요 " + r.status + r.headers.get("content-type") + t.slice(0, 400)); }
[s, j] = await call(brand, "/api/partner/vat-days?month=" + month, "GET", null, BH); ok(s === 200 && j.days.length >= 1 && j.days.reduce((a, d) => a + d.net, 0) === 59800, "일별 내역이 달라요 " + JSON.stringify(j));
{ const r = await brand(new Request(H + "/api/partner/vat-orders.csv?month=" + month, { headers: BH })), t = await r.text(); ok(r.status === 200 && t.includes("환불") && t.includes("-59800") && t.includes("O7") && !t.includes("O2") && !t.includes("포어 올킬"), "건별 엑셀이 달라요(다른 브랜드 주문이 섞이면 안 돼요)"); }
{ const r = await brand(new Request(H + "/api/partner/vat-days.csv?month=bad", { headers: BH })); ok(r.status === 400, "잘못된 월이 통과해요"); }
[s, j] = await call(brand, "/api/partner/vat?from=" + month + "&to=" + month, "GET", null, gh); ok(j.rows[0].gross === 29700 && !JSON.stringify(j).includes("59800"), "다른 브랜드 매출이 섞여요 " + JSON.stringify(j.rows[0]));

// 재고 실시간 현황 (판매중/품절 개수)
[s, j] = await call(brand, "/api/partner/stock", "GET", null, BH); ok(j.selling + j.soldOut === j.products.length && j.selling >= 1 && j.at, "판매중/품절 개수가 달라요");
await call(brand, "/api/partner/stock", "POST", { id: "bonkorea-vit", soldOut: true }, BH); [s, j] = await call(brand, "/api/partner/stock", "GET", null, BH); ok(j.soldOut === 1, "품절 개수가 바로 반영되지 않아요 " + j.soldOut);
[s, j] = await call(brand, "/api/partner/home", "GET", null, BH); ok(j.stock.soldOut === 1 && j.stock.selling === j.stock.total - 1, "파트너 홈 재고 개수가 달라요");
await call(brand, "/api/partner/stock", "POST", { id: "bonkorea-vit", soldOut: false }, BH);

// 리뷰
const rvNew = async (u, orderId, productId, rating, text) => call(reviewsApi, "/api/review/new", "POST", { orderId, productId, rating, text }, u);
[s, j] = await rvNew({}, "O1", "bonkorea-cl", 5, "아주 좋아요 추천합니다"); ok(s === 401, "로그인 없이 리뷰가 써져요");
await lib.orders().setJSON("O5X", mk("O5X", [GF(1)], "canceled", 5, { canceledAt: ago(1) }));
[s, j] = await rvNew(U1, "O5X", "grafen-patch", 5, "취소된 주문인데 리뷰"); ok(s === 400 && /취소/.test(j.error), "취소된 주문에 리뷰가 써져요 " + JSON.stringify(j));
[s, j] = await rvNew(U2, "O1", "bonkorea-cl", 5, "남의 주문이에요 리뷰"); ok(s === 400, "남의 주문에 리뷰가 써져요");
[s, j] = await rvNew(U1, "O1", "bonkorea-vit", 5, "주문 안 한 제품이에요"); ok(s === 400, "주문하지 않은 제품에 리뷰가 써져요");
[s, j] = await rvNew(U1, "O1", "bonkorea-cl", 0, "별점이 없는 리뷰예요"); ok(s === 400, "별점 0이 통과해요");
[s, j] = await rvNew(U1, "O1", "bonkorea-cl", 5, "짧"); ok(s === 400, "너무 짧은 리뷰가 통과해요");
[s, j] = await rvNew(U1, "O1", "bonkorea-cl", 5, "아주 좋아요 추천합니다"); ok(s === 200, "리뷰 작성 실패 " + JSON.stringify(j));
[s, j] = await rvNew(U1, "O1", "bonkorea-cl", 4, "한 번 더 쓰려는 리뷰예요"); ok(s === 400 && /이미/.test(j.error), "같은 주문 제품에 리뷰가 두 번 써져요");
const nm2 = MAILS.length;
[s, j] = await rvNew(U1, "O6", "grafen-patch", 1, "품질이 너무 별로예요 실망"); ok(s === 200, "낮은 평점 리뷰 작성 실패");
ok(MAILS.slice(nm2).some((m) => m.to[0] === "gf@x.test" && m.subject.includes("낮은 평점")), "낮은 평점 리뷰가 브랜드에 안 알려져요");
for (let i = 0; i < 4; i++) { await lib.orders().setJSON("OR" + i, mk("OR" + i, [BK(1)], "shipped", 20 - i, { shipments: { bonkorea: { carrier: "cj", tracking: "81818181" + i + "0", at: ago(10) } } })); [s, j] = await rvNew(U1, "OR" + i, "bonkorea-cl", i === 3 ? 3 : 5 - (i % 2), "리뷰 내용 " + i + " 입니다 좋아요"); ok(s === 200, "리뷰 반복 작성 실패 " + i); }
// 소비자 화면: 이름은 가려지고, 개인 식별 정보가 없다
[s, j] = await call(reviewsApi, "/api/review?product=bonkorea-cl"); ok(s === 200 && j.count === 5 && j.avg > 0 && j.reviews[0].userName.includes("*") && !JSON.stringify(j).includes("u1") && !JSON.stringify(j).includes("userId"), "소비자 리뷰 목록이 달라요 " + JSON.stringify(j).slice(0, 200));
[s, j] = await call(reviewsApi, "/api/review"); ok(s === 400, "제품 없이 리뷰 목록이 나와요");
[s, j] = await call(reviewsApi, "/api/review/mine", "GET", null, U1); ok(j.done.includes("O1|bonkorea-cl"), "내가 쓴 리뷰 표시가 없어요");
// 브랜드 화면
[s, j] = await call(brand, "/api/partner/reviews", "GET", null, BH); const rv0 = j; ok(s === 200 && j.counts.total === 5 && j.counts.new === 5 && j.counts.low === 0 && j.reviews.length === 5 && j.reviews[0].createdAt >= j.reviews[4].createdAt, "브랜드 리뷰 요약이 달라요 " + JSON.stringify(j.counts));
[s, j] = await call(brand, "/api/partner/reviews", "GET", null, gh); ok(j.counts.total === 1 && j.counts.low === 1 && j.counts.new === 1 && j.reviews[0].low, "다른 브랜드 리뷰가 섞이거나 낮은 평점 집계가 달라요");
[s, j] = await call(brand, "/api/partner/reviews"); ok(s === 401, "로그인 없이 리뷰가 보여요");
const ids = rv0.reviews.map((r) => r.id), hi = rv0.reviews.filter((r) => r.rating >= 4).map((r) => r.id), lowBk = rv0.reviews.find((r) => r.rating < 4);
[s, j] = await call(brand, "/api/partner/reviews/read", "POST", { ids: [ids[0]] }, BH); [s, j] = await call(brand, "/api/partner/reviews", "GET", null, BH); ok(j.counts.new === 4, "개별 확인 처리가 달라요");
await call(brand, "/api/partner/reviews/read", "POST", { ids: "all" }, BH); [s, j] = await call(brand, "/api/partner/reviews", "GET", null, BH); ok(j.counts.new === 0, "모두 확인 처리가 달라요");
[s, j] = await call(brand, "/api/partner/reviews", "GET", null, gh); ok(j.counts.new === 1, "다른 브랜드의 확인 처리가 같이 바뀌어요");
// 베스트 리뷰: 제품당 3개, 4점 이상만
for (const id of hi.slice(0, 3)) { [s, j] = await call(brand, "/api/partner/reviews/best", "POST", { id, on: true }, BH); ok(s === 200, "베스트 선정 실패"); }
[s, j] = await call(brand, "/api/partner/reviews/best", "POST", { id: hi[3], on: true }, BH); ok(s === 400 && /3개/.test(j.error), "베스트가 3개를 넘어요 " + JSON.stringify(j));
[s, j] = await call(brand, "/api/partner/reviews/best", "POST", { id: lowBk.id, on: true }, BH); ok(s === 400, "낮은 점수 리뷰가 베스트가 돼요");
[s, j] = await call(brand, "/api/partner/reviews/best", "POST", { id: rv0.reviews[0].id, on: true }, gh); ok(s === 404, "다른 브랜드 리뷰를 베스트로 고를 수 있어요");
[s, j] = await call(reviewsApi, "/api/review?product=bonkorea-cl"); ok(j.reviews.slice(0, 3).every((r) => r.best) && !j.reviews[3].best && j.reviews.length === 5, "베스트 3개가 맨 위에 오지 않아요 " + JSON.stringify(j.reviews.map((r) => r.best)));
{ const bests = j.reviews.slice(0, 3).map((r) => r.createdAt); ok(bests[0] >= bests[1] && bests[1] >= bests[2], "베스트 안에서 최신순이 아니에요"); const rest = j.reviews.slice(3).map((r) => r.createdAt); ok(rest.every((x, i) => i === 0 || rest[i - 1] >= x), "일반 리뷰가 최신순이 아니에요"); }
// 삭제: 브랜드는 직접 못 지우고 요청만. 관리자가 승인해야 사라진다
[s, j] = await call(brand, "/api/partner/reviews/delete", "POST", { id: lowBk.id }, BH); ok(s === 404, "브랜드가 리뷰를 직접 삭제할 수 있는 경로가 있어요");
[s, j] = await call(brand, "/api/partner/reviews/delete-request", "POST", { id: lowBk.id, reason: "x" }, BH); ok(s === 400, "사유 없는 삭제 요청이 통과해요");
const nm3 = MAILS.length;
[s, j] = await call(brand, "/api/partner/reviews/delete-request", "POST", { id: lowBk.id, reason: "경쟁사의 악의적인 허위 리뷰예요" }, BH); ok(s === 200, "삭제 요청 실패 " + JSON.stringify(j));
ok(MAILS.slice(nm3).some((m) => m.to[0] === "me@x.test" && m.subject.includes("삭제 요청")), "삭제 요청이 대표님께 안 알려져요");
[s, j] = await call(brand, "/api/partner/reviews/delete-request", "POST", { id: lowBk.id, reason: "다시 요청합니다 제발" }, BH); ok(s === 400, "삭제 요청이 중복돼요");
[s, j] = await call(reviewsApi, "/api/review?product=bonkorea-cl"); ok(j.count === 5, "승인 전에 리뷰가 사라져요");
[s, j] = await call(brand, "/api/partner/reviews", "GET", null, BH); ok(j.counts.delReq === 1, "삭제 요청 개수가 달라요");
// 관리자: 모든 브랜드 리뷰, 삭제 요청만 모아보기, 승인/거부
[s, j] = await call(adminApi, "/api/admin/reviews"); ok(s === 401, "로그인 없이 관리자 리뷰가 보여요");
[s, j] = await call(adminApi, "/api/admin/reviews", "GET", null, A); ok(s === 200 && j.counts.total === 6 && j.counts.delReq === 1 && j.reviews.some((r) => r.brand === "grafen") && j.reviews.every((r) => !("userId" in r)), "관리자 리뷰 목록이 달라요 " + JSON.stringify(j.counts));
{ const h = await call(adminApi, "/api/admin/home", "GET", null, A); ok(h[1].reviews.delReq === 1 && h[1].reviews.total === 6 && h[1].todo.some((x) => x.k === "reviewDel") && h[1].stock.selling + h[1].stock.soldOut > 0, "관리자 홈에 리뷰/재고 요약이 없어요 " + JSON.stringify(h[1].reviews)); }
[s, j] = await call(adminApi, "/api/admin/reviews/decide", "POST", { id: lowBk.id, action: "approve" }); ok(s === 401, "로그인 없이 삭제 승인이 돼요");
[s, j] = await call(adminApi, "/api/admin/reviews/decide", "POST", { id: hi[0], action: "approve" }, A); ok(s === 400, "요청 없는 리뷰가 승인으로 지워져요 " + s + JSON.stringify(j));
const nm4 = MAILS.length;
[s, j] = await call(adminApi, "/api/admin/reviews/decide", "POST", { id: lowBk.id, action: "reject" }, A); ok(s === 200, "삭제 거부 실패");
ok(MAILS.slice(nm4).some((m) => m.to[0] === "bk@x.test" && m.subject.includes("거부")), "거부 결과가 브랜드에 안 알려져요");
[s, j] = await call(brand, "/api/partner/reviews/delete-request", "POST", { id: lowBk.id, reason: "거부당했지만 다시 요청해요" }, BH); ok(s === 400, "거부된 리뷰에 다시 삭제 요청이 돼요");
[s, j] = await call(reviewsApi, "/api/review?product=bonkorea-cl"); ok(j.count === 5, "거부했는데 리뷰가 사라져요");
const tgt = hi[3]; [s, j] = await call(brand, "/api/partner/reviews/delete-request", "POST", { id: tgt, reason: "광고성 악성 리뷰예요 확인 바랍니다" }, BH); ok(s === 200, "두 번째 삭제 요청 실패");
[s, j] = await call(adminApi, "/api/admin/reviews/decide", "POST", { id: tgt, action: "approve" }, A); ok(s === 200, "삭제 승인 실패");
[s, j] = await call(reviewsApi, "/api/review?product=bonkorea-cl"); ok(j.count === 4 && !j.reviews.some((r) => r.id === tgt), "승인했는데 소비자 화면에서 안 사라져요");
[s, j] = await call(brand, "/api/partner/reviews", "GET", null, BH); ok(j.counts.total === 4 && !j.reviews.some((r) => r.id === tgt), "승인한 리뷰가 브랜드 화면에 남아요");
[s, j] = await call(adminApi, "/api/admin/reviews/decide", "POST", { id: tgt, action: "approve" }, A); ok(s === 400, "이미 삭제한 리뷰가 다시 처리돼요");
[s, j] = await call(adminApi, "/api/admin/reviews/best", "POST", { id: hi[1], on: false }, A); ok(s === 200, "관리자 베스트 해제 실패");
[s, j] = await call(adminApi, "/api/admin/reviews/decide", "POST", { id: hi[2], action: "delete" }, A); ok(s === 200, "관리자 직접 삭제 실패");
[s, j] = await call(brand, "/api/partner/home", "GET", null, BH); ok(j.reviews && j.reviews.total === 3 && j.reviews.delReq === 0 && j.reviews.low === 0, "파트너 홈 리뷰 요약이 달라요 " + JSON.stringify(j.reviews));

// ===== 정산 구멍 점검 =====
delete process.env.SETTLE_TEST_MONTH;
const money = await import(pathToFileURL(path.join(T, "functions/_money.mjs")));
const home = await import(pathToFileURL(path.join(T, "functions/_home.mjs")));
const settleMod = await import(pathToFileURL(path.join(T, "functions/_settle.mjs")));
const vatMod = await import(pathToFileURL(path.join(T, "functions/_vat.mjs")));
const ctxMod = await import(pathToFileURL(path.join(T, "functions/_ctx.mjs")));
const hookApi = (await import(pathToFileURL(path.join(T, "functions/tosswebhook.mjs")))).default;
const mkp = (id, items, status, h, extra = {}) => { const sub = items.reduce((a, l) => a + l.unit * l.q, 0); return mk(id, items, status, h, { sub, shipFee: 3000, total: sub + 3000, ...extra }); };
const iso = (minAgo) => new Date(Date.now() - minAgo * 6e4).toISOString();
const net = (o, brandKey) => { const r = home.monthSettle([o], month, undefined)[0]; return r ? r : null; };
const lastOrder = (id) => lib.orders().get(id, { type: "json" });
const shippedBK = { bonkorea: { carrier: "cj", tracking: "900900900900", at: ago(2) } };

// 1) 토스에서 직접 전체 취소 -> 웹훅이 환불로 가져옴 (중복 없음)
await lib.orders().setJSON("SKEXT0001", mkp("SKEXT0001", [BK(1)], "paid", 5));
TOSS.pay["pk_SKEXT0001"] = { status: "CANCELED", totalAmount: 32900, balanceAmount: 0, paymentKey: "pk_SKEXT0001", cancels: [{ cancelAmount: 32900, transactionKey: "txA", canceledAt: iso(30) }] };
[s, j] = await call(hookApi, "/api/toss-webhook", "GET"); ok(s === 405, "웹훅이 GET을 받아요");
[s, j] = await call(hookApi, "/api/toss-webhook", "POST", { data: { orderId: "NOPE" } }); ok(s === 200, "없는 주문 웹훅 처리 실패");
[s, j] = await call(hookApi, "/api/toss-webhook", "POST", { data: { orderId: "SKEXT0001" } }); ok(s === 200, "웹훅 처리 실패 " + JSON.stringify(j));
let x = await lastOrder("SKEXT0001");
ok(x.status === "canceled" && x.refunds.length === 2 && x.refunds.reduce((a, r) => a + r.amount, 0) === 32900 && x.refunds.some((r) => r.brand === "_ship" && r.amount === 3000), "외부 취소가 환불로 반영되지 않아요 " + JSON.stringify(x.refunds));
{ const r = home.monthSettle([x], month)[0]; ok(r.sales === 29900 && r.refund === 29900 && r.payout === 0, "외부 취소 주문이 정산에 남아요 " + JSON.stringify(r)); }
await call(hookApi, "/api/toss-webhook", "POST", { data: { orderId: "SKEXT0001" } });
x = await lastOrder("SKEXT0001"); ok(x.refunds.length === 2, "같은 취소가 두 번 기록돼요");

// 2) 방금 낸 취소는 건너뜀(우리 환불과 겹침 방지), 그 뒤 금액이 같은 우리 환불은 같은 건으로 인식
await lib.orders().setJSON("SKREC0002", mkp("SKREC0002", [BK(2)], "shipped", 5, { shipments: shippedBK }));
TOSS.pay["pk_SKREC0002"] = { status: "PARTIAL_CANCELED", totalAmount: 62800, balanceAmount: 52800, paymentKey: "pk_SKREC0002", cancels: [{ cancelAmount: 10000, transactionKey: "txB", canceledAt: iso(0) }] };
await call(hookApi, "/api/toss-webhook", "POST", { data: { orderId: "SKREC0002" } });
x = await lastOrder("SKREC0002"); ok(!(x.refunds || []).length, "방금 낸 취소를 바로 외부 환불로 기록해요");
TOSS.pay["pk_SKREC0002"].cancels[0].canceledAt = iso(30);
await call(hookApi, "/api/toss-webhook", "POST", { data: { orderId: "SKREC0002" } });
x = await lastOrder("SKREC0002"); ok(x.refunds.length === 1 && x.refunds[0].brand === "bonkorea" && x.refunds[0].amount === 10000 && x.refunds[0].source === "toss", "한 브랜드 주문의 외부 부분취소 반영이 달라요 " + JSON.stringify(x.refunds));

// 3) 부분환불 뒤 전체 취소: 이중 차감 없이 합계가 결제액과 같음
TOSS.pay["pk_SKREC0002"].balanceAmount = 52800;
[s, j] = await call(adminApi, "/api/admin/cancel", "POST", { orderId: "SKREC0002" }, A); ok(s === 200, "부분환불 뒤 취소 실패 " + JSON.stringify(j));
x = await lastOrder("SKREC0002");
ok(x.status === "canceled" && x.refunds.reduce((a, r) => a + r.amount, 0) === 62800, "취소 후 환불 합계가 결제액과 달라요 " + JSON.stringify(x.refunds));
{ const r = home.monthSettle([x], month)[0]; ok(r.sales === 59800 && r.refund === 59800 && r.payout === 0, "부분환불+취소가 이중 차감돼요 " + JSON.stringify(r)); }
[s, j] = await call(adminApi, "/api/admin/cancel", "POST", { orderId: "SKREC0002" }, A); ok(s === 400, "취소한 주문이 또 취소돼요");

// 4) 예전 방식 취소(환불 기록 없이 canceled)도 같은 규칙으로 정산에서 0
await lib.orders().setJSON("SKLEG0003", mkp("SKLEG0003", [BK(1)], "canceled", 5, { canceledAt: ago(1) }));
{ const o = await lastOrder("SKLEG0003"); const r = home.monthSettle([o], month)[0]; ok(r.sales === 29900 && r.refund === 29900 && r.payout === 0, "예전 방식 취소 주문이 정산에 남아요 " + JSON.stringify(r)); }

// 5) 결제는 됐는데 주문이 pending 인 경우 대조로 복구 + 알림 + 한 번만
await lib.orders().setJSON("SKPEN0004", mkp("SKPEN0004", [BK(1)], "pending", 1, { paymentKey: undefined, paidAt: undefined }));
TOSS.pay["SKPEN0004"] = { status: "DONE", totalAmount: 32900, paymentKey: "pk_real4", method: "간편결제", approvedAt: iso(20), cancels: null };
const nrec = MAILS.length;
[s, j] = await call(adminApi, "/api/admin/reconcile", "POST", {}); ok(s === 401, "로그인 없이 대조가 돼요");
[s, j] = await call(adminApi, "/api/admin/reconcile", "POST", {}, A); ok(s === 200 && j.result.recovered === 1, "누락된 결제가 복구되지 않아요 " + JSON.stringify(j));
x = await lastOrder("SKPEN0004"); ok(x.status === "paid" && x.paymentKey === "pk_real4" && x.recovered && x.finalized, "복구 후 주문 상태가 달라요 " + JSON.stringify(x));
ok(MAILS.slice(nrec).some((m) => m.to[0] === "bk@x.test" && m.subject.includes("SKPEN0004")), "복구한 주문이 브랜드에 알려지지 않아요");
const nrec2 = MAILS.length; [s, j] = await call(adminApi, "/api/admin/reconcile", "POST", {}, A); ok(j.result.recovered === 0 && MAILS.length === nrec2, "복구가 두 번 실행돼요");

// 6) 결제 확인 경쟁/네트워크 오류: 결제된 주문을 failed 로 덮어쓰지 않음
await lib.orders().setJSON("SKRACE005", mkp("SKRACE005", [BK(1)], "pending", 1, { paymentKey: undefined, paidAt: undefined, userId: "u1" }));
TOSS.confirmThrow = true;
[s, j] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_race", orderId: "SKRACE005", amount: 32900 }, U1); ok(s === 502, "응답 없는 결제 확인이 502가 아니에요 " + s);
x = await lastOrder("SKRACE005"); ok(x.status === "pending", "응답을 못 받았다고 실패로 확정해요 " + x.status);
TOSS.confirmThrow = false; TOSS.confirmFail = { code: "ALREADY_PROCESSED_PAYMENT", message: "이미 처리된 결제" };
TOSS.pay["pk_race"] = { status: "DONE", totalAmount: 32900, paymentKey: "pk_race", method: "카드", approvedAt: iso(1) };
[s, j] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_race", orderId: "SKRACE005", amount: 32900 }, U1); ok(s === 200, "이미 처리된 결제를 실패로 처리해요 " + JSON.stringify(j));
x = await lastOrder("SKRACE005"); ok(x.status === "paid" && x.finalized, "이미 처리된 결제가 주문에 반영되지 않아요 " + x.status);
TOSS.confirmFail = null;
{ const o = await lastOrder("SKRACE005"); o.status = "shipped"; await lib.orders().setJSON(o.id, o);
  TOSS.confirmFail = { code: "X", message: "카드 한도 초과" };
  [s, j] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_race", orderId: "SKRACE005", amount: 32900 }, U1); ok(s === 200 && (await lastOrder("SKRACE005")).status === "shipped", "이미 결제된 주문이 늦은 실패 응답으로 바뀌어요"); TOSS.confirmFail = null; }

// 7) 토스 금액 불일치 표시 -> 확정 막힘 -> 바로잡으면 해제
await lib.orders().setJSON("SKMIS0006", mkp("SKMIS0006", [BK(1)], "paid", 3));
TOSS.pay["pk_SKMIS0006"] = { status: "DONE", totalAmount: 25000, paymentKey: "pk_SKMIS0006", cancels: [] };
await call(hookApi, "/api/toss-webhook", "POST", { data: { orderId: "SKMIS0006" } });
x = await lastOrder("SKMIS0006"); ok(x.mismatch && x.mismatch.toss === 25000, "금액 불일치를 표시하지 않아요");
let osAll = (await ctxMod.allOrders()).filter((o) => o.status !== "pending");
ok(settleMod.settleBlockers(osAll, "2026-07").some((t) => /다른 주문/.test(t)), "금액 불일치가 있는데 확정이 안 막혀요");
TOSS.pay["pk_SKMIS0006"].totalAmount = 32900;
await call(hookApi, "/api/toss-webhook", "POST", { data: { orderId: "SKMIS0006" } });
x = await lastOrder("SKMIS0006"); ok(!x.mismatch, "금액이 맞아졌는데 불일치 표시가 남아요");

// 8) 묶음 주문의 외부 부분취소는 브랜드 미지정 -> 확정 막힘 -> 지정 후 해제
await lib.orders().setJSON("SKMIX0007", mkp("SKMIX0007", [BK(1), GF(1)], "shipped", 4, { shipments: { ...shippedBK, grafen: { carrier: "cj", tracking: "800800800800", at: ago(2) } } }));
TOSS.pay["pk_SKMIX0007"] = { status: "PARTIAL_CANCELED", totalAmount: 42800, balanceAmount: 32900, paymentKey: "pk_SKMIX0007", cancels: [{ cancelAmount: 9900, transactionKey: "txM", canceledAt: iso(40) }] };
await call(hookApi, "/api/toss-webhook", "POST", { data: { orderId: "SKMIX0007" } });
x = await lastOrder("SKMIX0007"); ok(x.refunds.length === 1 && x.refunds[0].brand === "_unassigned", "묶음 주문 외부 부분취소가 미지정으로 안 남아요 " + JSON.stringify(x.refunds));
osAll = (await ctxMod.allOrders()).filter((o) => o.status !== "pending");
ok(settleMod.settleBlockers(osAll, "2026-07").some((t) => /정해지지 않은/.test(t)), "미지정 환불이 있는데 확정이 안 막혀요");
{ const r = home.monthSettle([x], month); ok(r.every((y) => y.refund === 0), "미지정 환불이 임의 브랜드에 잡혀요"); }
[s, j] = await call(adminApi, "/api/admin/settlement?format=json&month=" + month, "GET", null, A); ok(j.unassigned.length === 1 && j.unassigned[0].brands.length === 2 && j.warns.some((w) => /정해지지 않은/.test(w.text)), "미지정 환불이 정산 화면에 안 보여요 " + JSON.stringify(j.unassigned));
[s, j] = await call(adminApi, "/api/admin/refund/assign", "POST", { orderId: "SKMIX0007", index: 0, brand: "minic" }, A); ok(s === 400, "주문에 없는 브랜드로 지정돼요");
[s, j] = await call(adminApi, "/api/admin/refund/assign", "POST", { orderId: "SKMIX0007", index: 0, brand: "grafen" });  ok(s === 401, "로그인 없이 환불 지정이 돼요");
[s, j] = await call(adminApi, "/api/admin/refund/assign", "POST", { orderId: "SKMIX0007", index: 0, brand: "grafen" }, A); ok(s === 200, "환불 지정 실패");
x = await lastOrder("SKMIX0007"); { const r = home.monthSettle([x], month).find((y) => y.brand === "grafen"); ok(r.refund === 9900, "지정한 환불이 정산에 안 잡혀요"); }
osAll = (await ctxMod.allOrders()).filter((o) => o.status !== "pending");
ok(!settleMod.settleBlockers(osAll, "2026-07").length, "모두 해결했는데 확정이 막혀요 " + JSON.stringify(settleMod.settleBlockers(osAll, "2026-07")));
[s, j] = await call(adminApi, "/api/admin/refund/assign", "POST", { orderId: "SKMIX0007", index: 0, brand: "bonkorea" }, A); ok(s === 400, "지정한 환불을 또 바꿀 수 있어요");

// 9) 환불 한도: 같은 브랜드 반품 두 번 불가, 남은 금액만 환불
await lib.orders().setJSON("SKCAP0008", mkp("SKCAP0008", [BK(1), GF(1)], "shipped", 4, { shipments: { ...shippedBK, grafen: { carrier: "cj", tracking: "600600600600", at: ago(2) } } }));
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "SKCAP0008", brand: "bonkorea", type: "return", text: "반품해요" }, U1); ok(s === 200, "반품 신청 실패 " + JSON.stringify(j)); const TC = j.ticket.id;
await call(brand, "/api/partner/cs/decide", "POST", { id: TC, action: "approve" }, BH);
TOSS.calls.length = 0;
[s, j] = await call(brand, "/api/partner/cs/received", "POST", { id: TC }, BH); ok(s === 200 && j.ticket.status === "refunded" && TOSS.calls[0].body.cancelAmount === 29900, "반품 환불 금액이 달라요 " + JSON.stringify(TOSS.calls));
x = await lastOrder("SKCAP0008"); ok(x.refunds[0].tx && x.refunds[0].tx.startsWith("tx-own"), "우리 환불에 토스 거래키가 저장되지 않아요");
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "SKCAP0008", brand: "bonkorea", type: "return", text: "또 반품" }, U1); ok(s === 400 && /환불이 끝난/.test(j.error), "이미 환불된 상품에 반품이 또 신청돼요 " + JSON.stringify(j));
[s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "SKCAP0008", brand: "grafen", type: "return", text: "다른 브랜드 반품" }, U1); ok(s === 200, "다른 브랜드 반품은 가능해야 해요");
// 우리 환불이 토스 대조에서 외부 환불로 중복 기록되지 않음
TOSS.pay["pk_SKCAP0008"] = { status: "PARTIAL_CANCELED", totalAmount: 42800, balanceAmount: 12900, paymentKey: "pk_SKCAP0008", cancels: [{ cancelAmount: 29900, transactionKey: x.refunds[0].tx, canceledAt: iso(30) }] };
await call(hookApi, "/api/toss-webhook", "POST", { data: { orderId: "SKCAP0008" } });
x = await lastOrder("SKCAP0008"); ok(x.refunds.length === 1, "우리가 낸 환불이 대조에서 한 번 더 기록돼요");

// 10) 확정 잠금: 진행 중인 달/미래 달 불가, 확정본은 이후 취소로 바뀌지 않고 취소는 취소한 달에서 차감
for (const m of ["2099-12"]) { [s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month: m }, A); ok(s === 400 && /끝나지 않은/.test(j.error), m + " 달이 확정돼요"); }
{ const snap = JSON.stringify((await settleMod.getSettlement(month)).rows); await lib.orders().setJSON("SKLATE009", mkp("SKLATE009", [BK(1)], "paid", 2)); await call(adminApi, "/api/admin/cancel", "POST", { orderId: "SKLATE009" }, A);
  ok(JSON.stringify((await settleMod.getSettlement(month)).rows) === snap, "확정한 정산이 이후 취소로 바뀌어요"); }

// 11) 마이너스 이월 + 조정
await lib.orders().setJSON("SKCAR0010", mkp("SKCAR0010", [{ id: "minic-allinone", brand: "minic", name: "올인원", optName: "", q: 1, unit: 15000 }], "shipped", 24 * 70, { paidAt: "2026-07-05T03:00:00.000Z", createdAt: "2026-07-05T03:00:00.000Z", refunds: [{ brand: "minic", amount: 15000, at: "2026-08-10T03:00:00.000Z" }], shipments: { minic: { carrier: "cj", tracking: "500500500500", at: ago(2) } } }));
{ const o = await lastOrder("SKCAR0010"); const r = home.monthSettle([o], "2026-08")[0]; ok(r.sales === 0 && r.refund === 15000 && r.payout === -15000, "이월 전 계산이 달라요 " + JSON.stringify(r)); }
[s, j] = await call(adminApi, "/api/admin/settlement/adjust", "POST", { month: "2026-08", brand: "minic", amount: 0, memo: "빈 조정" }, A); ok(s === 400, "금액 0 조정이 통과해요");
[s, j] = await call(adminApi, "/api/admin/settlement/adjust", "POST", { month: "2026-08", brand: "zz", amount: 100, memo: "없는 브랜드" }, A); ok(s === 400, "없는 브랜드 조정이 통과해요");
[s, j] = await call(adminApi, "/api/admin/settlement/adjust", "POST", { month: "2026-08", brand: "minic", amount: 3000, memo: "배송 지연 보상" });  ok(s === 401, "로그인 없이 조정이 돼요");
[s, j] = await call(adminApi, "/api/admin/settlement/adjust", "POST", { month: "2026-08", brand: "minic", amount: 3000, memo: "배송 지연 보상" }, A); ok(s === 200 && j.adj.length === 1, "조정 추가 실패"); const adjId = j.adj[0].id;
[s, j] = await call(adminApi, "/api/admin/settlement/adjust/delete", "POST", { month: "2026-08", id: adjId }, A); ok(s === 200 && j.adj.length === 0, "조정 삭제 실패");
[s, j] = await call(adminApi, "/api/admin/settlement/confirm", "POST", { month: "2026-08" }, A); ok(s === 200 && j.created, "지난 달 확정 실패 " + JSON.stringify(j));
{ const r = j.settlement.rows.find((y) => y.brand === "minic"); ok(r && r.carried === 15000 && r.payout === 0, "마이너스가 이월 처리되지 않아요 " + JSON.stringify(r)); }
[s, j] = await call(adminApi, "/api/admin/settlement/adjust", "POST", { month: "2026-08", brand: "minic", amount: 100, memo: "확정 뒤 조정" }, A); ok(s === 400, "확정된 달에 조정이 들어가요");
{ const adj9 = (await ctxMod.allOrders(), await (await import(pathToFileURL(path.join(T, "functions/_adj.mjs")))).getAdj("2026-09")); ok(adj9.length === 1 && adj9[0].amount === -15000 && adj9[0].auto, "다음 달 이월 조정이 없어요 " + JSON.stringify(adj9));
  const o = await lastOrder("SKCAR0010"); const r = home.monthSettle([o], "2026-09", undefined, adj9)[0]; ok(r && r.payout === -15000, "이월이 다음 달에 반영되지 않아요 " + JSON.stringify(r)); }

// 12) 주의 사항/대조 합계
[s, j] = await call(adminApi, "/api/admin/settlement?format=json&month=" + month, "GET", null, A);
ok(s === 200 && j.warns.some((w) => /수수료율이 0%/.test(w.text)) && j.warns.some((w) => /이메일이 없어/.test(w.text)) && j.last && j.recon && typeof j.recon.net === "number" && j.recon.refundShip >= 3000, "정산 주의 사항/대조 합계가 달라요 " + JSON.stringify(j.warns) + JSON.stringify(j.recon));
{ const os2 = (await ctxMod.allOrders()).filter((o) => o.status !== "pending"); const t = vatMod.txns(os2, "bonkorea", month); ok(t.some((y) => y.kind === "취소") && t.some((y) => y.kind === "환불"), "부가세 자료에 취소/환불 구분이 없어요");
  const v = vatMod.vatMonths(os2, "bonkorea", [month]).total; const h = home.monthSettle(os2, month, "bonkorea")[0]; ok(v.net === h.sales - h.refund, "부가세 순매출과 정산 순매출이 달라요 " + v.net + " vs " + (h.sales - h.refund)); }
{ const os2 = (await ctxMod.allOrders()).filter((o) => o.status !== "pending"); const live = os2.filter((o) => ["paid", "partial", "shipped", "canceled"].includes(o.status) && String(o.paidAt).startsWith(month));
  const paidTotal = live.reduce((a, o) => a + o.total, 0), refundAll = os2.flatMap((o) => money.refundsOf(o)).filter((r) => String(r.at).startsWith(month)).reduce((a, r) => a + r.amount, 0);
  const rows = home.monthSettle(os2, month), brandNet = rows.reduce((a, r) => a + r.sales - r.refund, 0);
  const rep = await settleMod.settleReport(os2, month); ok(rep.recon.gross === paidTotal && rep.recon.net === paidTotal - refundAll, "토스 대조용 합계가 달라요"); void brandNet; }

// ===== 스토어: 주문 취소, 포인트 =====
const pointsApi = (await import(pathToFileURL(path.join(T, "functions/points.mjs")))).default;
const ptMod = await import(pathToFileURL(path.join(T, "functions/_points.mjs")));
const bal = async (U) => (await call(pointsApi, "/api/points", "GET", null, U))[1].balance;
const mkOrder = async (U, body) => call(orderApi, "/api/order", "POST", { items: [{ id: "grafen-patch", q: 1 }], ship: shipBody, ...body }, U);
const paidOrder = async (U, body) => { const [s1, o] = await mkOrder(U, body); if (s1 !== 200) return [s1, o]; const [s2, c] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_" + o.orderId, orderId: o.orderId, amount: o.amount }, U); return [s2, o, c]; };
[s, j] = await call(pointsApi, "/api/points"); ok(s === 401, "로그인 없이 포인트가 보여요");
{ await ptMod.apply("u1", 5000, "earn", "시험 지급", "t-seed");
  const B0 = await bal(U1);
  // 한도: 잔액 초과 / 결제 최소 100원
  [s, j] = await mkOrder(U1, { usePoints: B0 + 1 }); ok(s === 400 && /최대/.test(j.error), "잔액보다 많은 포인트가 사용돼요 " + JSON.stringify(j));
  [s, j] = await mkOrder(U1, { usePoints: 9900 + 3000 }); ok(s === 400, "결제금액이 0원이 되도록 포인트를 쓸 수 있어요");
  ok(await bal(U1) === B0, "거절된 주문이 포인트를 잡아요");
  // 포인트 사용 주문 -> 결제는 줄어든 금액으로
  TOSS.calls.length = 0;
  [s, j] = await mkOrder(U1, { usePoints: 300 }); ok(s === 200 && j.pointsUsed === 300, "포인트 사용 주문 생성 실패 " + JSON.stringify(j)); const OP = j.orderId, payAmt = j.amount;
  let xo = await lastOrder(OP); ok(payAmt === xo.total - 300 && xo.payAmount === payAmt && xo.pointsUsed === 300, "결제금액이 포인트만큼 줄지 않아요 " + JSON.stringify(xo));
  ok(await bal(U1) === B0 - 300, "주문 때 포인트가 잡히지 않아요");
  [s, j] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_" + OP, orderId: OP, amount: xo.total }, U1); ok(s === 400, "포인트를 빼기 전 금액으로 결제가 승인돼요");
  [s, j] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_" + OP, orderId: OP, amount: payAmt }, U1); ok(s === 200 && TOSS.calls.slice(-1)[0].body.amount === payAmt, "토스에 줄어든 금액이 전달되지 않아요 " + JSON.stringify(TOSS.calls));
  xo = await lastOrder(OP); ok(xo.status === "paid", "포인트 주문 결제 확정 실패");
  { const r = home.monthSettle([xo], month)[0]; ok(r.sales === 9900 && r.payout === 9900, "포인트 사용이 브랜드 정산을 줄여요 " + JSON.stringify(r)); }
  // 배송 전에도 리뷰 가능 + 500P 적립, 같은 리뷰 중복 없음
  const B1 = await bal(U1);
  [s, j] = await rvNew(U1, OP, "grafen-patch", 5, "배송 전인데 먼저 씁니다"); ok(s === 200 && j.points === 500, "배송 전 리뷰/적립 실패 " + JSON.stringify(j));
  ok(await bal(U1) === B1 + 500, "리뷰 적립이 500P가 아니에요");
  [s, j] = await rvNew(U1, OP, "grafen-patch", 5, "또 쓰면 안 돼요"); ok(s === 400 && await bal(U1) === B1 + 500, "같은 상품 리뷰로 포인트가 또 적립돼요");
  [s, j] = await call(pointsApi, "/api/points", "GET", null, U1); ok(j.log.some((x) => x.type === "earn" && x.amount === 500) && j.log.some((x) => x.type === "use" && x.amount === -300), "포인트 내역이 달라요 " + JSON.stringify(j.log.slice(0, 3)));
  // 고객 취소: 남의 주문 불가 / 본인 취소 -> 환불, 포인트 반환, 리뷰 회수
  [s, j] = await call(orderApi, "/api/order/cancel", "POST", { orderId: OP }, U2); ok(s === 404, "남의 주문을 취소할 수 있어요");
  [s, j] = await call(orderApi, "/api/order/cancel", "POST", { orderId: OP }); ok(s === 401, "로그인 없이 주문이 취소돼요");
  TOSS.calls.length = 0; const nCancel = MAILS.length;
  [s, j] = await call(orderApi, "/api/order/cancel", "POST", { orderId: OP, reason: "단순 변심" }, U1); ok(s === 200 && j.pointsBack === 300 && j.refundedCash === payAmt, "고객 주문 취소 실패 " + JSON.stringify(j));
  ok(TOSS.calls.length === 1 && TOSS.calls[0].u.includes("/cancel") && TOSS.calls[0].body.cancelAmount === undefined, "토스 환불 요청이 달라요 " + JSON.stringify(TOSS.calls));
  xo = await lastOrder(OP); ok(xo.status === "canceled" && xo.canceledBy === "customer" && xo.refunds.reduce((a, r) => a + r.amount, 0) === xo.total && xo.refunds.reduce((a, r) => a + (r.cash || 0), 0) === payAmt, "취소 환불 기록이 달라요 " + JSON.stringify(xo.refunds));
  ok(await bal(U1) === B0, "취소 후 포인트가 원래대로 돌아오지 않아요(사용분 반환 + 리뷰 적립 회수): " + (await bal(U1)) + " vs " + B0);
  ok(mails("gf@x.test", "주문 취소 " + OP).length === 1, "고객 취소가 브랜드에 안 알려져요");
  [s, j] = await call(reviewsApi, "/api/review?product=grafen-patch"); ok(!j.reviews.some((r) => r.text.includes("배송 전인데")), "취소된 주문의 리뷰가 남아요");
  [s, j] = await call(orderApi, "/api/order/cancel", "POST", { orderId: OP }, U1); ok(s === 400, "취소한 주문이 또 취소돼요");
  ok(await bal(U1) === B0, "두 번째 취소 시도가 포인트를 또 줘요");
  { const r = home.monthSettle([xo], month)[0]; ok(r.sales === 9900 && r.refund === 9900 && r.payout === 0, "포인트 사용 주문 취소가 정산에 남아요 " + JSON.stringify(r)); }
  // 발송이 시작된 주문은 고객이 직접 취소할 수 없다 (교환·반품으로)
  [s, j, x] = await paidOrder(U1, {}); const OS = j.orderId;
  { const o = await lastOrder(OS); o.shipments = { grafen: { carrier: "cj", tracking: "123123123123", at: ago(1) } }; o.status = "shipped"; await lib.orders().setJSON(OS, o); }
  [s, j] = await call(orderApi, "/api/order/cancel", "POST", { orderId: OS }, U1); ok(s === 400 && /발송/.test(j.error), "발송된 주문을 고객이 취소해요 " + JSON.stringify(j));
  // 결제 전 주문은 취소 대상이 아님, 토스 취소 실패 시 주문 유지
  [s, j] = await mkOrder(U1, {}); const OPEND = j.orderId;
  [s, j] = await call(orderApi, "/api/order/cancel", "POST", { orderId: OPEND }, U1); ok(s === 400, "결제 전 주문이 취소돼요");
  [s, j, x] = await paidOrder(U1, { usePoints: 100 }); const OF = j.orderId; const BF = await bal(U1);
  TOSS.failCancel = true; [s, j] = await call(orderApi, "/api/order/cancel", "POST", { orderId: OF }, U1); TOSS.failCancel = false;
  ok(s === 400 && (await lastOrder(OF)).status === "paid" && await bal(U1) === BF, "환불 실패인데 주문/포인트가 바뀌어요");

  // 부분 반품 환불: 포인트 사용 비율대로 나눠서 환불
  await lib.orders().setJSON("SKPT0005", mkp("SKPT0005", [BK(1), GF(1)], "shipped", 4, { pointsUsed: 1000, payAmount: 42800 - 1000, shipments: { ...shippedBK, grafen: { carrier: "cj", tracking: "300300300300", at: ago(2) } } }));
  [s, j] = await call(csApi, "/api/cs/new", "POST", { orderId: "SKPT0005", brand: "bonkorea", type: "return", text: "반품합니다" }, U1); ok(s === 200, "포인트 주문 반품 신청 실패 " + JSON.stringify(j)); const TP = j.ticket.id;
  await call(brand, "/api/partner/cs/decide", "POST", { id: TP, action: "approve" }, BH);
  const BP = await bal(U1); TOSS.calls.length = 0;
  [s, j] = await call(brand, "/api/partner/cs/received", "POST", { id: TP }, BH); const pp = Math.round(29900 * 1000 / 42800);
  ok(s === 200 && TOSS.calls[0].body.cancelAmount === 29900 - pp, "포인트 주문의 부분 환불 금액이 달라요 " + JSON.stringify(TOSS.calls));
  ok(await bal(U1) === BP + pp, "부분 환불의 포인트 몫이 반환되지 않아요");
  xo = await lastOrder("SKPT0005"); ok(xo.refunds[0].amount === 29900 && xo.refunds[0].cash === 29900 - pp && xo.refunds[0].points === pp, "부분 환불 기록이 달라요 " + JSON.stringify(xo.refunds));
  [s, j] = await call(adminApi, "/api/admin/cancel", "POST", { orderId: "SKPT0005" }, A); ok(s === 200, "포인트 주문 부분환불 뒤 취소 실패 " + JSON.stringify(j));
  xo = await lastOrder("SKPT0005");
  ok(xo.refunds.reduce((a, r) => a + r.amount, 0) === 42800 && xo.refunds.reduce((a, r) => a + (r.cash || 0), 0) === 41800 && xo.pointsReturned === 1000 && await bal(U1) === BP + 1000, "부분환불 뒤 취소 합계가 결제/포인트와 달라요 " + JSON.stringify({ r: xo.refunds, pr: xo.pointsReturned }));
  { const r = home.monthSettle([xo], month); ok(r.every((y) => y.sales === y.refund), "포인트 주문 취소가 정산에 남아요"); }

  // 결제 안 한 주문의 포인트는 새 주문을 만들 때 풀리고, 뒤늦게 결제되면 다시 잡힌다 / 잔액이 모자라면 승인 전에 막는다
  const BQ = await bal(U1);
  [s, j] = await mkOrder(U1, { usePoints: 200 }); const OA = j.orderId; ok(await bal(U1) === BQ - 200, "주문 A 포인트 잡기 실패");
  [s, j] = await mkOrder(U1, { usePoints: 100 }); const OB = j.orderId; ok(await bal(U1) === BQ - 100, "새 주문을 만들어도 이전 미결제 주문의 포인트가 안 풀려요 " + (await bal(U1)));
  TOSS.calls.length = 0; [s, j] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_" + OA, orderId: OA, amount: (await lastOrder(OA)).payAmount }, U1); ok(s === 200 && await bal(U1) === BQ - 300, "풀린 주문이 뒤늦게 결제됐는데 포인트를 다시 안 잡아요 " + (await bal(U1)));
  { const keep = await bal(U1); await ptMod.apply("u1", -keep, "use", "비우기", "t-drain"); const n0 = TOSS.calls.length;
    [s, j] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_" + OB, orderId: OB, amount: (await lastOrder(OB)).payAmount }, U1);
    ok(s === 200 || s === 409, "응답 이상"); ok((await lastOrder(OB)).status === "paid" || TOSS.calls.length === n0, "잔액이 모자란데 토스 승인이 나가요"); await ptMod.apply("u1", keep, "earn", "복구", "t-restore"); }
  // 결제 실패하면 포인트가 바로 돌아온다
  { const b2 = await bal(U1); [s, j] = await mkOrder(U1, { usePoints: 150 }); const OX = j.orderId; ok(await bal(U1) === b2 - 150, "포인트 잡기 실패");
    TOSS.confirmFail = { code: "REJECT_CARD_COMPANY", message: "카드사 거절" }; [s, j] = await call(confirmApi, "/api/confirm", "POST", { paymentKey: "pk_x", orderId: OX, amount: (await lastOrder(OX)).payAmount }, U1); TOSS.confirmFail = null;
    ok(s === 400 && await bal(U1) === b2, "결제 실패했는데 포인트가 안 돌아와요 " + (await bal(U1)) + " vs " + b2); }
  // 대조 합계: 포인트는 결제액에서 빠지고 플랫폼 부담으로 표시
  { const os2 = (await ctxMod.allOrders()).filter((o) => o.status !== "pending"); const rep = await settleMod.settleReport(os2, month);
    ok(rep.recon.pointsUsed > 0 && rep.recon.cashPaid === rep.recon.gross - rep.recon.pointsUsed, "대조 합계에 포인트 몫이 반영되지 않아요 " + JSON.stringify(rep.recon)); }
}

// 포토리뷰
{
  const jpg = (n = 100) => "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 1)]).toString("base64");
  await lib.orders().setJSON("OPH", mk("OPH", [BK(1)], "paid", 2));
  const rvP = (photos, orderId = "OPH") => call(reviewsApi, "/api/review/new", "POST", { orderId, productId: "bonkorea-cl", rating: 5, text: "사진도 같이 올려요 좋아요", photos }, U1);
  [s, j] = await rvP([jpg(), jpg(), jpg(), jpg()]); ok(s === 400 && /3장/.test(j.error), "사진이 4장 이상 올라가요 " + JSON.stringify(j));
  [s, j] = await rvP(["data:text/html;base64,PGI+"]); ok(s === 400, "이미지가 아닌 파일이 통과해요");
  [s, j] = await rvP(["data:image/jpeg;base64," + Buffer.from("not a jpeg at all").toString("base64")]); ok(s === 400 && /올바르지/.test(j.error), "가짜 사진 파일이 통과해요 " + JSON.stringify(j));
  [s, j] = await rvP([jpg(800 * 1024)]); ok(s === 400 && /커요/.test(j.error), "너무 큰 사진이 통과해요");
  [s, j] = await call(reviewsApi, "/api/review/mine", "GET", null, U1); ok(!j.done.includes("OPH|bonkorea-cl"), "실패한 사진 리뷰가 등록돼요");
  [s, j] = await rvP([jpg(), jpg()]); ok(s === 200, "사진 리뷰 작성 실패 " + JSON.stringify(j));
  [s, j] = await call(reviewsApi, "/api/review?product=bonkorea-cl"); const rp = j.reviews.find((r) => r.photos && r.photos.length === 2); ok(rp && /^\/api\/review\/img\?id=/.test(rp.photos[0]), "소비자 리뷰에 사진 주소가 없어요 " + JSON.stringify(j.reviews.map((r) => r.photos)));
  const r0 = await reviewsApi(new Request(H + rp.photos[0])); ok(r0.status === 200 && r0.headers.get("content-type") === "image/jpeg" && (await r0.arrayBuffer()).byteLength === 104, "사진이 내려오지 않아요 " + r0.status);
  const r1 = await reviewsApi(new Request(H + "/api/review/img?id=" + rp.id + "&n=2")); ok(r1.status === 404, "없는 사진 번호가 404가 아니에요");
  const r2 = await reviewsApi(new Request(H + "/api/review/img?id=../x&n=0")); ok(r2.status === 404 || r2.status === 400, "이상한 사진 주소가 통과해요");
  [s, j] = await call(brand, "/api/partner/reviews", "GET", null, BH); ok(j.reviews.some((r) => r.photos && r.photos.length === 2), "브랜드 리뷰 목록에 사진이 없어요");
  [s, j] = await call(adminApi, "/api/admin/reviews", "GET", null, A); ok(j.reviews.some((r) => r.photos && r.photos.length === 2), "관리자 리뷰 목록에 사진이 없어요");
}
// CS 자동 입력 문구
{
  [s, j] = await call(brand, "/api/partner/cs/templates"); ok(s === 401, "로그인 없이 자동 입력 문구가 보여요");
  [s, j] = await call(brand, "/api/partner/cs/templates", "GET", null, BH); ok(s === 200 && j.templates.length === 4 && j.brand && j.templates.every((x) => x.title && x.text), "기본 문구 4개가 아니에요 " + JSON.stringify(j).slice(0, 200));
  [s, j] = await call(brand, "/api/partner/cs/templates/add", "POST", { title: "재입고", text: "" }, BH); ok(s === 400, "내용 없는 문구가 추가돼요");
  [s, j] = await call(brand, "/api/partner/cs/templates/add", "POST", { title: "재입고 문의", text: "재입고는 다음 주 월요일 예정이에요." }, BH); ok(s === 200 && j.templates.length === 5, "문구 추가 실패");
  const tid = j.templates[4].id;
  [s, j] = await call(brand, "/api/partner/cs/templates", "GET", null, gh); ok(j.templates.length === 4 && !j.templates.some((x) => x.id === tid), "다른 브랜드에 문구가 섞여요");
  [s, j] = await call(adminApi, "/api/admin/cs/templates", "GET", null, A); ok(s === 200 && j.templates.length === 4, "관리자 문구가 브랜드와 섞여요");
  [s, j] = await call(adminApi, "/api/admin/cs/templates/add", "POST", { title: "운영자 안내", text: "스킨인사이드 운영팀입니다. 확인해서 안내드릴게요." }, A); ok(s === 200 && j.templates.length === 5, "관리자 문구 추가 실패");
  [s, j] = await call(brand, "/api/partner/cs/templates", "GET", null, BH); ok(j.templates.length === 5, "관리자 문구가 브랜드에 섞여요");
  [s, j] = await call(brand, "/api/partner/cs/templates/delete", "POST", { id: tid }, BH); ok(s === 200 && j.templates.length === 4, "문구 삭제 실패");
  [s, j] = await call(brand, "/api/partner/cs/templates/delete", "POST", { id: "none" }, BH); ok(s === 400, "없는 문구 삭제가 성공해요");
  [s, j] = await call(brand, "/api/partner/cs/templates/delete", "POST", { id: "d1" }, gh); ok(s === 200 && !j.templates.some((x) => x.id === "d1"), "기본 문구도 지울 수 있어야 해요");
  for (let i = 0; i < 12; i++) await call(brand, "/api/partner/cs/templates/add", "POST", { title: "문구" + i, text: "채우기용 문구 " + i }, BH);
  [s, j] = await call(brand, "/api/partner/cs/templates/add", "POST", { title: "초과", text: "열두 개를 넘는 문구예요" }, BH); ok(s === 400 && /12개/.test(j.error), "문구가 12개를 넘어요 " + JSON.stringify(j));
}
// 같은 내용으로 두 번 눌러도 주문은 하나
{
  const cnt = async () => (await lib.orders().list()).blobs.length;
  const n0 = await cnt();
  const a1 = await call(orderApi, "/api/order", "POST", { items: [{ id: "grafen-patch", q: 1 }], ship: shipBody }, U2);
  const a2 = await call(orderApi, "/api/order", "POST", { items: [{ id: "grafen-patch", q: 1 }], ship: shipBody }, U2);
  ok(a1[0] === 200 && a2[0] === 200 && a1[1].orderId === a2[1].orderId && (await cnt()) === n0 + 1, "같은 내용으로 두 번 눌러도 주문이 하나가 아니에요 " + a1[1].orderId + " " + a2[1].orderId);
  const a3 = await call(orderApi, "/api/order", "POST", { items: [{ id: "grafen-patch", q: 2 }], ship: shipBody }, U2); ok(a3[0] === 200 && a3[1].orderId !== a1[1].orderId, "수량이 다른데 같은 주문으로 합쳐져요");
  [s, j] = await call(orderApi, "/api/order", "GET", null, U2); ok(j.orders.some((o) => o.ship && o.ship.name), "주문 내역에 배송지가 없어요");
  ok(!JSON.stringify(j).includes("paymentKey") && !JSON.stringify(j).includes("tossTx"), "주문 내역에 결제 키가 노출돼요");
}

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
