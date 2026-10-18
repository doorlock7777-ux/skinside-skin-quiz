import { orders, loadProducts } from "./_lib.mjs";
import { allReviews, summary } from "./_reviews.mjs";
import { partnerIdx } from "./_auth.mjs";
import { allTickets } from "./_cs.mjs";
import { listSettlements } from "./_settle.mjs";
import { adminHome } from "./_home.mjs";
import { allAdj } from "./_adj.mjs";

export async function allOrders() {
  const st = orders();
  const { blobs } = await st.list();
  const os = (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean);
  return os.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
export async function adminSummary(req) {
  const [os, idx, tickets, settles, rv, prods, adj] = await Promise.all([allOrders(), partnerIdx(), allTickets(), listSettlements(), allReviews(), req ? loadProducts(req) : null, allAdj()]);
  const ps = prods ? prods.data.products : [], stock = { selling: ps.filter((p) => !p.soldOut).length, soldOut: ps.filter((p) => p.soldOut).length };
  return adminHome(os.filter((o) => o.status !== "pending"), { idx, tickets, settles, adj, reviews: summary(rv), stock });
}
