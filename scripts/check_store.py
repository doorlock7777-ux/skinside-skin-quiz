"""스토어 배치 검사. 배포나 미리보기 전에 반드시 통과해야 한다.  사용: python3 scripts/check_store.py
1) 제품별 카테고리가 사용자가 정한 분류와 같은지  2) 카테고리 순서  3) 처음 화면의 칩 순서와 제품 배치 순서가 카테고리 순서와 같은지"""
import json, os, subprocess, sys, tempfile
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ORDER = ["cl", "sk", "sun", "blackhead", "shower", "hair", "pack", "mk"]
EXPECT = {
 "cl": ["bonkorea-cl"],
 "sk": ["bonkorea-vit", "minic-allinone", "minic-cream", "minic-set", "livna-calm", "livna-cream", "citirover-retinol"],
 "sun": ["mediheal-sun", "grafen-sunstick"],
 "blackhead": ["grafen-patch", "grafen-scrub"],
 "shower": ["hwapasa-bodywash", "hwapasa-shampoo", "hwapasa-treatment"],
 "hair": ["grafen-wax", "jmw-iron"],
 "pack": ["mediflower-cool", "lindsay-tt", "mediheal-madeca", "mediheal-tt", "torriden-cica", "numbuzin-1", "numbuzin-3", "numbuzin-4", "numbuzin-9"],
 "mk": ["hwapasa-brush", "grafen-tip", "brdy-powder", "brdy-lipbalm", "etude-shading"],
}
err = []
d = json.load(open(os.path.join(R, "public/data/products.json"), encoding="utf-8"))
if list(d["categories"]) != ORDER: err.append("카테고리 순서가 달라요: %s" % list(d["categories"]))
got = {}
for p in d["products"]: got.setdefault(p["cat"], []).append(p["id"])
for k in ORDER:
    if sorted(got.get(k, [])) != sorted(EXPECT[k]): err.append("%s 제품이 달라요: %s" % (k, got.get(k)))
if [p["cat"] for p in d["products"]] != [c for c in ORDER for _ in EXPECT[c]]: err.append("제품 배열이 카테고리 순서로 정렬돼 있지 않아요")
# 화면 확인
from playwright.sync_api import sync_playwright
out = os.path.join(tempfile.gettempdir(), "chk_demo.html")
subprocess.run([sys.executable, os.path.join(R, "scripts/build_demo.py"), out], check=True, stdout=subprocess.DEVNULL)
names = {p["id"]: p["name"] for p in d["products"]}
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(viewport={"width": 400, "height": 900}); pg.goto("file://" + out); pg.wait_for_timeout(1200)
    chips = pg.eval_on_selector_all(".chip", "e=>e.map(x=>x.textContent)")
    cards = pg.eval_on_selector_all("#app .pc .nm", "e=>e.map(x=>x.textContent)")
    want = ["전체"] + [d["categories"][k] for k in ORDER]
    if chips != want: err.append("칩 순서가 달라요: %s" % chips)
    wc = [names[i] for k in ORDER for i in EXPECT[k]]
    if cards != wc: err.append("처음 제품 배치 순서가 달라요")
    b.close()
print("\n".join(err) if err else "OK: 분류, 칩 순서, 제품 배치 모두 일치")
sys.exit(1 if err else 0)
