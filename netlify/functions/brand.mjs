import { json, orders, BRANDS, setShipment, notifyShipped, loadProducts, loadStock, stockStore, normCarrier, TRACK_RE, CARRIERS } from "./_lib.mjs";
import { partnerLogin, partnerLogout, partnerFromReq } from "./_auth.mjs";
import { partnerHome } from "./_home.mjs";
import { shipCsv } from "./_batch.mjs";
import { allTickets, getTicket, addMessage, decide, receiveAndRefund, markExchangeSent, escalate, close } from "./_cs.mjs";
import { listSettlements } from "./_settle.mjs";
import { allAdj } from "./_adj.mjs";
import { listTpl, addTpl, delTpl } from "./_tpl.mjs";
import { allOrders } from "./_ctx.mjs";
import { allReviews, getReview, summary as reviewSummary, manageView, markRead, setBest, requestDelete } from "./_reviews.mjs";
import { monthsBetween, vatMonths, vatDays, txns, monthsCsv, daysCsv, ordersCsv } from "./_vat.mjs";

/* 파트너 브랜드 전용 API: 브랜드 접속 코드로 로그인한 뒤, 자기 브랜드 제품이 든 주문만 보인다 */
const mineOf = (os, brand) => os.filter((o) => ["paid", "partial", "shipped", "canceled"].includes(o.status) && o.items.some((l) => l.brand === brand));
async function brandStock(req, brand) {
  const { data } = await loadProducts(req), st = await loadStock();
  return data.products.filter((p) => p.brand === brand).map((p) => ({ id: p.id, name: p.name, img: p.img, price: p.price, soldOut: !!p.soldOut, qty: st[p.id] && st[p.id].qty !== undefined ? st[p.id].qty : null, manual: !!(st[p.id] && st[p.id].soldOut) }));
}
const toCsvResponse = (text, name) => new Response(text, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });

