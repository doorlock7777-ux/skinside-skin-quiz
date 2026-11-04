"""후기 탭 시험(미리보기 데모): 후기 탭, 좋아요, 댓글, 구매하기 -> 장바구니 후기 번호, 포인트 3종 내역, 공유 링크.  사용: python3 scripts/check_feed.py"""
import os, subprocess, sys, tempfile
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
o = os.path.join(tempfile.gettempdir(), "chk_feed.html")
subprocess.run([sys.executable, os.path.join(R, "scripts/build_demo.py"), o], check=True, stdout=subprocess.DEVNULL, env=dict(os.environ, DEMO_MODE="checkout"))
from playwright.sync_api import sync_playwright
err = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 900}); pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    ctx.add_init_script("window.__copied='';try{Object.defineProperty(navigator,'clipboard',{value:{writeText:function(t){window.__copied=t;return Promise.resolve()}}})}catch(e){}")
    pg.goto("file://" + o); pg.wait_for_timeout(900)
    tabs = pg.locator(".tabs a").all_inner_texts()
    if [t.strip() for t in tabs] != ["스토어", "피부 진단", "후기", "장바구니", "내 정보"]: err.append("하단 메뉴가 달라요: %s" % tabs)
    # 로그인 전: 후기 탭은 로그인 안내
    pg.click(".tabs a:has-text('후기')"); pg.wait_for_timeout(400)
    if pg.locator(".fdp").count(): err.append("로그인 전인데 후기가 보여요")
    pg.click("text=네이버로 시작하기 (데모)"); pg.wait_for_timeout(900)
    if pg.locator(".fdp").count() != 3: err.append("후기 3개가 안 보여요: %d" % pg.locator(".fdp").count())
    # 후기 화면: 안내 문구와 '내 후기 쓰러 가기' 없음, 탭이 '후기 작성'(수첩+연필, 대표색)으로 바뀜
    if pg.locator(".sec .sub").count() or pg.locator(".fd-write").count(): err.append("후기 화면에 안내 문구/후기 쓰러 가기가 남아 있어요")
    wt = pg.locator(".tabs a.sk-wr")
    if wt.count() != 1 or wt.inner_text().strip() != "후기 작성" or wt.locator("svg").count() != 1: err.append("후기 화면에서 탭이 '후기 작성' 버튼으로 안 바뀌어요: %s" % pg.locator(".tabs a").all_inner_texts())
    else:
        col = wt.evaluate("e=>getComputedStyle(e).color"); pri = pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--pri').trim()")
        if col != "rgb(78, 87, 162)" or pri.lower() != "#4e57a2": err.append("후기 작성 탭이 대표색이 아니에요: %s %s" % (col, pri))
        if len(pg.locator(".tabs a").all()) != 5 or pg.evaluate("[...document.querySelectorAll('.tabs a i')].map(e=>e.getBoundingClientRect().width).join()") != "22,22,22,22,22": err.append("탭 아이콘 크기가 어긋나요")
        wt.click(); pg.wait_for_timeout(400)
        if "주문/배송내역" not in pg.inner_text("#app"): err.append("후기 작성 탭이 내 주문(후기 쓰기)으로 안 가요")
        pg.click(".tabs a:has-text('후기')"); pg.wait_for_timeout(600)
    first = pg.locator(".fdp").first
    if "성실리뷰어" not in first.inner_text(): err.append("성실리뷰어 뱃지가 안 보여요")
    if first.locator(".fd-a button").all_inner_texts()[-1].strip() != "구매하기": err.append("구매하기 버튼이 없어요")
    # 글이 먼저: 본문이 제품 카드보다 위
    ty = first.locator(".fd-t").bounding_box()["y"]; py = first.locator(".fd-p").bounding_box()["y"]
    if not ty < py: err.append("후기 글이 제품 카드보다 위에 있어야 해요")
    # 좋아요
    before = first.locator("[data-flc]").inner_text(); first.locator("[data-fl]").click(); pg.wait_for_timeout(300)
    if first.locator("[data-flc]").inner_text() == before or "on" not in (first.locator("[data-fl]").get_attribute("class") or ""): err.append("좋아요가 반영되지 않아요")
    first.locator("[data-fl]").click(); pg.wait_for_timeout(300)
    if first.locator("[data-flc]").inner_text() != before: err.append("좋아요 취소가 안 돼요")
    # 댓글
    first.locator("[data-fc]").click(); pg.wait_for_timeout(400)
    first.locator("[data-fcf] input").fill("저도 써볼게요"); first.locator("[data-fcf] button").click(); pg.wait_for_timeout(400)
    if "저도 써볼게요" not in first.locator("[data-fcm]").inner_text() or "댓글 2" not in first.locator("[data-fcc]").inner_text(): err.append("댓글이 안 달려요: " + first.locator("[data-fcc]").inner_text())
    first.locator("[data-fcd]").click(); pg.wait_for_timeout(300)
    if "저도 써볼게요" in first.locator("[data-fcm]").inner_text(): err.append("내 댓글 삭제가 안 돼요")
    # 공유
    first.locator("[data-fs]").click(); pg.wait_for_timeout(200)
    if "#/feed/F1" not in pg.evaluate("window.__copied"): err.append("공유 링크가 복사되지 않아요: " + pg.evaluate("window.__copied"))
    # 구매하기 -> 제품 상세 -> 장바구니에 후기 번호가 붙는다
    first.locator("[data-fb]").click(); pg.wait_for_timeout(500)
    if "minic" not in (pg.evaluate("JSON.parse(localStorage.getItem('sk_ref')||'{}')") and str(pg.evaluate("localStorage.getItem('sk_ref')"))): err.append("후기 번호가 저장되지 않아요")
    pg.click("#ad"); pg.wait_for_timeout(300)
    cart = pg.evaluate("JSON.parse(localStorage.getItem('sk_cart')||'[]')")
    if not cart or cart[0].get("ref") != "F1": err.append("장바구니 줄에 후기 번호가 없어요: %s" % cart)
    # 후기 없이 담은 같은 제품은 별도 줄(적립 대상 아님)
    pg.evaluate("localStorage.setItem('sk_ref','{}')"); pg.click("#ad"); pg.wait_for_timeout(200)
    cart = pg.evaluate("JSON.parse(localStorage.getItem('sk_cart')||'[]')")
    if len(cart) != 2: err.append("후기 구매와 일반 구매가 한 줄로 합쳐져요: %s" % cart)
    # 포인트 3종 내역
    pg.click("#bk"); pg.wait_for_timeout(300); pg.click(".tabs a:has-text('내 정보')"); pg.wait_for_timeout(400); pg.click("#myp"); pg.wait_for_timeout(500)
    t = pg.inner_text(".mdl-b")
    for k in ["현재 포인트", "리뷰로 쌓인 포인트", "구매확정 예정 포인트", "2,690 P"]:
        if k not in t: err.append("포인트 내역에 '%s'가 없어요" % k)
    # 모바일 가로 스크롤 / 글자 잘림 없음
    pg.click(".mdl-h button"); pg.click(".tabs a:has-text('후기')"); pg.wait_for_timeout(500)
    if pg.evaluate("document.documentElement.scrollWidth > innerWidth"): err.append("후기 탭에 가로 스크롤이 생겨요")
    pg.screenshot(path="/tmp/feed_390.png", full_page=False)
    pg.click(".tabs a:has-text('스토어')"); pg.wait_for_timeout(300)
    if pg.locator(".tabs a.sk-wr").count() or "후기" not in [t.strip() for t in pg.locator(".tabs a").all_inner_texts()]: err.append("다른 화면에서 탭이 '후기'로 돌아오지 않아요")
    # 후기 사진 자르기: 가로로 긴 사진 -> 정사각형 1000x1000 JPEG만 만들어진다
    pg.evaluate("(()=>{var w=document.createElement('div');w.id='phw';w.innerHTML='<div data-ph></div><input type=file data-phf>';document.body.appendChild(w)})()")
    pg.set_input_files("#phw [data-phf]", "/tmp/wide.png"); pg.wait_for_timeout(700)
    if pg.locator(".cr-c").count() != 1: err.append("사진 자르기 화면이 안 떠요")
    else:
        bx = pg.locator(".cr-c").bounding_box()
        if abs(bx["width"] - bx["height"]) > 1: err.append("자르기 틀이 정사각형이 아니에요")
        pg.screenshot(path="/tmp/crop_390.png")
        pg.locator(".cr-z").evaluate("e=>{e.value=2;e.dispatchEvent(new Event('input',{bubbles:true}))}")
        pg.mouse.move(bx["x"] + 100, bx["y"] + 100); pg.mouse.down(); pg.mouse.move(bx["x"] + 40, bx["y"] + 60, steps=4); pg.mouse.up()
        pg.click(".cr-ok"); pg.wait_for_timeout(700)
        d = pg.evaluate("(()=>{var i=document.querySelector('#phw .ph-th img');return i?i.src:''})()")
        sz = pg.evaluate("src=>new Promise(r=>{var i=new Image();i.onload=()=>r([i.width,i.height]);i.src=src})", d) if d.startswith("data:image/jpeg") else None
        if sz != [1000, 1000]: err.append("자른 사진이 1000x1000 JPEG가 아니에요: %s" % (sz,))
        if pg.locator(".cr").count(): err.append("자르기 화면이 안 닫혀요")
    pg.set_input_files("#phw [data-phf]", "/tmp/wide.png"); pg.wait_for_timeout(600); pg.click(".cr-x"); pg.wait_for_timeout(300)
    if pg.locator(".cr").count() or pg.locator("#phw .ph-th").count() != 1: err.append("자르기 취소가 안 돼요")
    # 진단 화면에도 같은 하단 탭
    q = os.path.join(tempfile.gettempdir(), "chk_feed_quiz.html")
    subprocess.run([sys.executable, os.path.join(R, "scripts/build_quiz_demo.py"), q], check=True, stdout=subprocess.DEVNULL, env=dict(os.environ, DEMO_MODE="checkout"))
    pq = ctx.new_page(); pq.goto("file://" + q); pq.wait_for_timeout(900)
    qt = [t.strip().split("\n")[0] for t in pq.locator("nav.mt a").all_inner_texts()]
    if qt != ["스토어", "피부 진단", "후기", "장바구니", "내 정보"]: err.append("진단 화면 하단 메뉴가 스토어와 달라요: %s" % qt)
    if pq.locator("nav.mt a.on").inner_text().strip() != "피부 진단": err.append("진단 화면에서 '피부 진단' 탭이 선택돼 있지 않아요")
    pq.close()
    if errs: err.append("스크립트 오류: %s" % errs)
    b.close()
print("FAIL\n" + "\n".join(err) if err else "OK: 후기 탭 정상")
raise SystemExit(1 if err else 0)
