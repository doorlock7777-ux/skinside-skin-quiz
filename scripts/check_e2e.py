"""처음부터 끝까지 실제로 눌러보는 시험: 진단(전체 경로) -> 결과 -> 다시 진단 -> 스토어 카드 연동.  사용: python3 scripts/check_e2e.py"""
import json, os, re, subprocess, sys, tempfile
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
err = []
from playwright.sync_api import sync_playwright

def answer_all(root, pick, page):
    """질문 화면이 나오는 동안 같은 위치의 선택지를 계속 누른다 (진단 29문항 + 확인 5문항)"""
    for _ in range(60):
        if root.locator(".opt").count() == 0: break
        root.locator(".opt").nth(pick if pick >= 0 else root.locator(".opt").count() - 1).click(); page.wait_for_timeout(110)

def to_result(root, page, simple=True):
    """질문 이후: 간이 진단(건너뛰기) 또는 타이머, 분석 중, 카카오 화면을 지나 결과까지"""
    page.wait_for_timeout(300)
    if root.locator("#sk").count() and simple: root.locator("#sk").click()
    page.wait_for_timeout(300)
    for _ in range(80):
        if root.locator(".code").count(): break
        if root.locator("#ok").count():
            root.locator("#ok").evaluate("e=>e.disabled=false"); root.locator("#ok").click()
        page.wait_for_timeout(150)
    return root.locator(".code").inner_text().strip() if root.locator(".code").count() else None

with sync_playwright() as p:
    b = p.chromium.launch()
    # 1) 실제 진단 페이지 전체 경로 (타이머 3초)
    pg = b.new_page(viewport={"width": 400, "height": 900}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + os.path.join(R, "public/quiz/index.html") + "?t=3"); pg.wait_for_timeout(900)
    pg.click("#go"); pg.wait_for_timeout(200)
    answer_all(pg, 0, pg)                       # 29문항
    pg.click("#st"); pg.wait_for_timeout(4000)  # 세안 후 대기 (3초)
    if pg.locator(".opt").count() == 0: err.append("대기 후 확인 질문이 안 나와요")
    answer_all(pg, 0, pg)                       # 확인 5문항
    seen = False
    for _ in range(60):
        if pg.locator(".an").count(): seen = True
        if pg.locator("#kk").count() or pg.locator(".code").count(): break
        pg.wait_for_timeout(150)
    if not seen: err.append("전체 경로에서 분석 중 화면이 안 보여요")
    code1 = to_result(pg, pg, simple=False)
    saved1 = json.loads(pg.evaluate("localStorage.getItem('skinside_result')") or "null")
    if not code1: err.append("전체 경로에서 결과가 안 나와요")
    elif not saved1 or saved1["key"] != code1: err.append("결과(%s)와 저장된 결과(%s)가 달라요" % (code1, saved1 and saved1["key"]))
    # 다시 진단 -> 다른 답 -> 새 결과가 저장돼야 한다
    pg.click("#rs"); pg.wait_for_timeout(300); pg.click("#go"); answer_all(pg, -1, pg)
    pg.wait_for_timeout(300); pg.click("#sk")
    saw2 = False
    for _ in range(60):
        if pg.locator(".an").count(): saw2 = True
        if pg.locator(".code").count(): break
        pg.wait_for_timeout(150)
    if not saw2: err.append("다시 진단하면 분석 중 화면이 다시 나와야 해요")
    code2 = pg.locator(".code").inner_text().strip() if pg.locator(".code").count() else None
    saved2 = json.loads(pg.evaluate("localStorage.getItem('skinside_result')") or "null")
    if not code2: err.append("다시 진단 결과가 안 나와요")
    else:
        if code2 == code1: err.append("서로 다른 답인데 결과가 같아요(%s)" % code2)
        if not saved2 or saved2["key"] != code2: err.append("다시 진단한 결과(%s)가 저장되지 않았어요(%s)" % (code2, saved2 and saved2["key"]))
    pg.reload(); pg.wait_for_timeout(800)
    if pg.locator(".an").count(): err.append("결과를 본 뒤 새로고침하면 분석 중 화면이 떠요")
    if errs: err.append("진단 페이지 오류: %s" % errs)

    # 2) 통합 미리보기: 스토어 카드 -> 진단 -> 다시 진단 -> 스토어 카드가 새 결과로 바뀌어야 한다
    o = os.path.join(tempfile.gettempdir(), "chk_e2e_preview.html")
    subprocess.run([sys.executable, os.path.join(R, "scripts/build_preview.py"), o], check=True, stdout=subprocess.DEVNULL)
    pg = b.new_page(viewport={"width": 400, "height": 900}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + o); pg.wait_for_timeout(1500)
    S, Q = pg.frame_locator("#fs"), pg.frame_locator("#fq")
    card = lambda: S.locator(".hero.my .cd").inner_text().strip() if S.locator(".hero.my .cd").count() else None
    if card() != "ORNT": err.append("미리보기 스토어 카드가 처음에 ORNT가 아니에요: %s" % card())
    S.locator("nav.tabs a:has-text('피부 진단')").click(); pg.wait_for_timeout(5600)
    q1 = to_result(Q, pg)
    if q1 != "ORNT": err.append("스토어 카드(ORNT)와 진단 결과(%s)가 달라요" % q1)
    for pick in (-1, 0, -1):
        Q.locator("#rs").click(); pg.wait_for_timeout(300); Q.locator("#go").click(); answer_all(Q, pick, pg)
        qn = to_result(Q, pg)
        Q.locator("nav.mt a:has-text('스토어')").click(); pg.wait_for_timeout(700)
        if card() != qn: err.append("다시 진단한 결과(%s)가 스토어 카드(%s)에 반영되지 않아요" % (qn, card()))
        S.locator("nav.tabs a:has-text('피부 진단')").click(); pg.wait_for_timeout(700)
        if Q.locator(".an").count(): err.append("결과를 본 직후 진단으로 돌아오면 분석 중 화면이 떠요")
    pg.reload(); pg.wait_for_timeout(1500)
    last = card()
    if last is None: err.append("새로고침 후 스토어 카드가 사라졌어요")
    if last == "ORNT" and qn != "ORNT": err.append("새로고침하면 새 결과가 예시(ORNT)로 되돌아가요")
    if errs: err.append("미리보기 오류: %s" % errs)
    b.close()
print("\n".join(err) if err else "OK: 진단 -> 결과 -> 다시 진단 -> 스토어 카드 연동 정상"); sys.exit(1 if err else 0)
