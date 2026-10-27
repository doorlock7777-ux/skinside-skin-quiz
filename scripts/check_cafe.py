"""결과 화면 '카페에 공유하고 질문하기' 버튼 시험.  사용: python3 scripts/check_cafe.py"""
import os, tempfile
from playwright.sync_api import sync_playwright
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = open(os.path.join(R, "public/quiz/index.html"), encoding="utf-8").read()
err = []

def to_result(pg):
    pg.goto("file://" + PATH + "?t=3"); pg.wait_for_timeout(700); pg.click("#go"); pg.wait_for_timeout(200)
    for _ in range(60):
        if pg.locator(".opt").count() == 0: break
        pg.locator(".opt").nth(0).click(); pg.wait_for_timeout(100)
    pg.wait_for_timeout(300); pg.click("#sk")
    for _ in range(80):
        if pg.locator(".code").count(): break
        if pg.locator("#ok").count(): pg.locator("#ok").evaluate("e=>e.disabled=false"); pg.locator("#ok").click()
        pg.wait_for_timeout(150)

with sync_playwright() as p:
    b = p.chromium.launch()
    for url in ["", "https://cafe.naver.com/skinsidetest"]:
        html = SRC.replace('cafe:  ""', 'cafe:  "%s"' % url, 1)
        assert html != SRC or not url
        fd, PATH = tempfile.mkstemp(suffix=".html", dir=os.path.join(R, "public/quiz")); os.write(fd, html.encode("utf-8")); os.close(fd)
        try:
            ctx = b.new_context(viewport={"width": 390, "height": 900}); pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.add_init_script("window.__opened=[];window.open=function(u){window.__opened.push(u);return null};window.__copied='';Object.defineProperty(navigator,'clipboard',{value:{writeText:function(t){window.__copied=t;return Promise.resolve()}}});")
            to_result(pg)
            key = pg.locator(".code").inner_text().strip()
            if not url:
                if pg.locator("#cf").count(): err.append("카페 주소가 비어 있으면 버튼이 숨겨져야 해요")
            else:
                if pg.locator("#cf").count() != 1: err.append("카페 버튼이 안 보여요")
                else:
                    pg.locator("#cf").scroll_into_view_if_needed(); pg.screenshot(path="/tmp/cafe_btn.png")
                    pg.click("#cf"); pg.wait_for_timeout(300)
                    op = pg.evaluate("window.__opened"); cp = pg.evaluate("window.__copied")
                    if op != [url]: err.append("카페 주소가 열려야 해요: %s" % op)
                    if key not in cp or "skinside.co.kr" not in cp or "[질문]" not in cp: err.append("복사 내용이 이상해요: %r" % cp)
                    if pg.locator("#cfm").evaluate("e=>getComputedStyle(e).display") == "none": err.append("복사 안내가 안 보여요")
                    ov = pg.evaluate("document.documentElement.scrollWidth > innerWidth")
                    if ov: err.append("가로 스크롤이 생겼어요")
            if errs: err.append("스크립트 오류: %s" % errs)
        finally: os.remove(PATH)
    b.close()
print("FAIL\n" + "\n".join(err) if err else "OK: 카페 공유 버튼 정상")
raise SystemExit(1 if err else 0)
