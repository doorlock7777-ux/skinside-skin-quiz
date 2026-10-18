import { loadBrands } from "./_lib.mjs";
import { json, getUser, orders } from "./_lib.mjs";
import { allTickets, getTicket, createTicket, addMessage, escalate, forCustomer } from "./_cs.mjs";

/* 고객용 문의·교환·반품 (네이버 로그인한 본인 주문만) */
export default async (req) => { await loadBrands();
  const user = getUser(req);
  if (!user) return json({ error: "로그인이 필요해요" }, 401);
  const p = new URL(req.url).pathname.replace(/\/$/, "");
  if (p === "/api/cs/mine") return json({ tickets: (await allTickets()).filter((t) => t.userId === user.id).slice(0, 100).map(forCustomer) });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const b = await req.json().catch(() => ({}));
  if (p === "/api/cs/new") {
    const o = await orders().get(String(b.orderId || ""), { type: "json" });
    const r = await createTicket(user, o, String(b.brand || ""), String(b.type || ""), b.text);
    return r.error ? json({ error: r.error }, 400) : json({ ok: true, ticket: forCustomer(r.ticket) });
  }
  const t = await getTicket(b.id);
  if (!t || t.userId !== user.id) return json({ error: "요청을 찾을 수 없어요" }, 404);
  const r = p === "/api/cs/reply" ? await addMessage(t, "customer", b.text) : p === "/api/cs/escalate" ? await escalate(t, "customer") : { error: "not found" };
  return r.error ? json({ error: r.error }, 400) : json({ ok: true, ticket: forCustomer(r.ticket) });
};
export const config = { path: "/api/cs/*" };
