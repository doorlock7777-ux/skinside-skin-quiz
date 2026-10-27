"""사이트 공지 띠 검사: 실제 스토어·진단 페이지에 가짜 /api/notice 응답을 넣고 띠 위치, 접기/펴기, 새 공지에서 다시 펼침, 두 화면 글꼴 일치, 글자 세로 가운데, 가로 넘침을 본다.
사용: python3 scripts/check_notice.py [스크린샷 저장 폴더]"""
import functools, http.server, json, os, sys, threading
from playwright.sync_api import sync_playwright
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SHOT = sys.argv[1] if len(sys.argv) > 1 else None
err = []
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(type("Q", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *a: None}), directory=os.path.join(R, "public")))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d" % srv.server_address[1]
N1 = {"text": "10월 31일까지 전 제품 무료배송이에요. 진단 결과에 맞는 제품을 확인해보세요.", "link": "/store", "linkText": "스토어 보기", "until": "", "updatedAt": "2026-10-27T08:00:00.000Z"}
STATE = {"n": N1}
PAGES = [("/index.html", "스토어"), ("/quiz/index.html", "진단")]
STYLE = """() => { const b = document.getElementById('sk-nt'), f = b.querySelector('.fd'), m = b.querySelector('.m'), s = (e) => { const c = getComputedStyle(e); return [c.fontFamily, c.fontWeight, c.fontSize, Math.round(e.getBoundingClientRect().height)].join('|'); };
  const mid = (e) => { const r = document.createRange(); r.selectNodeContents(e); const a = r.getBoundingClientRect(), o = e.getBoundingClientRect(); return Math.abs((a.top + a.bottom) / 2 - (o.top + o.bottom) / 2); };
  return {box: s(b), fold: s(f), text: s(m), foldMid: mid(f), linkMid: b.querySelector('a') ? mid(b.querySelector('a')) : 0, tagMid: mid(b.querySelector('.tg'))}; }"""
with sync_playwright() as p:
    br = p.chromium.launch()
    styles = {}
    for w in (390, 1000):
        for path, name in PAGES:
            ctx = br.new_context(viewport={"width": w, "height": 900}); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.route("**/api/notice", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"notice": STATE["n"]})))
            STATE["n"] = N1
            pg.goto(BASE + path); pg.wait_for_selector("#sk-nt", timeout=5000)
            box = pg.locator("#sk-nt")
            if pg.evaluate("document.getElementById('sk-nt').previousElementSibling && document.getElementById('sk-nt').previousElementSibling.tagName") != "HEADER": err.append("%s: 공지 띠가 로고(머리글) 바로 아래가 아니에요" % name)
            t = box.inner_text()
            if "공지" not in t or "무료배송" not in t or "스토어 보기" not in t: err.append("%s: 공지 띠 문구·버튼이 없어요 (%dpx)" % (name, w))
            if pg.locator("#sk-nt a").get_attribute("href") != "/store": err.append("%s: 공지 버튼 링크가 달라요" % name)
            if pg.evaluate("document.documentElement.scrollWidth") > w: err.append("%s: 공지 띠 때문에 가로로 넘쳐요 (%dpx)" % (name, w))
            st = pg.evaluate(STYLE); styles.setdefault(w, {})[name] = st
            for k in ("foldMid", "linkMid", "tagMid"):
                if st[k] > 1.5: err.append("%s: 공지 띠 %s 글자가 세로 가운데가 아니에요 (%.1fpx, %dpx)" % (name, k, st[k], w))
            if SHOT: pg.screenshot(path=os.path.join(SHOT, "notice_%s_%d.png" % (path.strip("/").replace("/", "_"), w)), clip={"x": 0, "y": 0, "width": w, "height": 320})
            # 접기: 얇은 띠로 남고 닫히지 않음, 새로고침해도 접힌 상태
            pg.locator("#sk-nt .fd").click()
            if "folded" not in (box.get_attribute("class") or "") or pg.locator("#sk-nt .m").is_visible() or "펼치기" not in pg.locator("#sk-nt .fd").inner_text(): err.append("%s: 접기가 동작하지 않아요" % name)
            if not box.is_visible() or box.bounding_box()["height"] < 20: err.append("%s: 접으면 얇은 띠로 남아야 해요" % name)
            if SHOT and w == 390: pg.screenshot(path=os.path.join(SHOT, "notice_%s_folded.png" % path.strip("/").replace("/", "_")), clip={"x": 0, "y": 0, "width": w, "height": 220})
            pg.reload(); pg.wait_for_selector("#sk-nt", timeout=5000)
            if "folded" not in (pg.locator("#sk-nt").get_attribute("class") or ""): err.append("%s: 새로고침하면 접은 상태가 풀려요" % name)
            # 관리자가 고쳐 저장하면(updatedAt 변경) 다시 펼쳐짐
            STATE["n"] = dict(N1, text="새 공지예요.", updatedAt="2026-10-28T01:00:00.000Z")
            pg.reload(); pg.wait_for_selector("#sk-nt", timeout=5000)
            if "folded" in (pg.locator("#sk-nt").get_attribute("class") or "") or "새 공지예요" not in pg.locator("#sk-nt").inner_text(): err.append("%s: 새 공지가 저장돼도 다시 펼쳐지지 않아요" % name)
            pg.locator("#sk-nt .fd").click(); pg.locator("#sk-nt .fd").click()
            if "folded" in (pg.locator("#sk-nt").get_attribute("class") or ""): err.append("%s: 펼치기가 동작하지 않아요" % name)
            # 링크 없는 공지, 공지 없음
            STATE["n"] = dict(N1, link="", linkText="")
            pg.reload(); pg.wait_for_selector("#sk-nt", timeout=5000)
            if pg.locator("#sk-nt a").count(): err.append("%s: 링크가 없는데 버튼이 보여요" % name)
            STATE["n"] = None
            pg.reload(); pg.wait_for_timeout(800)
            if pg.locator("#sk-nt").count(): err.append("%s: 공지가 꺼졌는데 띠가 보여요" % name)
            if errs: err.append("%s: 스크립트 오류 %s" % (name, errs[:2]))
            ctx.close()
        a, b = styles[w]["스토어"], styles[w]["진단"]
        for k in ("box", "fold", "text"):
            if a[k] != b[k]: err.append("스토어와 진단의 공지 띠 %s 모양이 달라요 (%dpx): %s / %s" % (k, w, a[k], b[k]))
    br.close()
srv.shutdown()
print("FAIL\n" + "\n".join(err) if err else "OK: 공지 띠(위치, 접기/펴기, 새 공지 다시 펼침, 두 화면 글꼴 일치) 정상")
sys.exit(1 if err else 0)
