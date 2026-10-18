"""관리자 페이지, 진단 분석 화면, 카카오 화면 검사.  사용: python3 scripts/check_admin.py"""
import json, os, random, re, subprocess, sys, tempfile
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
T = tempfile.gettempdir(); err = []
def build(s, o): subprocess.run([sys.executable, os.path.join(R, "scripts", s), o], check=True, stdout=subprocess.DEVNULL)
a, q = os.path.join(T, "chk_admin.html"), os.path.join(T, "chk_quiz.html"); build("build_admin_demo.py", a); build("build_quiz_demo.py", q)
adm = open(os.path.join(R, "public/admin/index.html"), encoding="utf-8").read(); qz = open(os.path.join(R, "public/quiz/index.html"), encoding="utf-8").read()
ca = re.search(r'COUNTER_API = "([^"]+)"', adm).group(1); cq = re.search(r'COUNTER_API = "([^"]+)"', qz).group(1)
if ca != cq: err.append("관리자와 진단 페이지의 통계 주소가 달라요")
if 'name="robots" content="noindex' not in adm: err.append("관리자 페이지에 noindex가 없어요")
from playwright.sync_api import sync_playwright
from PIL import Image
Image.new("RGB", (300, 400), (200, 120, 90)).save(os.path.join(T, "chk_prod.png"))
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (390, 1000):
        pg = b.new_page(viewport={"width": w, "height": 900}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("file://" + a); pg.wait_for_timeout(900)
        if errs: err.append("관리자 페이지 오류: %s" % errs)
        if pg.locator(".bars li").count() != 10: err.append("TOP 10이 10개가 아니에요 (%dpx)" % w)
        if pg.locator(".tp").count() < 5 or pg.locator(".seg").count() != 4: err.append("피부타입 통계가 안 보여요")
        if "8,144" not in pg.inner_text("#dv"): err.append("카카오 채널 현황이 안 보여요")
        if pg.evaluate("document.documentElement.scrollWidth") > w: err.append("관리자 페이지가 가로로 넘쳐요 (%dpx)" % w)
        for t in pg.locator(".tp span").all_inner_texts():
            pass
        if pg.evaluate("[...document.querySelectorAll('.tp span')].some(e=>e.scrollWidth>e.clientWidth+1)"): err.append("피부타입 통계 글자가 잘려요 (%dpx)" % w)
        pg.click("nav button[data-t=add]"); pg.wait_for_timeout(200)
        for lab in ["제품 이미지", "제품명", "브랜드명", "정가", "할인가", "카테고리", "바로가기 링크"]:
            if lab not in pg.inner_text("#mn"): err.append("제품 추가 입력칸이 없어요: " + lab)
        pg.set_input_files("#fi", os.path.join(T, "chk_prod.png")); pg.wait_for_timeout(500)
        pg.fill("#fn", "검사 제품"); pg.fill("#fb", "CHK"); pg.fill("#fl", "30000"); pg.fill("#fp", "21000"); pg.select_option("#fc", "sk"); pg.fill("#fu", "https://example.com/x")
        pg.click("#fs"); pg.wait_for_timeout(500)
        if "검사 제품" not in pg.inner_text("#pl"): err.append("제품 추가가 동작하지 않아요")
        pg.fill("#fp", "50000"); pg.set_input_files("#fi", os.path.join(T, "chk_prod.png")); pg.wait_for_timeout(400); pg.fill("#fn", "x"); pg.fill("#fb", "x"); pg.fill("#fu", "https://e.com"); pg.fill("#fl", "30000"); pg.click("#fs"); pg.wait_for_timeout(400)
        if "정가" not in pg.inner_text("#fm"): err.append("할인가가 정가보다 커도 등록돼요")
    pg = b.new_page(viewport={"width": 900, "height": 900}); pg.goto("file://" + a); pg.wait_for_timeout(700)
    pg.click("#ordl"); pg.wait_for_timeout(1000)
    if pg.frame_locator("#ordf").locator(".o").count() != 3: err.append("미리보기에서 주문 관리가 열리지 않아요")
    pg.frame_locator("#ordf").locator("a:has-text('관리자 홈')").click(); pg.wait_for_timeout(300)
    if not pg.locator("#ordf").is_hidden(): err.append("주문 관리에서 관리자 홈으로 돌아가지 않아요")
    for l in pg.locator("header a").all(): 
        if (l.get_attribute("href") or "").startswith("/"): err.append("관리자 헤더에 미리보기에서 열리지 않는 링크가 있어요: " + (l.get_attribute("href") or ""))
    # 로그인 없이 열면 막혀야 한다 (미리보기가 아닌 실제 페이지)
    pg = b.new_page(); pg.goto("file://" + os.path.join(R, "public/admin/index.html")); pg.wait_for_timeout(500)
    if pg.locator("#tk").count() != 1: err.append("토큰 없이 관리자 화면이 열려요")
    # 진단: 분석 중 4초 -> 카카오 화면
    pg = b.new_page(viewport={"width": 400, "height": 800})
    st = {"screen": "result", "i": 0, "a": [random.randint(0, 3) for _ in range(29)], "c": [random.randint(0, 3) for _ in range(5)], "start": 0, "simple": False, "notify": False, "recorded": False}
    pg.add_init_script("localStorage.removeItem('skinside_unlocked');localStorage.setItem('skinside_quiz_v2',%r)" % json.dumps(st))
    pg.goto("file://" + os.path.join(R, "public/quiz/index.html")); pg.wait_for_timeout(1000)
    if "피부타입 분석 중" not in pg.inner_text("#app"): err.append("분석 중 화면이 안 보여요")
    pg.wait_for_timeout(2400)
    if pg.locator(".an").count() != 1: err.append("분석 화면이 4초 전에 끝나요")
    pg.wait_for_timeout(1800)
    if pg.locator(".an").count() != 0 or pg.locator("#kk").count() != 1: err.append("분석 화면이 4초 뒤 카카오 화면으로 넘어가지 않아요")
    else:
        bg = pg.evaluate("getComputedStyle(document.getElementById('kk')).backgroundColor")
        if bg != "rgb(254, 229, 0)": err.append("카카오 버튼 색이 달라요: " + bg)
        tx = pg.inner_text("#app")
        for need in ["문장군", "친구 8,144", "카카오톡 채널 추가하기"]:
            if need not in tx: err.append("카카오 화면에 없어요: " + need)
    # 결과를 이미 본 사람(S.shown)에게는 분석 화면이 뜨지 않는다
    pg = b.new_page(viewport={"width": 400, "height": 800}); st2 = dict(st, shown=True)
    pg.add_init_script("localStorage.setItem('skinside_unlocked','1');localStorage.setItem('skinside_quiz_v2',%r)" % json.dumps(st2))
    pg.goto("file://" + os.path.join(R, "public/quiz/index.html")); pg.wait_for_timeout(1200)
    if pg.locator(".an").count(): err.append("결과를 이미 본 사람에게 분석 중 화면이 떠요")
    if "알파벳의 의미" in pg.inner_text("#app"): err.append("결과 화면에 '알파벳의 의미' 문구가 남아 있어요")
    b.close()
print("\n".join(err) if err else "OK: 관리자, 분석 화면, 카카오 화면 모두 정상"); sys.exit(1 if err else 0)
