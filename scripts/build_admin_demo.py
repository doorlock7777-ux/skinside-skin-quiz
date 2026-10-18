"""관리자 페이지 미리보기(단일 HTML). 실제 public/admin/index.html에 가짜 서버(예시 데이터)만 덧붙인다.  사용: python3 scripts/build_admin_demo.py <출력경로>"""
import json, os, sys
import re
def frag(h):
    """아티팩트는 <html>/<head>/<body>를 직접 쓰지 않으므로 안쪽 내용만 꺼낸다."""
    hd = re.search(r"<head[^>]*>(.*?)</head>", h, re.S).group(1)
    bd = re.search(r"<body[^>]*>(.*)</body>", h, re.S).group(1)
    hd = re.sub(r'<meta charset[^>]*>|<meta name="viewport"[^>]*>', "", hd)
    return hd + "\n" + bd
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
rd = lambda p: open(os.path.join(R, p), encoding="utf-8").read()
d = json.loads(rd("public/data/products.json"))
h = rd("public/admin/index.html")
mock = "<script>window.__CATS=%s;\n%s</script>\n" % (json.dumps(d["categories"], ensure_ascii=False), rd("scripts/admin_mock.js"))
h = h.replace('<div id="dm" class="demo" hidden></div>', '<div id="dm" class="demo">미리보기 화면이에요. 숫자는 예시 값이고, 제품 추가는 이 화면 안에서만 저장돼요.</div>')
h = h.replace("<script>\nvar COUNTER_API", mock + "<script>\nvar COUNTER_API", 1)
# 주문 관리 화면: 같은 화면 안에서 열리는 iframe (가짜 주문 데이터)
od = rd("public/admin/orders.html").replace("<script>\nvar T =", "<script>window.__ORDERS_MOCK=1;</script><script>" + rd("scripts/admin_mock.js") + "</script><script>\nvar T =", 1)
assert "__ORDERS_MOCK" in od
h = h.replace('<a href="/admin/orders.html">주문 관리</a><a href="/store">스토어 보기</a>', '<a href="#orders" id="ordl">주문 관리</a><a href="#brand" id="brl">브랜드 화면 보기</a>')
bd = rd("public/brand/index.html").replace("<script>\nvar T =", "<script>" + rd("scripts/brand_mock.js") + "</script><script>\nvar T =", 1)
assert "brand_mock" in bd or "/api/brand/orders" in bd
ov = '<iframe id="ordf" title="주문 관리" style="display:none;position:fixed;inset:0;width:100%;height:100%;border:0;background:#f2f4f6;z-index:50"></iframe>'
bjs = '<iframe id="brdf" title="브랜드 화면" style="display:none;position:fixed;inset:0;width:100%;height:100%;border:0;background:#f2f4f6;z-index:50"></iframe><button id="brx" style="display:none;position:fixed;right:12px;bottom:12px;z-index:60;font:inherit;font-weight:700;background:#191f28;color:#fff;border:0;border-radius:999px;padding:11px 18px;cursor:pointer">관리자 화면으로 돌아가기</button><script>var brdf=document.getElementById("brdf"),brx=document.getElementById("brx");document.getElementById("brl").onclick=function(e){e.preventDefault();if(!brdf.srcdoc)brdf.srcdoc=' + json.dumps(bd, ensure_ascii=False).replace("</", "<\\/") + ';brdf.style.display="block";brx.style.display="block"};brx.onclick=function(){brdf.style.display="none";brx.style.display="none"};</script>'
js = '<script>var ordf=document.getElementById("ordf");document.getElementById("ordl").onclick=function(e){e.preventDefault();if(!ordf.srcdoc)ordf.srcdoc=' + json.dumps(od, ensure_ascii=False).replace("</", "<\\/") + ';ordf.style.display="block"};addEventListener("message",function(e){if(e.data&&e.data.skadm)ordf.style.display="none"});</script>'
h = h.replace("</body>", ov + js + bjs + "</body>", 1)
assert "__CATS" in h
open(sys.argv[1], "w", encoding="utf-8").write(frag(h)); print(len(h))
