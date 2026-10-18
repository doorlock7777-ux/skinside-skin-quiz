import { runBrandBatch } from "./_batch.mjs";

/* 매일 아침 9시(KST) = 00:00 UTC. 전날 아침 이후 들어온 주문을 브랜드별로 한 번에 메일로 보낸다. */
export default async () => {
  const r = await runBrandBatch({});
  return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
};
export const config = { schedule: "0 0 * * *" };
