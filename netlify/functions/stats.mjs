import { json, loadProducts, stats, kday, addStat, weekOffs } from "./_lib.mjs";

export default async (req) => {
  const u = new URL(req.url);
  if (u.pathname === "/api/track" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (b.e !== "v" && b.e !== "c") return json({ error: "bad event" }, 400);
    const { map } = await loadProducts(req);
    if (!map[b.id]) return json({ error: "bad id" }, 400);
    if (b.e === "c") {
      /* 표시 구매 수(이번 주 월요일부터 합계, 매주 월요일 0시 초기화)가 100 이하 +10, 300 이하 +4~9, 1000 이하 +1~3, 그 이후 +1. 100 이하면 화면에는 숨김 */
      const st = stats();
      const days = await Promise.all(weekOffs().map((i) => st.get(kday(i), { type: "json" })));
      const cur = days.reduce((a, o) => a + (o && o[b.id] ? o[b.id].d || 0 : 0), 0);
      const inc = cur <= 100 ? 10 : cur <= 300 ? 4 + Math.floor(Math.random() * 6) : cur <= 1000 ? 1 + Math.floor(Math.random() * 3) : 1;
      await addStat([[b.id, "c", 1], [b.id, "d", inc]]);
      return json({ ok: true, inc });
    }
    await addStat([[b.id, "v", 1]]);
    return json({ ok: true });
  }
  if (u.pathname === "/api/popular") {
    const st = stats(), sum = {};
    /* 조회·클릭·장바구니 점수는 최근 7일(인기순용), 구매 수 d는 이번 주(월요일 0시 초기화)만 */
    const wk = new Set(weekOffs());
    const days = await Promise.all(Array.from({ length: 7 }, (_, i) => st.get(kday(i), { type: "json" })));
    days.forEach((o, i) => {
      if (!o) return;
      Object.keys(o).forEach((id) => { const s = (sum[id] = sum[id] || { v: 0, c: 0, b: 0, d: 0 }); s.v += o[id].v; s.c += o[id].c; s.b += o[id].b; if (wk.has(i)) s.d += o[id].d || 0; });
    });
    return json({ stats: sum }, 200, { "cache-control": "public, max-age=60" });
  }
  return json({ error: "not found" }, 404);
};

export const config = { path: ["/api/track", "/api/popular"] };
