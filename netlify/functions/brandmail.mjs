import { loadBrands } from "./_lib.mjs";
import { runBrandBatch } from "./_batch.mjs";
import { adminSummary } from "./_ctx.mjs";
import { mail, esc } from "./_lib.mjs";

/* 매일 아침 9시(KST) = 00:00 UTC.
   1) 아직 발송하지 않은 주문을 브랜드별로 정리해서 메일 (지연 표시, 엑셀 첨부)
   2) 대표님께 "오늘 처리할 일"을 메일로 요약 (처리할 일이 있을 때만) */
export default async () => { await loadBrands();
  const r = await runBrandBatch({});
  let todo = [];
  try {
    const h = await adminSummary(); todo = h.todo;
    if (todo.length && process.env.NOTIFY_EMAIL) {
      await mail(process.env.NOTIFY_EMAIL, `[스킨인사이드] 오늘 처리할 일 ${todo.length}가지`, `<div style="font-family:sans-serif;color:#191f28"><p>오늘 처리할 일이에요.</p><ul>${todo.map((t) => `<li>${esc(t.label)} <b>${t.n}</b></li>`).join("")}</ul><p style="color:#6b7684;font-size:13px">관리자 페이지 홈에서 확인할 수 있어요. 처리할 일이 없는 날에는 이 메일이 오지 않아요.</p></div>`);
    }
  } catch {}
  return new Response(JSON.stringify({ brands: r, todo }), { headers: { "content-type": "application/json" } });
};
export const config = { schedule: "0 0 * * *" };
