"""결제 흐름 미리보기 검사: 네이버페이가 기본 결제수단이고 결제창에 네이버페이로 전달되는지.  사용: python3 scripts/check_checkout.py"""
import os, subprocess, sys, tempfile
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
o = os.path.join(tempfile.gettempdir(), "chk_checkout.html")
subprocess.run([sys.executable, os.path.join(R, "scripts/build_demo.py"), o], check=True, stdout=subprocess.DEVNULL, env=dict(os.environ, DEMO_MODE="checkout"))
from playwright.sync_api import sync_playwright
err = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 400, "height": 1200}); pg.goto("file://" + o); pg.wait_for_timeout(900)
    pg.click(".pc >> nth=0"); pg.wait_for_timeout(300); pg.click("text=바로 구매"); pg.wait_for_timeout(400); pg.click("text=네이버로 시작하기 (데모)"); pg.wait_for_timeout(900)
    t = pg.locator(".pay2 button").all_inner_texts()
    if not t or "네이버페이" not in t[0]: err.append("결제수단 첫 번째가 네이버페이가 아니에요: %s" % t)
    if "on" not in (pg.locator(".pay2 button").first.get_attribute("class") or ""): err.append("네이버페이가 기본 선택이 아니에요")
    pg.fill("#nm", "홍길동"); pg.fill("#ph", "010-1111-2222"); pg.click("#sa"); pg.check("#ag"); pg.click("#pay"); pg.wait_for_timeout(500)
    if "네이버페이" not in pg.inner_text("body"): err.append("결제창에 네이버페이가 전달되지 않아요")
    # 내 주문: 발송 전엔 문의만, 발송 후엔 반품 가능. 문의 -> 답변란 -> 확인 요청
    import json
    st = {"user": {"id": "n_demo", "name": "홍길동", "email": "d@x.com", "phone": "010-1234-5678"}, "orders": [{"id": "SK1", "userId": "n_demo", "status": "paid", "total": 32900, "createdAt": "2026-10-18T01:00:00Z", "shipments": {}, "items": [{"id": "bonkorea-cl", "brand": "bonkorea", "name": "엔젤 탄산 효소 세안제", "optName": "", "q": 1, "unit": 29900}]}, {"id": "SK2", "userId": "n_demo", "status": "shipped", "total": 32900, "createdAt": "2026-10-17T01:00:00Z", "shipments": {"bonkorea": {"carrier": "cj", "tracking": "123456789012"}}, "items": [{"id": "bonkorea-cl", "brand": "bonkorea", "name": "엔젤 탄산 효소 세안제", "optName": "", "q": 1, "unit": 29900}]}]}
    pg2 = b.new_page(viewport={"width": 400, "height": 1200}); errs = []; pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.add_init_script("localStorage.setItem('skd', %r)" % json.dumps(st)); pg2.goto("file://" + o); pg2.wait_for_timeout(900); pg2.click("text=내 정보"); pg2.wait_for_timeout(500); pg2.click("a:has-text('주문 내역')"); pg2.wait_for_timeout(1000)
    if pg2.locator("[data-cs=open]").count() != 2: err.append("주문마다 문의·교환·반품 버튼이 있어야 해요")
    pg2.locator("[data-cs=open]").nth(0).click(); pg2.fill("[data-form] textarea", "사이즈가 안 맞아요"); pg2.select_option("[data-form] select", "return"); pg2.click("[data-cs=new]"); pg2.wait_for_timeout(900)
    if "반품" not in pg2.inner_text(".ord >> nth=0") or "답변 대기" not in pg2.inner_text("body"): err.append("반품 신청이 주문 내역에 보이지 않아요")
    pg2.locator("[data-cs=open]").nth(1).click(); pg2.select_option("[data-form] select", "return"); pg2.fill("[data-form] textarea", "x반품"); pg2.click("[data-cs=new]"); pg2.wait_for_timeout(600)
    if "발송 후" not in pg2.inner_text("body"): err.append("발송 전 주문에 반품이 신청돼요")
    pg2.fill("[data-rt]", "추가 문의"); pg2.click("[data-cs=reply]"); pg2.wait_for_timeout(800)
    if "추가 문의" not in pg2.inner_text("body"): err.append("고객 추가 메시지가 보이지 않아요")
    pg2.click("[data-cs=escalate]"); pg2.wait_for_timeout(800)
    if "확인을 요청했어요" not in pg2.inner_text("body"): err.append("운영자 확인 요청 표시가 없어요")
    if errs: err.append("페이지 오류: %s" % errs)
    b.close()
print("\n".join(err) if err else "OK: 네이버페이 결제 흐름 정상"); sys.exit(1 if err else 0)
