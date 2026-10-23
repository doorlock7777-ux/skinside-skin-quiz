"""히든 버튼 검사: 스토어에 늦게 쑥 올라오고, 반투명이며, 하단 메뉴를 가리지 않고, 제품 상세 같은 화면에서는 숨는지. 관리자 화면 저장도 확인.  사용: python3 scripts/check_hidden.py"""
import os, subprocess, sys, tempfile
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
T = tempfile.gettempdir(); o1 = os.path.join(T, "chk_hid1.html"); o2 = os.path.join(T, "chk_hid2.html"); o3 = os.path.join(T, "chk_hid3.html")
subprocess.run([sys.executable, os.path.join(R, "scripts/build_demo.py"), o1], check=True, stdout=subprocess.DEVNULL)
subprocess.run([sys.executable, os.path.join(R, "scripts/build_demo.py"), o2], check=True, stdout=subprocess.DEVNULL, env=dict(os.environ, DEMO_MODE="checkout"))
subprocess.run([sys.executable, os.path.join(R, "scripts/build_admin_demo.py"), o3], check=True, stdout=subprocess.DEVNULL)
from playwright.sync_api import sync_playwright
err = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 400, "height": 860}); pg.goto("file://" + o1); pg.wait_for_timeout(500)
    st0 = pg.evaluate("(()=>{var e=document.getElementById('hb');return e?e.classList.contains('show'):null})()")
    if st0: err.append("처음부터 보이면 안 돼요(쑥 올라오는 동작이 없어요)")
    pg.wait_for_timeout(2600)
    info = pg.evaluate("(()=>{var e=document.getElementById('hb');if(!e)return null;var r=e.getBoundingClientRect(),t=document.querySelector('.tabs').getBoundingClientRect(),c=getComputedStyle(e);return {txt:e.innerText,href:e.getAttribute('href'),bg:c.backgroundColor,op:c.opacity,top:r.top,bot:r.bottom,tabTop:t.top,w:r.width,color:c.color,target:e.target}})()")
    if not info: err.append("히든 버튼이 안 나와요")
    else:
        if "특가" not in info["txt"]: err.append("문구가 달라요: " + info["txt"])
        if not info["href"].startswith("https://"): err.append("링크가 달라요")
        if info["target"] != "_blank": err.append("새 탭으로 열려야 해요")
        a = info["bg"].replace("rgba(", "").replace(")", "").split(",")
        if len(a) < 4 or not (0.4 <= float(a[3]) <= 0.9): err.append("반투명이 아니에요: " + info["bg"])
        if info["color"] != "rgb(255, 255, 255)": err.append("글자가 흰색이 아니에요")
        if info["bot"] > info["tabTop"] + 0.5: err.append("하단 메뉴를 가려요")
        if info["w"] > 400: err.append("화면 너비를 넘어요")
    pg.screenshot(path=os.path.join(T, "hidden_shot.png"))
    pg2 = b.new_page(viewport={"width": 400, "height": 860}); pg2.goto("file://" + o2); pg2.wait_for_timeout(2500)
    if not pg2.evaluate("document.getElementById('hb') && document.getElementById('hb').classList.contains('show')"): err.append("쇼핑몰 모드 홈에서 안 보여요")
    pg2.click(".pc >> nth=0"); pg2.wait_for_timeout(500)
    if pg2.evaluate("document.getElementById('hb').classList.contains('show')"): err.append("제품 상세에서 구매 버튼을 가려요")
    pg2.evaluate("window.__goto('#/cart')"); pg2.wait_for_timeout(400)
    if pg2.evaluate("document.getElementById('hb').classList.contains('show')"): err.append("장바구니에서 주문 버튼을 가려요")
    pg2.evaluate("window.__goto('#/')"); pg2.wait_for_timeout(700)
    if not pg2.evaluate("document.getElementById('hb').classList.contains('show')"): err.append("홈으로 돌아와도 다시 안 보여요")
    # 관리자: 제품 탭 히든 버튼 저장
    pg3 = b.new_page(viewport={"width": 1280, "height": 900}); pg3.goto("file://" + o3); pg3.wait_for_timeout(600)
    a = pg3.frames[1]
    for i in ["li", "lp", "l2"]: a.fill("#" + i, "demo1234")
    a.locator("button:has-text('로그인')").click(); pg3.wait_for_timeout(900)
    a.get_by_text("제품", exact=True).first.click(); pg3.wait_for_timeout(700)
    if "히든 버튼" not in a.inner_text("body"): err.append("관리자 제품 탭에 히든 버튼이 없어요")
    else:
        a.fill("#htx", "블랙프라이데이 특가 시작"); a.fill("#hur", "https://example.com/bf"); a.uncheck("#hon"); a.click("#hsv"); pg3.wait_for_timeout(500)
        if "저장했어요" not in a.inner_text("#hms"): err.append("저장 안내가 안 떠요: " + a.inner_text("#hms"))
        if "블랙프라이데이" not in a.inner_text("#hpv"): err.append("미리보기가 안 바뀌어요")
print("OK: 히든 버튼 정상" if not err else "FAIL: " + "; ".join(err)); sys.exit(1 if err else 0)
