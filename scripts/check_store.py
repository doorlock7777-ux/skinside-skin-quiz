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
# 진단 결과의 추천 제품 이름/링크가 스토어와 같은지
import re
q = open(os.path.join(R, "public/quiz/index.html"), encoding="utf-8").read()
byid = {p["id"]: p for p in d["products"]}
LK = dict(re.findall(r'^\s*(\w+):\s*"(https?://[^"]+)"', q[q.index("var LINKS"):q.index("var PR")], re.M))
for k, i in {"cl": "bonkorea-cl", "vit": "bonkorea-vit", "minic": "minic-set", "sun": "mediheal-sun", "patch": "grafen-patch", "calm": "livna-calm", "cream": "livna-cream"}.items():
    p = byid[i]; m = re.search(r'\b%s:\s*\{n:"([^"]+)"' % k, q)
    if not m or m.group(1) != p["brandName"] + " " + p["name"]: err.append("진단 추천 제품 이름이 스토어와 달라요: %s (%s)" % (k, m and m.group(1)))
    if LK[k].split("?")[0] != p["directUrl"].split("?")[0] and "goodsNo" not in LK[k]: err.append("진단 추천 링크가 스토어와 달라요: " + k)
    if "goodsNo" in LK[k] and re.search(r"goodsNo=(\w+)", LK[k]).group(1) != re.search(r"goodsNo=(\w+)", p["directUrl"]).group(1): err.append("진단 추천 링크가 스토어와 달라요: " + k)
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
    # 검색: 결과가 나오고 검색창이 그대로 남아야 한다
    pg.fill("#q", "팩"); pg.press("#q", "Enter"); pg.wait_for_timeout(400)
    if pg.locator("#q").count() != 1 or pg.input_value("#q") != "팩" or pg.locator("#app .pc").count() < 5: err.append("검색 결과/검색창 유지가 동작하지 않아요")
    pg.click(".chip:has-text('메이크업')"); pg.wait_for_timeout(300)
    if pg.locator("#app .pc").count() != len(EXPECT["mk"]): err.append("카테고리 칩 이동이 동작하지 않아요")
    # 금지 문구: 사용자가 없애라고 한 것들
    import re as _re
    pg.click(".chip:has-text('전체')"); pg.wait_for_timeout(300)
    vis = pg.inner_text("body")
    for bad in ["BRDY", "보떼", "아이팔레트", "자주 추천", "아끼는", "문장군이 자주"]:
        if bad in vis: err.append("없애기로 한 문구가 보여요: " + bad)
    if _re.search(r"\d\s?(ml|mL|g|ML)\b", vis): err.append("용량 표기가 보여요")
    if "구매 중" in vis: err.append("구매 수가 100 이하인데 '구매 중' 문구가 보여요")
    incs = pg.evaluate("""async()=>{var o=[];for(var i=0;i<400;i++){var r=await fetch('/api/track',{method:'POST',body:JSON.stringify({id:'bonkorea-cl',e:'c'})});o.push((await r.json()).inc)}return o}""")
    tot = 0; bad = None
    for n, x in enumerate(incs):
        ok = (x == 10) if tot <= 100 else (4 <= x <= 9) if tot <= 300 else (1 <= x <= 3) if tot <= 1000 else x == 1
        if not ok: bad = (n, tot, x); break
        tot += x
    if bad: err.append("클릭당 증가량 규칙이 달라요 (클릭 %d, 현재 %d, 증가 %d)" % bad)
    if "지금 가장 많이 구매하는 제품" not in vis: err.append("'지금 가장 많이 구매하는 제품' 구역이 없어요")
    # 결과 카드: 레이더 글자가 잘리지 않는지, 글자 비율, 가로 넘침
    for w in (360, 400, 560):
        pg.set_viewport_size({"width": w, "height": 900}); pg.wait_for_timeout(300)
        r = pg.evaluate("""()=>{var s=document.querySelector('.hero.my svg'); if(!s) return null; var v=s.viewBox.baseVal, bad=[];
          s.querySelectorAll('text').forEach(t=>{var b=t.getBBox(); if(b.x<v.x||b.x+b.width>v.x+v.width||b.y<v.y||b.y+b.height>v.y+v.height) bad.push(t.textContent)});
          var cd=parseFloat(getComputedStyle(document.querySelector('.hero.my .cd')).fontSize), k=parseFloat(getComputedStyle(document.querySelector('.hero.my .k')).fontSize), ks=document.querySelectorAll('.hero.my .k'), kw=[...ks].map(e=>parseInt(getComputedStyle(e).fontWeight)), ksz=[...ks].map(e=>parseFloat(getComputedStyle(e).fontSize)); var tt=ksz[1]; k=ksz[0];
          return {bad:bad,cd:cd,k:k,t:tt,kw:kw,labels:[...s.querySelectorAll('text')].map(t=>t.textContent),sw:document.documentElement.scrollWidth,h:document.querySelector('.hero.my').getBoundingClientRect().height}}""")
        if r is None: err.append("결과 카드가 안 보여요"); break
        if r["bad"]: err.append("레이더 글자가 잘려요(%dpx): %s" % (w, r["bad"]))
        if r["labels"] != ["피지", "민감", "색소", "주름"]: err.append("레이더 라벨이 달라요: %s" % r["labels"])
        if r["k"] != r["t"] or max(r["kw"]) > 500: err.append("나의 피부타입/진단 문구는 같은 크기, 볼드 없음이어야 해요: %s" % r)
        if not (r["cd"] >= r["k"] * 3): err.append("카드 글자 크기 비율이 이상해요: %s" % r)
        if r["sw"] > w: err.append("가로로 넘쳐요(%dpx)" % w)
        if r["h"] < 176: err.append("카드 높이가 배너보다 작아요(%dpx)" % w)
    b.close()
print("\n".join(err) if err else "OK: 분류, 칩 순서, 제품 배치 모두 일치")
sys.exit(1 if err else 0)
