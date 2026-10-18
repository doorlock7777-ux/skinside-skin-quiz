import { orders, BRANDS, mail, esc } from "./_lib.mjs";
import { PARTNER_DIR } from "./_auth.mjs";

/* 브랜드에 전달하는 주문 정보 (통상 플랫폼이 브랜드에 주는 항목)
   주문번호, 주문일시, 상품명/옵션/수량, 판매단가, 상품금액, 수령인, 연락처, 우편번호/주소, 배송메모, 주문 배송비, 정산 예정금액 */
export const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 36e5).toISOString().slice(0, 16).replace("T", " ");
const won = (n) => Number(n || 0).toLocaleString("ko-KR");
const SITE = () => process.env.SITE_URL || process.env.URL || "https://skinside.co.kr";
const csvCell = (c) => `"${String(c ?? "").replace(/"/g, '""')}"`;

export const brandLink = () => SITE() + "/" + PARTNER_DIR + "/";

function lines(o, brand) { return o.items.filter((l) => l.brand === brand); }
function settle(brand, amount) { const fee = (BRANDS[brand] && BRANDS[brand].fee) || 0; return amount - Math.round((amount * fee) / 100); }

function csvFor(list) {
  const rows = [["주문번호", "주문일시", "상품명", "옵션", "수량", "판매단가", "상품금액", "수령인", "연락처", "우편번호", "주소", "배송메모", "주문 배송비", "정산 예정금액"]];
  list.forEach(({ o, ls, brand }) => ls.forEach((l, i) => {
    const a = o.ship || {}, amt = l.unit * l.q;
    rows.push([o.id, kst(o.paidAt || o.createdAt), l.name, l.optName || "", l.q, l.unit, amt, a.name, a.phone, a.zip, `${a.addr1 || ""} ${a.addr2 || ""}`.trim(), a.memo || "", i === 0 ? o.shipFee || 0 : "", settle(brand, amt)]);
  }));
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function html(brand, news, cancels) {
  const nm = BRANDS[brand].name;
  let h = `<div style="font-family:sans-serif;max-width:720px;color:#191f28"><p><b>${esc(nm)}</b> 담당자님, 안녕하세요. 스킨인사이드입니다.</p>`;
  if (news.length) {
    h += `<p>어제 아침부터 지금까지 들어온 신규 주문 <b>${news.length}건</b>입니다. 첨부한 엑셀(CSV) 파일에도 같은 내용이 있어요. 발송 후에는 아래 링크에서 택배사와 송장번호를 입력해주세요.</p>`;
    news.forEach(({ o, ls }) => {
      const a = o.ship || {};
      h += `<div style="border:1px solid #e5e8eb;border-radius:12px;padding:14px;margin:10px 0"><div><b>${esc(o.id)}</b> · ${esc(kst(o.paidAt || o.createdAt))}</div>`
        + `<ul style="margin:8px 0;padding-left:18px">${ls.map((l) => `<li>${esc(l.name)}${l.optName ? " (" + esc(l.optName) + ")" : ""} × ${l.q} · 판매가 ${won(l.unit * l.q)}원 · 정산 ${won(settle(brand, l.unit * l.q))}원</li>`).join("")}</ul>`
        + `<div style="color:#4e5968">받는 분 ${esc(a.name)} / ${esc(a.phone)}<br>(${esc(a.zip)}) ${esc(a.addr1)} ${esc(a.addr2)}${a.memo ? "<br>배송 메모: " + esc(a.memo) : ""}</div></div>`;
    });
  }
  if (cancels.length) {
    h += `<p style="color:#f04452"><b>주문 취소 안내</b> (이미 전달드린 주문입니다. 발송 전이라면 발송을 멈춰주세요.)</p><ul>${cancels.map(({ o }) => `<li>${esc(o.id)} · ${esc((o.ship || {}).name)} 님</li>`).join("")}</ul>`;
  }
  h += `<p><a href="${esc(brandLink())}" style="display:inline-block;background:#4E57A2;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">송장번호 입력하러 가기</a></p><p style="color:#6b7684;font-size:13px">접속할 때는 스킨인사이드가 따로 안내드린 브랜드 접속 코드를 입력해주세요.</p>`
    + `<p style="color:#6b7684;font-size:13px">개인정보(수령인, 연락처, 주소)는 배송 목적으로만 사용하고 발송 후 안전하게 폐기해주세요.</p></div>`;
  return h;
}

/* 아직 브랜드에 전달하지 않은 주문을 브랜드별로 모아 메일로 보낸다. dry=true면 보내지 않고 내용만 돌려준다. */
export async function runBrandBatch({ dry = false } = {}) {
  const st = orders();
  const { blobs } = await st.list();
  const all = (await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })))).filter(Boolean);
  const per = {};
  const slot = (b) => (per[b] = per[b] || { news: [], cancels: [] });
  all.forEach((o) => {
    const brands = [...new Set(o.items.map((l) => l.brand))];
    brands.forEach((b) => {
      if (["paid", "partial", "shipped"].includes(o.status) && !(o.sent || {})[b]) slot(b).news.push({ o, ls: lines(o, b), brand: b });
      if (o.status === "canceled" && (o.sent || {})[b] && !(o.cancelSent || {})[b]) slot(b).cancels.push({ o, brand: b });
    });
  });
  const result = [], now = new Date().toISOString();
  for (const b of Object.keys(per)) {
    const { news, cancels } = per[b];
    if (!news.length && !cancels.length) continue;
    news.sort((x, y) => ((x.o.paidAt || x.o.createdAt) < (y.o.paidAt || y.o.createdAt) ? -1 : 1));
    const r = { brand: b, name: BRANDS[b].name, email: BRANDS[b].email || "", orders: news.length, cancels: cancels.length, sent: false, reason: "" };
    if (!r.email) r.reason = "브랜드 이메일이 등록되지 않았어요";
    else if (dry) r.reason = "미리보기";
    else {
      const subject = news.length ? `[스킨인사이드] ${kst(now).slice(5, 10).replace("-", "/")} 신규 주문 ${news.length}건` + (cancels.length ? ` · 취소 ${cancels.length}건` : "") : `[스킨인사이드] 주문 취소 안내 ${cancels.length}건`;
      const att = news.length ? [{ filename: `skinside-orders-${kst(now).slice(0, 10)}.csv`, content: Buffer.from(csvFor(news)).toString("base64") }] : [];
      r.sent = await mail(BRANDS[b].email, subject, html(b, news, cancels), att);
      if (!r.sent) r.reason = "메일 발송에 실패했어요";
      else {
        for (const { o } of news) { o.sent = Object.assign(o.sent || {}, { [b]: now }); await st.setJSON(o.id, o); }
        for (const { o } of cancels) { o.cancelSent = Object.assign(o.cancelSent || {}, { [b]: now }); await st.setJSON(o.id, o); }
      }
    }
    result.push(r);
  }
  if (!dry && process.env.NOTIFY_EMAIL && result.length) {
    await mail(process.env.NOTIFY_EMAIL, `[스킨인사이드] 브랜드 주문 전달 결과 (${result.filter((x) => x.sent).length}/${result.length})`,
      `<ul>${result.map((x) => `<li>${esc(x.name)}: 신규 ${x.orders}건, 취소 ${x.cancels}건 → ${x.sent ? "전달 완료" : "<b>미전달</b> (" + esc(x.reason) + ")"}</li>`).join("")}</ul>`);
  }
  return result;
}