export default async (req) => {
  const u = new URL(req.url), p = u.pathname.replace(/\/$/, ""), st = orders();
  if (p === "/api/partner/login" && req.method === "POST") return partnerLogin(req, BRANDS);
  if (p === "/api/partner/logout" && req.method === "POST") return partnerLogout();
  const brand = await partnerFromReq(req, BRANDS);
  if (!brand) return json({ error: "unauthorized" }, 401);
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (p === "/api/partner/me") return json({ brand: BRANDS[brand].name });
  if (p === "/api/partner/home") {
    const [os, tickets, settles, stock, rv, adj] = await Promise.all([allOrders(), allTickets(), listSettlements(), brandStock(req, brand), allReviews(), allAdj()]);
    return json({ brand: BRANDS[brand].name, ...partnerHome(os.filter((o) => o.status !== "pending"), brand, { tickets, settles, adj, stock, reviews: reviewSummary(rv, brand) }) });
  }

  /* ---- 발송 ---- */
  if (p === "/api/partner/orders") {
    const mine = mineOf(await allOrders(), brand).slice(0, 300)
      .map((o) => ({ id: o.id, at: o.paidAt || o.createdAt, canceled: o.status === "canceled", ship: o.ship, items: o.items.filter((l) => l.brand === brand).map((l) => ({ name: l.name, optName: l.optName, q: l.q })), shipment: (o.shipments || {})[brand] || null }));
    return json({ brand: BRANDS[brand].name, orders: mine });
  }
  if (p === "/api/partner/orders.csv") {
    const all = u.searchParams.get("state") === "all";
    const list = mineOf(await allOrders(), brand).filter((o) => o.status !== "canceled" && (all || !(o.shipments && o.shipments[brand] && o.shipments[brand].tracking))).reverse();
    return toCsvResponse(shipCsv(list, brand), `orders-${new Date().toISOString().slice(0, 10)}.csv`);
  }
  if (p === "/api/partner/ship" && req.method === "POST") {
    const o = await st.get(String(b.orderId || ""), { type: "json" });
    if (!o || !o.items.some((l) => l.brand === brand) || o.status === "canceled" || !["paid", "partial", "shipped"].includes(o.status)) return json({ error: "처리할 수 없는 주문이에요" }, 400);
    if (!TRACK_RE.test(String(b.tracking || "").trim())) return json({ error: "송장번호는 숫자·영문 6자 이상이에요" }, 400);
    setShipment(o, brand, normCarrier(b.carrier) || b.carrier, String(b.tracking).trim());
    await notifyShipped(o, brand);
    await st.setJSON(o.id, o);
    return json({ ok: true });
  }
  /* 엑셀(CSV)로 받은 송장번호를 한 번에 반영: rows = [{orderId, carrier, tracking}] */
  if (p === "/api/partner/ship-bulk" && req.method === "POST") {
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 500) : [], results = [];
    for (const r of rows) {
      const id = String(r.orderId || "").trim(), tracking = String(r.tracking || "").replace(/[\s]/g, ""), car = normCarrier(r.carrier);
      const res = { orderId: id, ok: false, error: "" };
      if (!id) res.error = "주문번호가 없어요";
      else if (!car) res.error = "택배사를 알 수 없어요 (" + (r.carrier || "비어 있음") + ")";
      else if (!TRACK_RE.test(tracking)) res.error = "송장번호는 숫자·영문 6자 이상이에요 (입력값: " + (tracking || "비어 있음") + ")";
      else {
        const o = await st.get(id, { type: "json" });
        if (!o || !o.items.some((l) => l.brand === brand)) res.error = "내 브랜드 주문이 아니에요";
        else if (o.status === "canceled" || !["paid", "partial", "shipped"].includes(o.status)) res.error = "취소됐거나 처리할 수 없는 주문이에요";
        else { setShipment(o, brand, car, tracking); await notifyShipped(o, brand); await st.setJSON(o.id, o); res.ok = true; }
      }
      results.push(res);
    }
    return json({ ok: true, done: results.filter((x) => x.ok).length, results });
  }

  /* ---- 재고 ---- */
  if (p === "/api/partner/stock" && req.method !== "POST") { const products = await brandStock(req, brand); return json({ products, selling: products.filter((x) => !x.soldOut).length, soldOut: products.filter((x) => x.soldOut).length, at: new Date().toISOString() }); }
  if (p === "/api/partner/stock" && req.method === "POST") {
    const { map } = await loadProducts(req), prod = map[String(b.id || "")];
    if (!prod || prod.brand !== brand) return json({ error: "내 브랜드 제품이 아니에요" }, 400);
    const all = await loadStock(), cur = all[prod.id] || { soldOut: false, qty: null };
    if ("soldOut" in b) cur.soldOut = !!b.soldOut;
    if ("qty" in b) {
      if (b.qty === null || b.qty === "") cur.qty = null;
      else { const q = Math.floor(Number(b.qty)); if (!(q >= 0 && q <= 100000)) return json({ error: "수량을 확인해주세요" }, 400); cur.qty = q; if (q > 0) cur.soldOut = false; }
    }
    all[prod.id] = cur; await stockStore().setJSON("all", all);
    return json({ ok: true });
  }

  /* ---- CS ---- */
  const tk = async (id) => { const t = await getTicket(id); return t && t.brand === brand ? t : null; };
  /* ---- CS 자동 입력 문구 (브랜드별) ---- */
  if (p === "/api/partner/cs/templates") return json({ templates: await listTpl(brand), brand: BRANDS[brand].name });
  if (p === "/api/partner/cs/templates/add" && req.method === "POST") { const r = await addTpl(brand, b.title, b.text); return r.error ? json({ error: r.error }, 400) : json({ templates: r.list }); }
  if (p === "/api/partner/cs/templates/delete" && req.method === "POST") { const r = await delTpl(brand, String(b.id || "")); return r.error ? json({ error: r.error }, 400) : json({ templates: r.list }); }

  if (p === "/api/partner/cs") {
    const [tickets, os] = await Promise.all([allTickets(), allOrders()]), byId = Object.fromEntries(os.map((o) => [o.id, o]));
    return json({ tickets: tickets.filter((t) => t.brand === brand).slice(0, 200).map((t) => { const o = byId[t.orderId] || {}; const { userId, ...pub } = t; return { ...pub, customer: { name: (o.ship || {}).name || t.userName, phone: (o.ship || {}).phone || "" }, items: (o.items || []).filter((l) => l.brand === brand).map((l) => ({ name: l.name, optName: l.optName, q: l.q })), shipment: (o.shipments || {})[brand] || null }; }) });
  }
  if (p.startsWith("/api/partner/cs/") && req.method === "POST") {
    const t = await tk(b.id); if (!t) return json({ error: "요청을 찾을 수 없어요" }, 404);
    const act = p.slice("/api/partner/cs/".length);
    let r;
    if (act === "reply") r = await addMessage(t, "partner", b.text);
    else if (act === "decide") r = b.action === "approve" || b.action === "reject" ? await decide(t, b.action, b.text) : { error: "처리를 선택해주세요" };
    else if (act === "received") r = await receiveAndRefund(t);
    else if (act === "exchange-sent") r = await markExchangeSent(t, b.tracking);
    else if (act === "escalate") r = await escalate(t, "partner");
    else if (act === "close") r = t.type === "inquiry" ? await close(t, "partner") : { error: "교환·반품은 종료할 수 없어요" };
    else return json({ error: "not found" }, 404);
    return r.error ? json({ error: r.error, ticket: r.ticket }, 400) : json({ ok: true, ticket: r.ticket });
  }

  /* ---- 정산 ---- */
  if (p === "/api/partner/settlements") {
    const list = (await listSettlements()).filter((x) => x.rows.some((r) => r.brand === brand)).map((x) => ({ month: x.month, confirmedAt: x.confirmedAt, paidAt: (x.paid || {})[brand] || null, ...x.rows.find((r) => r.brand === brand) }));
    return json({ settlements: list });
  }
  /* ---- 부가세 신고용 매출 자료 ---- */
  if (p.startsWith("/api/partner/vat")) {
    const os = (await allOrders()).filter((o) => o.status !== "pending"), me = u.searchParams;
    const csvRes = (t, n) => toCsvResponse(t, n);
    if (p === "/api/partner/vat" || p === "/api/partner/vat.csv") {
      const ms = monthsBetween(String(me.get("from") || ""), String(me.get("to") || ""));
      if (!ms) return json({ error: "기간을 확인해주세요 (최대 12개월)" }, 400);
      const v = vatMonths(os, brand, ms);
      return p.endsWith(".csv") ? csvRes(monthsCsv(v, brand), `vat-${ms[0]}_${ms[ms.length - 1]}.csv`) : json({ ...v, basis: "결제 완료일 기준, 환불·취소는 환불한 달에서 차감, 부가세 포함 금액" });
    }
    const m = String(me.get("month") || "");
    if (!/^\d{4}-\d{2}$/.test(m)) return json({ error: "월을 확인해주세요" }, 400);
    if (p === "/api/partner/vat-days") return json({ month: m, days: vatDays(os, brand, m) });
    if (p === "/api/partner/vat-days.csv") return csvRes(daysCsv(vatDays(os, brand, m)), `vat-daily-${m}.csv`);
    if (p === "/api/partner/vat-orders.csv") return csvRes(ordersCsv(txns(os, brand, m)), `vat-orders-${m}.csv`);
  }

  /* ---- 리뷰: 브랜드는 직접 삭제할 수 없고 삭제 요청만 가능 ---- */
  if (p.startsWith("/api/partner/reviews")) {
    const rv = await allReviews();
    if (p === "/api/partner/reviews") return json(manageView(rv, brand));
    if (p === "/api/partner/reviews/read") { await markRead(rv, "brand", b.ids === "all" ? "all" : b.ids, brand); return json({ ok: true }); }
    const r = await getReview(b.id);
    if (!r || r.brand !== brand) return json({ error: "리뷰를 찾을 수 없어요" }, 404);
    const res = p === "/api/partner/reviews/best" ? await setBest(r, !!b.on) : p === "/api/partner/reviews/delete-request" ? await requestDelete(r, b.reason) : null;
    if (!res) return json({ error: "not found" }, 404);
    return res.error ? json({ error: res.error }, 400) : json({ ok: true });
  }
  return json({ error: "not found" }, 404);
};
export const config = { path: "/api/partner/*" };
