import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

/* 정산 조정(가감)과 마지막 대조 결과. 정산 확정본은 바꾸지 않고, 고칠 일은 아직 확정 안 된 달에 조정으로 넣는다 */
const st = () => getStore({ name: "adjust", consistency: "strong" });
export const getAdj = async (m) => (await st().get("adj-" + m, { type: "json" })) || [];
export async function allAdj() {
  const s = st(), { blobs } = await s.list(), out = {};
  for (const b of blobs) if (b.key.startsWith("adj-")) out[b.key.slice(4)] = (await s.get(b.key, { type: "json" })) || [];
  return out;
}
export async function addAdj(m, brand, amount, memo, auto = false) {
  const list = await getAdj(m);
  list.push({ id: "J" + randomBytes(4).toString("hex"), brand, amount: Math.round(amount), memo: String(memo || "").slice(0, 100), at: new Date().toISOString(), auto });
  await st().setJSON("adj-" + m, list); return list;
}
export async function delAdj(m, id) {
  const list = await getAdj(m), next = list.filter((x) => x.id !== id);
  if (next.length === list.length) return null;
  await st().setJSON("adj-" + m, next); return next;
}
export const getLast = () => st().get("last-reconcile", { type: "json" });
export const setLast = (v) => st().setJSON("last-reconcile", v);
