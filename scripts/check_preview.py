"""통합 미리보기: 스토어 -> 피부 진단 -> 스토어 전환이 같은 화면 안에서 되는지 검사.  사용: python3 scripts/check_preview.py"""
import os, subprocess, sys, tempfile
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
o = os.path.join(tempfile.gettempdir(), "chk_preview.html"); subprocess.run([sys.executable, os.path.join(R, "scripts/build_preview.py"), o], check=True, stdout=subprocess.DEVNULL)
from playwright.sync_api import sync_playwright
err = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 400, "height": 800}); popups = []; pg.context.on("page", lambda x: popups.append(x))
    pg.goto("file://" + o); pg.wait_for_timeout(1500)
    s = pg.frame_locator("#fs")
    if s.locator(".chip").count() < 5: err.append("스토어가 안 보여요")
    s.locator("nav.tabs a:has-text('피부 진단')").click(); pg.wait_for_timeout(1200)
    if pg.locator("#fq").is_hidden() or not pg.locator("#fs").is_hidden(): err.append("피부 진단 탭을 눌러도 화면이 전환되지 않아요")
    if popups: err.append("새 창이 열려요")
    q = pg.frame_locator("#fq")
    pg.wait_for_timeout(5200)
    if q.locator("#kk").count() != 1: err.append("진단 완료 상태에서 분석 중 -> 카카오 화면이 안 나와요")
    q.locator("#ok").evaluate("e=>e.disabled=false"); q.locator("#ok").click(); pg.wait_for_timeout(600)
    if q.locator(".code").inner_text().strip() != "ORNT": err.append("스토어 카드(ORNT)와 진단 결과가 달라요: " + q.locator(".code").inner_text())
    q.locator("#pvgo").click(); pg.wait_for_timeout(5600)
    if q.locator("#kk").count() != 1: err.append("분석 중 -> 카카오 화면이 안 나와요")
    q.locator("nav.mt a:has-text('스토어')").click(); pg.wait_for_timeout(500)
    if pg.locator("#fs").is_hidden(): err.append("진단에서 스토어 탭을 눌러도 돌아가지 않아요")
    if popups: err.append("새 창이 열려요")
    b.close()
print("\n".join(err) if err else "OK: 스토어와 진단이 한 화면에서 전환돼요"); sys.exit(1 if err else 0)
