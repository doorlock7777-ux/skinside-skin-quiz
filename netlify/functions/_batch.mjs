import { orders, BRANDS, mail, esc, CARRIERS } from "./_lib.mjs";
import { PARTNER_DIR } from "./_auth.mjs";
import { LATE_HOURS } from "./_home.mjs";

/* 브랜드 알림.
   - 주문이 결제되면 그 즉시 브랜드에 메일(notifyNewOrder), 취소되면 즉시 취소 안내(notifyCancel)
   - 매일 아침 9시(KST)에는 아직 발송하지 않은 주문을 한 번에 정리해서 다시 알려준다(runBrandBatch) */
export const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 36e5).toISOString().slice(0, 16).replace("T", " ");
const won = (n) => Number(n || 0).toLocaleString("ko-KR");
const SITE = () => process.env.SITE_URL || process.env.URL || "https://skinside.co.kr";
const csvCell = (c) => `"${String(c ?? "").replace(/"/g, '""')}"`;
export const brandLink = () => SITE() + "/" + PARTNER_DIR + "/";
const lines = (o, brand) => o.items.filter((l) => l.brand === brand);
const settle = (brand, amount) => { const fee = (BRANDS[brand] && BRANDS[brand].fee) || 0; return amount - Math.round((amount * fee) / 100); };
const when = (o) => o.paidAt || o.createdAt;
const trk = (o, b) => !!(o.shipments && o.shipments[b] && o.shipments[b].tracking);

