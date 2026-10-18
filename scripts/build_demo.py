"""스토어 미리보기(단일 HTML, Claude 아티팩트용)를 만든다. 실제 사이트(public/)와 같은 app.js, style.css, products.json을 사용하고
가짜 서버(demo.js)만 덧붙인다. 정가, 리뷰는 미리보기용 예시 값이다.  사용: python3 scripts/build_demo.py <출력경로>"""
import base64, json, os, sys
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
def rd(p, b=False): return open(os.path.join(R, p), "rb" if b else "r", **({} if b else {"encoding": "utf-8"})).read()
def uri(p): return "data:image/webp;base64," + base64.b64encode(rd("public/" + p, True)).decode()
d = json.loads(rd("public/data/products.json"))
MUL = [1.25, 1.3, 1.2, 1.4, 1.15, None]
RV = {"cl": ["거품이 부드럽고 세안 후 당김이 적다는 의견이 많아요", "모공 속까지 개운하다는 후기가 이어져요", "향이 은은해서 부담 없다는 평이 있어요"],
      "sk": ["발림성이 가볍고 끈적임이 적다는 후기가 많아요", "붉어짐이 가라앉는 느낌이라는 의견이 있어요", "다음 날 피부결이 편안하다는 평이에요"],
      "sun": ["백탁 없이 얇게 발려요", "밀림이나 눈시림이 적다는 후기가 많아요", "남자 피부에도 번들거림이 덜하다는 평이에요"],
      "pack": ["쿨링감이 확실해서 만족한다는 후기가 많아요", "사용 후 피부가 차분해진다는 의견이 있어요", "가격 대비 양이 넉넉하다는 평이에요"]}
for i, p in enumerate(d["products"]):
    if p.get("img"): p["img"] = uri(p["img"])
    m = MUL[i % len(MUL)] if os.environ.get("DEMO_LIST") else None
    if m and not p.get("options"): p["list"] = int(round(p["price"] * m / 100.0)) * 100
    if p["cat"] in RV and (p.get("hot") or i % 3 == 0): p["reviews"] = RV[p["cat"]]
css = rd("public/style.css")
CHK = os.environ.get("DEMO_MODE") == "checkout"
cfg = {"MODE": "checkout" if CHK else "link", "STORE_OPEN": True, "LOGIN": CHK, "DEMO": True, "TOSS_CLIENT_KEY": "demo" if CHK else "", "STORE_URL": "", "KAKAO_URL": "https://pf.kakao.com/_ZujbG/friend"}
html = """<title>스킨인사이드 스토어 미리보기</title>
<style>%s
.demo{background:#fff8e6;color:#8a5a00;font-size:12.5px;text-align:center;padding:8px 16px;line-height:1.5}
:root{color-scheme:light}</style>
<div class="demo" id="dm">미리보기 화면이에요. 제품을 누르면 족보템 스토어로 이동하고, 누른 만큼 인기순이 바뀌어요. 새로고침하면 처음 배치로 돌아와요.</div>
<header id="top"><button class="back" id="bk" hidden aria-label="뒤로">&#8249;</button><a href="#/"><img src="%s" alt="Skinside.co.kr"></a></header>
<main id="app"></main>
<nav class="tabs"><div class="in" id="nv"></div></nav>
<script>window.SK=%s;window.__PRODUCTS=%s;%s</script>
<script>%s</script>
<script>%s</script>
""" % (css, uri("images/logo.webp"), json.dumps(cfg), json.dumps(d, ensure_ascii=False), "" if os.environ.get("DEMO_SEED") else "window.__NOSEED=1;", rd("scripts/demo.js"), rd("public/app.js"))
open(sys.argv[1], "w", encoding="utf-8").write(html); print(len(html))
