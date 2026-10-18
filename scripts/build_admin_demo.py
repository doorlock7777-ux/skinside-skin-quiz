"""관리자·파트너 페이지 미리보기(단일 HTML). 실제 페이지에 가짜 서버(예시 데이터)만 덧붙여 iframe 두 개로 보여준다.  사용: python3 scripts/build_admin_demo.py <출력경로>"""
import json, os, sys, re
def frag(h):
    """아티팩트는 <html>/<head>/<body>를 직접 쓰지 않으므로 안쪽 내용만 꺼낸다."""
    hd = re.search(r"<head[^>]*>(.*?)</head>", h, re.S).group(1)
    bd = re.search(r"<body[^>]*>(.*)</body>", h, re.S).group(1)
    hd = re.sub(r'<meta charset[^>]*>|<meta name="viewport"[^>]*>', "", hd)
    return hd + "\n" + bd
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
rd = lambda p: open(os.path.join(R, p), encoding="utf-8").read()
ADMIN, PARTNER = "public/admin-answkdrnschkfdudth/index.html", "public/partner-k3x9m2/index.html"
d = json.loads(rd("public/data/products.json"))
mockA = "<script>window.__CATS=%s;\n%s</script>\n" % (json.dumps(d["categories"], ensure_ascii=False), rd("scripts/admin_mock.js"))
a = rd(ADMIN)
a = a.replace('<div id="dm" class="demo" hidden></div>', '<div id="dm" class="demo">미리보기예요. 아이디와 비밀번호 칸에 아무 값이나 입력하면 들어가져요. 숫자는 예시 값이에요.</div>')
a = a.replace("<script>\nvar AV", mockA + "<script>\nvar AV", 1)
assert "__CATS" in a
p = rd(PARTNER)
p = p.replace("<body>", '<body>\n<div style="background:#fff8e6;color:#8a5a00;font-size:12.5px;text-align:center;padding:8px 16px">미리보기예요. 접속 코드 칸에 16자리 아무 코드(예: K7QM-X2PD-R9WT-H4NB)를 입력하면 들어가져요.</div>', 1)
p = p.replace("<script>\nvar M =", "<script>" + rd("scripts/brand_mock.js") + "</script><script>\nvar M =", 1)
assert "/api/partner/login" in p
bar = '''<div id="sw" style="position:sticky;top:0;z-index:5;display:flex;gap:8px;padding:10px 16px;background:#191f28"><button data-v="fa" class="on">관리자 페이지</button><button data-v="fp">파트너 브랜드 페이지</button></div>
<style>#sw button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:8px 16px;background:#333b47;color:#cbd2d9;cursor:pointer}#sw button.on{background:#fff;color:#191f28}.pf{display:none;width:100%;height:calc(100vh - 56px);border:0;background:#f2f4f6}.pf.on{display:block}</style>
<iframe id="fa" class="pf on" title="관리자 페이지"></iframe><iframe id="fp" class="pf" title="파트너 브랜드 페이지"></iframe>
<script>document.getElementById("fa").srcdoc=@@A@@;document.getElementById("fp").srcdoc=@@P@@;
[].forEach.call(document.querySelectorAll("#sw button"),function(b){b.onclick=function(){[].forEach.call(document.querySelectorAll("#sw button,.pf"),function(x){x.classList.remove("on")});b.classList.add("on");document.getElementById(b.dataset.v).classList.add("on")}})</script>'''
bar = bar.replace("@@A@@", json.dumps(a, ensure_ascii=False).replace("</", "<\\/")).replace("@@P@@", json.dumps(p, ensure_ascii=False).replace("</", "<\\/"))
out = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>관리자·파트너 미리보기</title><style>html,body{margin:0}</style></head><body>' + bar + '</body></html>'
open(sys.argv[1], "w", encoding="utf-8").write(frag(out)); print(len(out))
