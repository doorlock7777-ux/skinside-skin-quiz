import { getStore } from "@netlify/blobs";

/* 실시간 접속(관리자 홈). 개인정보 없이 브라우저마다 만든 임의 id만 쓴다.
   - 스토어·진단 화면이 열려 있는 동안 1분마다 신호(/api/live)를 보낸다. 탭이 숨겨지면 보내지 않는다.
   - 저장: "m/<분(KST, YYYYMMDDHHmm)>/<화면>/<id>" (같은 분 안의 신호는 같은 키를 덮어써서 쌓이지 않음),
           "d/<날짜>/<id>" (오늘 처음 들어온 사람, 오늘 방문자 수용).
   - "지금 접속 중" = 최근 2분 안에 신호를 보낸 사람 수. 매일 새벽 정리(sweepLive)에서 3시간 지난 분 기록과 35일 지난 날 기록을 지운다. */
export const liveStore = () => getStore({ name: "live", consistency: "strong" });
export const PAGES = ["store", "quiz"];
const VID = /^[a-z0-9]{8,32}$/;
const kst = (t) => new Date(t + 9 * 36e5).toISOString();
export const minKey = (t) => kst(t).slice(0, 16).replace(/[-T:]/g, "");
export const dayKey = (t) => kst(t).slice(0, 10);
const keysOf = async (st, prefix) => (await st.list({ prefix })).blobs.map((b) => b.key).filter((k) => k.startsWith(prefix));

export async function beat(b, now = Date.now(), st = liveStore()) {
  const v = String((b && b.v) || "").toLowerCase();
  if (!VID.test(v)) return { error: "bad id" };
  const p = PAGES.includes(b.p) ? b.p : "store";
  const w = [st.set("m/" + minKey(now) + "/" + p + "/" + v, "1")];
  if (b.f) w.push(st.set("d/" + dayKey(now) + "/" + v, "1"));
  await Promise.all(w);
  return { ok: true };
}

/* 관리자 화면용: 지금 접속 중, 화면별, 오늘 방문자, 최근 30분 분당 접속자 */
export async function liveView(now = Date.now(), st = liveStore()) {
  const hours = [...new Set([minKey(now), minKey(now - 31 * 6e4)].map((m) => m.slice(0, 10)))];
  const [mk, dk] = await Promise.all([Promise.all(hours.map((h) => keysOf(st, "m/" + h))).then((a) => a.flat()), keysOf(st, "d/" + dayKey(now) + "/")]);
  const per = {}, last = {}, upto = minKey(now);
  mk.forEach((k) => {
    const [, m, p, v] = k.split("/");
    if (!m || !v || m > upto) return;
    (per[m] = per[m] || new Set()).add(v);
    if (!last[v] || last[v].m < m) last[v] = { m, p };
  });
  const since = minKey(now - 6e4), pages = { store: 0, quiz: 0 };
  let cur = 0;
  Object.values(last).forEach((x) => { if (x.m >= since) { cur++; pages[x.p in pages ? x.p : "store"]++; } });
  const series = Array.from({ length: 30 }, (_, i) => { const t = now - (29 - i) * 6e4, m = minKey(t); return { t: kst(t).slice(11, 16), n: per[m] ? per[m].size : 0 }; });
  const today = Math.max(dk.length, cur);
  return { now: cur, pages, today, peak: Math.max(0, ...series.map((x) => x.n)), series, at: new Date(now).toISOString() };
}

/* 오래된 기록 정리: 3시간 지난 분 기록, 35일 지난 날 기록 */
export async function sweepLive(now = Date.now(), st = liveStore()) {
  const mCut = minKey(now - 3 * 36e5), dCut = dayKey(now - 35 * 864e5);
  const [mk, dk] = await Promise.all([keysOf(st, "m/"), keysOf(st, "d/")]);
  const old = mk.filter((k) => k.split("/")[1] < mCut).concat(dk.filter((k) => k.split("/")[1] < dCut));
  for (let i = 0; i < old.length; i += 50) await Promise.all(old.slice(i, i + 50).map((k) => st.delete(k)));
  return old.length;
}
