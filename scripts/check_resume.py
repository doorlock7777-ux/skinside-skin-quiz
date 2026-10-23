"""진단 진입 화면 검사: 진단을 끝낸 사람은 결과 쪽, 안 끝낸 사람은 질문 중간·타이머에서 다시 열어도 항상 시작 화면.  사용: python3 scripts/check_resume.py"""
import json, os, sys
from playwright.sync_api import sync_playwright
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
U = "file://" + os.path.join(R, "public/quiz/index.html")
err = []
def st(screen, **k):
    d = {"screen": screen, "i": 0, "a": [], "c": [], "start": 0, "simple": False, "notify": False, "recorded": False}; d.update(k); return json.dumps(d)
with sync_playwright() as p:
    b = p.chromium.launch()
    def open_with(state, extra=None):
        pg = b.new_page(viewport={"width": 400, "height": 860}); pg.goto(U)
        pg.evaluate("(a)=>{localStorage.clear();if(a[0])localStorage.setItem('skinside_quiz_v2',a[0]);if(a[1])localStorage.setItem('skinside_unlocked','1')}", [state, extra]); pg.reload(); pg.wait_for_timeout(600); return pg
    for name, s in [("질문 1", st("q", i=0)), ("질문 12", st("q", i=11, a=[0] * 11)), ("타이머", st("timer", start=1)), ("확인 질문", st("check", i=3)), ("소개", st("intro"))]:
        pg = open_with(s)
        if pg.evaluate("S.screen") != "start" or "진단 시작하기" not in pg.inner_text("body"): err.append("%s에서 열었는데 시작 화면이 아니에요: %s" % (name, pg.evaluate("S.screen")))
    pg = open_with(None)
    if "진단 시작하기" not in pg.inner_text("body"): err.append("처음 온 사람에게 시작 화면이 안 떠요")
    pg = open_with(st("result", a=[0] * 30, c=[0] * 5, analyzed=True), True)
    if pg.evaluate("S.screen") != "result" or "진단 시작하기" in pg.inner_text("body"): err.append("진단을 끝낸 사람에게 결과 화면이 안 떠요")
    pg = open_with(st("result", a=[0] * 30, c=[0] * 5), None)
    if pg.evaluate("S.screen") != "result" or "진단 시작하기" in pg.inner_text("body"): err.append("진단을 끝낸 사람(카카오 전)에게 결과 쪽 화면이 안 떠요")
print("OK: 진단 진입 화면(끝낸 사람 결과, 안 끝낸 사람 시작) 정상" if not err else "FAIL: " + "; ".join(err)); sys.exit(1 if err else 0)
