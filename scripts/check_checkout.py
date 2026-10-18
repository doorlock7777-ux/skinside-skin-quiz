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
    b.close()
print("\n".join(err) if err else "OK: 네이버페이 결제 흐름 정상"); sys.exit(1 if err else 0)
