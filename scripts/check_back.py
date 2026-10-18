"""뒤로가기 시험(실제 브라우저 기록). 칩을 여러 번 눌러도 뒤로가기 한 번이면 전체로.  사용: python3 scripts/check_back.py"""
import os, sys, shutil, tempfile, threading, http.server, functools
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
t = tempfile.mkdtemp(); shutil.copytree(os.path.join(R, "public"), t + "/p")
c = open(t + "/p/config.js", encoding="utf-8").read().replace("STORE_OPEN: false", "STORE_OPEN: true"); open(t + "/p/config.js", "w", encoding="utf-8").write(c)
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H, directory=t + "/p"))
threading.Thread(target=srv.serve_forever, daemon=True).start()
from playwright.sync_api import sync_playwright
err = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 400, "height": 900}); pg.set_default_timeout(4000)
    pg.route("**/api/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.goto("http://127.0.0.1:%d/index.html" % srv.server_port); pg.wait_for_timeout(1200)
    chip = lambda n: pg.locator(".chips a.chip:has-text('%s')" % n).first.click()
    h = lambda: pg.evaluate("location.hash") or "#/"
    pg.goto("http://127.0.0.1:%d/index.html#/" % srv.server_port); pg.wait_for_timeout(600)
    for n in ("스킨케어", "선케어", "블랙헤드"): chip(n); pg.wait_for_timeout(250)
    if "/c/blackhead" not in h(): err.append("블랙헤드로 안 갔어요: " + h())
    pg.go_back(); pg.wait_for_timeout(400)
    if h() != "#/": err.append("뒤로가기 1번에 전체가 아니에요: " + h())
    # 전체 칩으로 돌아오는 경우도 기록이 꼬이면 안 된다
    for n in ("스킨케어", "선케어"): chip(n); pg.wait_for_timeout(250)
    chip("전체"); pg.wait_for_timeout(300)
    if h() != "#/": err.append("전체 칩이 안 먹어요: " + h())
    b.close()
print("\n".join(err) if err else "OK: 칩 이동 후 뒤로가기 한 번이면 전체로 돌아가요"); sys.exit(1 if err else 0)