/* 택배 접수용 엑셀(CSV): 택배사/송장번호 칸을 채워 파트너 페이지에 올리면 한 번에 반영된다 */
export function shipCsv(list, brand) {
  const rows = [["주문번호", "수령인", "연락처", "우편번호", "주소", "상품", "수량", "배송메모", "택배사", "송장번호"]];
  list.forEach((o) => {
    const a = o.ship || {}, ls = lines(o, brand), sh = (o.shipments || {})[brand] || {};
    rows.push([o.id, a.name, a.phone, a.zip, `${a.addr1 || ""} ${a.addr2 || ""}`.trim(), ls.map((l) => l.name + (l.optName ? " (" + l.optName + ")" : "") + " x" + l.q).join(" / "), ls.reduce((x, l) => x + l.q, 0), a.memo || "", CARRIERS[sh.carrier] || "", sh.tracking || ""]);
  });
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
const card = (o, brand, late) => {
  const a = o.ship || {};
  return `<div style="border:1px solid ${late ? "#f04452" : "#e5e8eb"};border-radius:12px;padding:14px;margin:10px 0"><div><b>${esc(o.id)}</b> · ${esc(kst(when(o)))}${late ? ' <span style="color:#f04452;font-weight:700">발송 지연</span>' : ""}</div>`
    + `<ul style="margin:8px 0;padding-left:18px">${lines(o, brand).map((l) => `<li>${esc(l.name)}${l.optName ? " (" + esc(l.optName) + ")" : ""} × ${l.q} · 판매가 ${won(l.unit * l.q)}원 · 정산 ${won(settle(brand, l.unit * l.q))}원</li>`).join("")}</ul>`
    + `<div style="color:#4e5968">받는 분 ${esc(a.name)} / ${esc(a.phone)}<br>(${esc(a.zip)}) ${esc(a.addr1)} ${esc(a.addr2)}${a.memo ? "<br>배송 메모: " + esc(a.memo) : ""}</div></div>`;
};
const foot = () => `<p><a href="${esc(brandLink())}" style="display:inline-block;background:#4E57A2;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">파트너 페이지에서 발송 처리하기</a></p><p style="color:#6b7684;font-size:13px">접속할 때는 스킨인사이드가 따로 안내드린 브랜드 접속 코드를 입력해주세요. 파트너 페이지에서 주문 엑셀을 내려받고, 송장번호를 엑셀로 한 번에 올릴 수도 있어요.<br>개인정보(수령인, 연락처, 주소)는 배송 목적으로만 사용하고 발송 후 안전하게 폐기해주세요.</p>`;
const wrap = (nm, body) => `<div style="font-family:sans-serif;max-width:720px;color:#191f28"><p><b>${esc(nm)}</b> 담당자님, 안녕하세요. 스킨인사이드입니다.</p>${body}</div>`;

/* 결제 직후: 그 주문의 브랜드마다 바로 메일. 보낸 브랜드는 o.sent에 기록 */
export async function notifyNewOrder(o) {
  o.sent = o.sent || {};
  for (const b of [...new Set(o.items.map((l) => l.brand))]) {
    const br = BRANDS[b]; if (!br || !br.email || o.sent[b]) continue;
    const ok = await mail(br.email, `[스킨인사이드] 새 주문 ${o.id}`, wrap(br.name, `<p>새 주문이 들어왔어요. 발송 후 파트너 페이지에서 택배사와 송장번호를 입력해주세요.</p>${card(o, b)}${foot()}`));
    if (ok) o.sent[b] = new Date().toISOString();
  }
  return o;
}
export async function notifyCancel(o) {
  o.cancelSent = o.cancelSent || {};
  for (const b of [...new Set(o.items.map((l) => l.brand))]) {
    const br = BRANDS[b]; if (!br || !br.email || o.cancelSent[b] || !o.paidAt) continue;
    const ok = await mail(br.email, `[스킨인사이드] 주문 취소 ${o.id}`, wrap(br.name, `<p style="color:#f04452"><b>주문 취소 안내</b></p><p>주문번호 ${esc(o.id)}이(가) 취소됐어요. 아직 발송 전이라면 발송을 멈춰주세요. 이미 보냈다면 알려주세요.</p>`));
    if (ok) o.cancelSent[b] = new Date().toISOString();
  }
  return o;
}

/* 매일 아침: 아직 발송하지 않은 주문 정리 + 아직 알리지 못한 취소. dry=true면 보내지 않고 내용만 돌려준다. */
export async function runBrandBatch({ dry = false, now = Date.now() } = {}) {
  const st = orders();
  const { blobs } = await st.list();
  const all = (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean);
  const per = {};
  const slot = (b) => (per[b] = per[b] || { open: [], cancels: [] });
  all.forEach((o) => [...new Set(o.items.map((l) => l.brand))].forEach((b) => {
    if (["paid", "partial"].includes(o.status) && !trk(o, b)) slot(b).open.push(o);
    if (o.status === "canceled" && o.paidAt && !(o.cancelSent || {})[b]) slot(b).cancels.push(o);
  }));
  const result = [], nowIso = new Date(now).toISOString();
  for (const b of Object.keys(per)) {
    if (!BRANDS[b]) continue;
    const { open, cancels } = per[b];
    if (!open.length && !cancels.length) continue;
    open.sort((x, y) => (when(x) < when(y) ? -1 : 1));
    const isLate = (o) => now - new Date(when(o)).getTime() > LATE_HOURS * 36e5;
    const late = open.filter(isLate).length;
    const r = { brand: b, name: BRANDS[b].name, email: BRANDS[b].email || "", orders: open.length, late, cancels: cancels.length, sent: false, reason: "" };
    if (!r.email) r.reason = "브랜드 이메일이 등록되지 않았어요";
    else if (dry) r.reason = "미리보기";
    else {
      let body = "";
      if (open.length) body += `<p>아직 발송 전인 주문이 <b>${open.length}건</b> 있어요${late ? ` (그중 <b style="color:#f04452">${late}건은 ${LATE_HOURS}시간이 지났어요</b>)` : ""}. 첨부한 엑셀(CSV)에 택배사와 송장번호를 채워 파트너 페이지에 올리면 한 번에 반영돼요.</p>` + open.map((o) => card(o, b, isLate(o))).join("");
      if (cancels.length) body += `<p style="color:#f04452"><b>주문 취소 안내</b> (발송 전이라면 발송을 멈춰주세요.)</p><ul>${cancels.map((o) => `<li>${esc(o.id)} · ${esc((o.ship || {}).name || "")}</li>`).join("")}</ul>`;
      const subject = `[스킨인사이드] ${kst(nowIso).slice(5, 10).replace("-", "/")} ` + (open.length ? `미발송 주문 ${open.length}건` + (late ? ` (지연 ${late}건)` : "") : "") + (cancels.length ? (open.length ? " · " : "") + `취소 ${cancels.length}건` : "");
      const att = open.length ? [{ filename: `skinside-orders-${kst(nowIso).slice(0, 10)}.csv`, content: Buffer.from(shipCsv(open, b)).toString("base64") }] : [];
      r.sent = await mail(BRANDS[b].email, subject, wrap(BRANDS[b].name, body + foot()), att);
      if (!r.sent) r.reason = "메일 발송에 실패했어요";
      else for (const o of cancels) { o.cancelSent = Object.assign(o.cancelSent || {}, { [b]: nowIso }); await st.setJSON(o.id, o); }
    }
    result.push(r);
  }
  if (!dry && process.env.NOTIFY_EMAIL && result.length) {
    await mail(process.env.NOTIFY_EMAIL, `[스킨인사이드] 브랜드 알림 결과 (${result.filter((x) => x.sent).length}/${result.length})`,
      `<ul>${result.map((x) => `<li>${esc(x.name)}: 미발송 ${x.orders}건(지연 ${x.late}), 취소 ${x.cancels}건 → ${x.sent ? "전달 완료" : "<b>미전달</b> (" + esc(x.reason) + ")"}</li>`).join("")}</ul>`);
  }
  return result;
}
