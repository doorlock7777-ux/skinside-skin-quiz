"""배포 전 필수 점검: 두 페이지(진단 /, 스토어 /store)의 공통 요소(로고, 헤더, 하단 메뉴) 크기가 같은지 확인."""
import asyncio, subprocess, sys, time, os
from playwright.async_api import async_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
SRV = '''import http.server,os
os.chdir(%r)
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self,p):
        p=p.split("?")[0]
        if p=="/": p="/quiz/index.html"
        if p=="/store": p="/index.html"
        return super().translate_path(p)
    def log_message(self,*a): pass
http.server.HTTPServer(("",8799),H).serve_forever()''' % os.path.abspath(ROOT)
JS = '''()=>{const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]};
const h=document.querySelector("header");return {logo:r(h&&h.querySelector("img")),header:r(h),tabs:r(document.querySelector(".mt,.tabs")),tabitems:[...document.querySelectorAll(".mt a,.tabs a")].map(a=>r(a))}}'''
async def main():
    srv = subprocess.Popen([sys.executable, "-c", SRV]); time.sleep(1); bad = 0
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in (360, 400, 768, 1200):
            pg = await b.new_page(viewport={"width": w, "height": 800}); res = {}
            for name, path in (("진단", "/"), ("스토어", "/store")):
                await pg.goto("http://localhost:8799" + path); await pg.wait_for_timeout(700); res[name] = await pg.evaluate(JS)
            for k in ("logo", "header", "tabs", "tabitems"):
                if res["진단"][k] != res["스토어"][k]:
                    bad += 1; print("불일치", w, k, res["진단"][k], res["스토어"][k])
        await b.close()
    srv.kill(); print("OK 모든 항목 일치" if not bad else "실패 %d건" % bad); sys.exit(1 if bad else 0)
asyncio.run(main())
