import { orders } from "./_lib.mjs";
import { partnerIdx } from "./_auth.mjs";
import { allTickets } from "./_cs.mjs";
import { listSettlements } from "./_settle.mjs";
import { adminHome } from "./_home.mjs";

export async function allOrders() {
  const st = orders();
  const { blobs } = await st.list();
  const os = (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean);
  return os.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
export async function adminSummary() {
  const [os, idx, tickets, settles] = await Promise.all([allOrders(), partnerIdx(), allTickets(), listSettlements()]);
  return adminHome(os.filter((o) => o.status !== "pending"), { idx, tickets, settles });
}
