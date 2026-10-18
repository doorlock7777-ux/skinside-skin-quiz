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
assert "__CATS" in h
open(sys.argv[1], "w", encoding="utf-8").write(frag(h)); print(len(h))
