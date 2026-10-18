import { json, loadProducts, stats, kday, addStat } from "./_lib.mjs";

export default async (req) => {
  const u = new URL(req.url);
  if (u.pathname === "/api/track" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (b.e !== "v" && b.e !== "c") return json({ error: "bad event" }, 400);
    const { map } = await loadProducts(req);
    if (!map[b.id]) return json({ error: "bad id" }, 400);
    if (b.e === "c") {
      /* 이번 주 구매 클릭이 100회 이하이면 클릭당 4~9 랜덤, 이후에는 클릭당 10 */
      const st = stats();
      const days = await Promise.all([0, 1, 2, 3, 4, 5, 6].map((i) => st.get(kday(i), { type: "json" })));
      const wk = days.reduce((a, o) => a + (o && o[b.id] ? o[b.id].c : 0), 0);
      const inc = wk < 100 ? 4 + Math.floor(Math.random() * 6) : 10;
      await addStat([[b.id, "c", 1], [b.id, "d", inc]]);
      return json({ ok: true, inc });
    }
    await addStat([[b.id, "v", 1]]);
    return json({ ok: true });
  }
  if (u.pathname === "/api/popular") {
    const st = stats(), sum = {};
    for (let i = 0; i < 7; i++) {
      const o = await st.get(kday(i), { type: "json" });
      if (!o) continue;
      Object.keys(o).forEach((id) => { const s = (sum[id] = sum[id] || { v: 0, c: 0, b: 0, d: 0 }); s.v += o[id].v; s.c += o[id].c; s.b += o[id].b; s.d += o[id].d || 0; });
    }
    return json({ stats: sum }, 200, { "cache-control": "public, max-age=60" });
  }
  return json({ error: "not found" }, 404);
};

export const config = { path: ["/api/track", "/api/popular"] };
