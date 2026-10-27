import { loadBrands } from "./_lib.mjs";
import { reconcileAll } from "./_toss.mjs";
import { sweepLive } from "./_live.mjs";

/* 매일 새벽 4시 30분(KST) 토스와 대조: 결제 누락 복구, 외부 취소 반영. 실시간 접속 기록 정리도 함께 */
export default async () => { await loadBrands(); await sweepLive().catch((e) => console.error("live sweep", e)); await reconcileAll(); };
export const config = { schedule: "30 19 * * *" };
