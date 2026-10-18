import { json, loadProducts, stats, kday, addStat } from "./_lib.mjs";

export default async (req) => {
  const u = new URL(req.url);
  if (u.pathname === "/api/track" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (b.e !== "v" && b.e !== "c") return json({ error: "bad event" }, 400);
    const { map } = await loadProducts(req);
    if (!map[b.id]) return json({ error: "bad id" }, 400);
    await addStat([[b.id, b.e, 1]]);
    return json({ ok: true });
  }
  if (u.pathname === "/api/popular") {
    const st = stats(), sum = {};
    for (let i = 0; i < 7; i++) {
      const o = await st.get(kday(i), { type: "json" });
      if (!o) continue;
      Object.keys(o).forEach((id) => { const s = (sum[id] = sum[id] || { v: 0, c: 0, b: 0 }); s.v += o[id].v; s.c += o[id].c; s.b += o[id].b; });
    }
    return json({ stats: sum }, 200, { "cache-control": "public, max-age=60" });
  }
  return json({ error: "not found" }, 404);
};

export const config = { path: ["/api/track", "/api/popular"] };
