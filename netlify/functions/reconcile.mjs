import { reconcileAll } from "./_toss.mjs";

/* 매일 새벽 4시 30분(KST) 토스와 대조: 결제 누락 복구, 외부 취소 반영 */
export default async () => { await reconcileAll(); };
export const config = { schedule: "30 19 * * *" };
