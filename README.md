# 스킨인사이드 마켓

- `public/` 정적 사이트 (홈=마켓, `/quiz/`=피부타입 진단), `netlify/functions/` 서버 기능
- 모드 전환: `public/config.js`의 `MODE` ("link" 바로가기 / "checkout" 자체 주문·결제)
- 제품 수정: `public/data/products.json` (price, list=정가 입력 시 할인율 표시, url=구매링크)
- 브랜드 메일/수수료율: `netlify/functions/_brands.mjs` (공개되지 않음)

## Netlify 환경변수
SESSION_SECRET(임의 32자 이상), ADMIN_TOKEN(12자 이상), NAVER_CLIENT_ID, NAVER_CLIENT_SECRET,
TOSS_SECRET_KEY, RESEND_API_KEY, MAIL_FROM, NOTIFY_EMAIL

## 주문 기능 켜기
1. 환경변수 입력 2. config.js: MODE "checkout", TOSS_CLIENT_KEY, LOGIN true 3. 푸시
관리자: /admin/ (ADMIN_TOKEN 입력)

## 배포 전 필수 점검
`python3 scripts/check.py` — 진단(/)과 스토어(/store)의 로고, 헤더, 하단 메뉴 크기가 모든 화면 폭에서 같은지 검사. 실패하면 배포하지 않는다.
