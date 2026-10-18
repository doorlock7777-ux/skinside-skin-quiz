import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

/* CS 자동 입력용 답변 문구. 브랜드(와 관리자)마다 따로 저장하고 직접 추가·삭제한다. 한 번도 안 바꾼 곳에는 기본 4개를 보여준다.
   문구 안의 {브랜드} {고객}은 화면에서 실제 이름으로 바뀐다. */
export const DEFAULTS = [
  { id: "d1", title: "배송 문의", text: "안녕하세요, {고객}님. {브랜드}입니다. 주문하신 상품은 영업일 기준 1~2일 안에 발송되고, 발송되면 주문내역에서 택배사와 송장번호를 바로 확인하실 수 있어요. 도착까지는 보통 1~3일 정도 걸려요. 기다려주셔서 감사합니다." },
  { id: "d2", title: "교환·반품 안내", text: "안녕하세요, {고객}님. {브랜드}입니다. 상품 수령 후 7일 이내, 미개봉·미사용 상태라면 교환·반품이 가능해요. 주문내역의 판매자정보/문의에서 반품을 신청해 주시고, 상품을 보내주시면 입고 확인 후 바로 환불해드려요. 단순 변심은 왕복 배송비가 부담돼요." },
  { id: "d3", title: "불량·오배송 사과", text: "안녕하세요, {고객}님. {브랜드}입니다. 불편을 드려 정말 죄송합니다. 제품과 박스, 라벨이 보이는 사진을 남겨주시면 확인 후 새 제품으로 교환하거나 환불해드릴게요. 배송비는 저희가 부담합니다." },
  { id: "d4", title: "사용법·피부 트러블", text: "안녕하세요, {고객}님. {브랜드}입니다. 처음 쓰실 때는 팔 안쪽에 먼저 소량 테스트해 보시길 권해요. 사용 중 붉어짐·가려움·따가움이 있으면 바로 사용을 멈추고 물로 씻어내 주세요. 증상이 계속되면 피부과 상담을 받아보시길 권해드려요. 개봉 후에는 서늘한 곳에 보관하고 6~12개월 안에 사용해 주세요." },
];
export const MAX_TPL = 12;
const st = () => getStore({ name: "cstpl", consistency: "strong" });
const clip = (s, n) => String(s ?? "").trim().slice(0, n);

export async function listTpl(key) { return (await st().get(String(key), { type: "json" })) || DEFAULTS.map((x) => ({ ...x })); }
export async function addTpl(key, title, text) {
  const t = clip(title, 20), x = clip(text, 600);
  if (t.length < 2 || x.length < 5) return { error: "제목(2자 이상)과 답변 내용(5자 이상)을 입력해주세요" };
  const list = await listTpl(key);
  if (list.length >= MAX_TPL) return { error: `자동 입력 문구는 ${MAX_TPL}개까지 만들 수 있어요. 안 쓰는 걸 지워주세요` };
  list.push({ id: "t" + randomBytes(4).toString("hex"), title: t, text: x });
  await st().setJSON(String(key), list); return { list };
}
export async function delTpl(key, id) {
  const list = await listTpl(key), next = list.filter((x) => x.id !== id);
  if (next.length === list.length) return { error: "없는 문구예요" };
  await st().setJSON(String(key), next); return { list: next };
}
