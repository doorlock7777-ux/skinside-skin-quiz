"""관리자 페이지, 진단 분석 화면, 카카오 화면 검사.  사용: python3 scripts/check_admin.py"""
import json, os, random, re, subprocess, sys, tempfile
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
T = tempfile.gettempdir(); err = []
def build(s, o): subprocess.run([sys.executable, os.path.join(R, "scripts", s), o], check=True, stdout=subprocess.DEVNULL)
a, q = os.path.join(T, "chk_admin.html"), os.path.join(T, "chk_quiz.html"); build("build_admin_demo.py", a); build("build_quiz_demo.py", q)
AD, PD = "public/admin-answkdrnschkfdudth/index.html", "public/partner-k3x9m2/index.html"
adm = open(os.path.join(R, AD), encoding="utf-8").read(); par = open(os.path.join(R, PD), encoding="utf-8").read(); qz = open(os.path.join(R, "public/quiz/index.html"), encoding="utf-8").read()
au = open(os.path.join(R, "netlify/functions/_auth.mjs"), encoding="utf-8").read()
ca = re.search(r'COUNTER_API = "([^"]+)"', adm).group(1); cq = re.search(r'COUNTER_API = "([^"]+)"', qz).group(1)
if ca != cq: err.append("관리자와 진단 페이지의 통계 주소가 달라요")
dirs = dict(re.findall(r'export const (ADMIN_DIR|PARTNER_DIR) = "([^"]+)"', au))
if dirs.get("ADMIN_DIR") != "admin-answkdrnschkfdudth" or "answkdrnschkfdudth" not in dirs.get("ADMIN_DIR", ""): err.append("관리자 주소에 지정한 문자열이 없어요")
if "partner" not in dirs.get("PARTNER_DIR", ""): err.append("파트너 주소에 partner가 없어요")
for k, v in dirs.items():
    if not os.path.isdir(os.path.join(R, "public", v)): err.append("%s 폴더가 없어요: %s" % (k, v))
for old in ("public/admin", "public/brand"):
    if os.path.exists(os.path.join(R, old)): err.append("예전 주소 폴더가 남아 있어요: " + old)
for f, t in ((adm, "관리자"), (par, "파트너")):
    if 'name="robots" content="noindex,nofollow' not in f: err.append(t + " 페이지에 noindex가 없어요")
    if "Bearer" in f or "sessionStorage" in f: err.append(t + " 페이지가 예전 토큰 방식을 써요")
toml = open(os.path.join(R, "netlify.toml"), encoding="utf-8").read()
for v in dirs.values():
    if '"/%s/*"' % v not in toml: err.append("netlify.toml에 검색 차단 헤더가 없어요: " + v)
if os.path.exists(os.path.join(R, "public/robots.txt")) and any(v in open(os.path.join(R, "public/robots.txt"), encoding="utf-8").read() for v in dirs.values()): err.append("robots.txt에 비공개 주소가 적혀 있어요(주소가 노출돼요)")
for root, _, fs in os.walk(os.path.join(R, "public")):
    for f in fs:
        if f.endswith((".html", ".js", ".json", ".txt", ".xml")) and not any(d in root for d in dirs.values()):
            t = open(os.path.join(root, f), encoding="utf-8", errors="ignore").read()
            if any(v in t for v in dirs.values()): err.append("공개 파일에 비공개 주소가 적혀 있어요: " + os.path.join(root, f))
from playwright.sync_api import sync_playwright
from PIL import Image
Image.new("RGB", (300, 400), (200, 120, 90)).save(os.path.join(T, "chk_prod.png"))
READ_ONLY = "document.querySelectorAll('#mn input, #mn select, #mn textarea, #mn button, #m input, #m select, #m textarea, #m button').length"
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (390, 1000):
        pg = b.new_page(viewport={"width": w, "height": 900}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("file://" + a); pg.wait_for_timeout(900)
        fa = pg.locator("#fa").element_handle().content_frame(); F = pg.frame_locator("#fa")
        # --- 로그인 ---
        if F.locator("#li").count() != 1 or F.locator("#lp").count() != 1 or F.locator("#l2").count() != 1: err.append("관리자 로그인에 아이디/비밀번호/2차 비밀번호 칸이 없어요")
        F.locator("#lgo").click(); pg.wait_for_timeout(300)
        if "맞지 않아요" not in F.locator("#lm").inner_text(): err.append("빈 값으로 관리자 로그인이 통과하거나 안내가 없어요")
        F.locator("#li").fill("a"); F.locator("#lp").fill("b"); F.locator("#l2").fill("c"); F.locator("#l2").press("Enter"); pg.wait_for_timeout(700)
        # --- 홈: 읽기 전용 대시보드 ---
        if F.locator(".todo").count() != 1 or F.locator(".kpi div").count() < 4 or F.locator(".flow i").count() < 3 or F.locator(".bt").count() < 3: err.append("관리자 홈 요약이 부족해요 (%dpx)" % w)
        if fa.evaluate(READ_ONLY) != 0: err.append("관리자 홈에 입력/버튼이 있어요(읽기 전용이어야 해요)")
        if fa.evaluate("document.querySelectorAll('[data-go]').length") < 4: err.append("관리자 홈에서 각 탭으로 가는 링크가 없어요")
        if fa.evaluate("document.documentElement.scrollWidth") > w: err.append("관리자 홈이 가로로 넘쳐요 (%dpx)" % w)
        for tab, sel in (("orders", ".o2"), ("cs", ".o2"), ("brands", "table.tbl"), ("settle", "table.tbl")):
            F.locator("nav button[data-t=%s]" % tab).click(); pg.wait_for_timeout(500)
            if F.locator(sel).count() < 1: err.append("관리자 %s 탭이 비어 있어요 (%dpx)" % (tab, w))
            if fa.evaluate("document.documentElement.scrollWidth") > w: err.append("관리자 %s 탭이 가로로 넘쳐요 (%dpx)" % (tab, w))
        # 브랜드: 코드 발급 -> 코드가 한 번 보인다
        F.locator("nav button[data-t=brands]").click(); pg.wait_for_timeout(400)
        F.locator("[data-i=grafen]").click(); pg.wait_for_timeout(400)
        if "K7QM-X2PD-R9WT-H4NB" not in F.locator("#nc").inner_text(): err.append("파트너 접속 코드 발급이 보이지 않아요")
        # CS: 내가 처리할 것(확인 요청) 1건, 답변 후 종료
        F.locator("nav button[data-t=cs]").click(); pg.wait_for_timeout(400)
        if F.locator(".o2").count() != 1: err.append("관리자 CS에 '내가 처리할 것'이 1건이 아니에요")
        F.locator("[data-tx]").first.fill("확인했어요"); F.locator("[data-a=reply]").first.click(); pg.wait_for_timeout(400)
        if "확인했어요" not in F.locator("#mn").inner_text(): err.append("관리자 CS 답변이 보이지 않아요")
        F.locator("[data-a=close]").first.click(); pg.wait_for_timeout(400)
        if F.locator(".o2").count() != 0: err.append("종료한 CS가 '내가 처리할 것'에 남아요")
        # 정산: 확정 -> 송금 표시
        F.locator("nav button[data-t=settle]").click(); pg.wait_for_timeout(400)
        if F.locator("#sc").count() != 1: err.append("정산 확정 버튼이 없어요")
        F.locator("#sc").click(); F.locator("#sc").click(); pg.wait_for_timeout(500)
        if F.locator("[data-pd]").count() != 3: err.append("정산 확정 후 송금 버튼이 3개가 아니에요")
        F.locator("[data-pd]").first.click(); pg.wait_for_timeout(400)
        if F.locator("[data-pd]").count() != 2: err.append("송금 표시가 반영되지 않아요")
        # 홈의 항목을 눌러 해당 탭으로
        F.locator("nav button[data-t=home]").click(); pg.wait_for_timeout(500); F.locator(".todo a").first.click(); pg.wait_for_timeout(500)
        if not F.locator("nav button.on").first.get_attribute("data-t") in ("orders", "brands", "cs", "settle"): err.append("홈 항목을 눌러도 해당 탭으로 가지 않아요")
        # 통계
        F.locator("nav button[data-t=stats]").click(); pg.wait_for_timeout(900)
        if F.locator(".bars li").count() != 10: err.append("TOP 10이 10개가 아니에요 (%dpx)" % w)
        if F.locator(".tp").count() < 5 or F.locator(".seg").count() != 4: err.append("피부타입 통계가 안 보여요")
        if "8,144" not in F.locator("#dv").inner_text(): err.append("카카오 채널 현황이 안 보여요")
        if fa.evaluate("[...document.querySelectorAll('.tp span')].some(e=>e.scrollWidth>e.clientWidth+1)"): err.append("피부타입 통계 글자가 잘려요 (%dpx)" % w)
        # 제품 추가
        F.locator("nav button[data-t=add]").click(); pg.wait_for_timeout(300)
        for lab in ["제품 이미지", "제품명", "브랜드명", "정가", "할인가", "카테고리", "바로가기 링크"]:
            if lab not in F.locator("#mn").inner_text(): err.append("제품 추가 입력칸이 없어요: " + lab)
        F.locator("#fi").set_input_files(os.path.join(T, "chk_prod.png")); pg.wait_for_timeout(600)
        F.locator("#fn").fill("검사 제품"); F.locator("#fb").fill("CHK"); F.locator("#fl").fill("30000"); F.locator("#fp").fill("21000"); F.locator("#fc").select_option("sk"); F.locator("#fu").fill("https://example.com/x")
        F.locator("#fs").click(); pg.wait_for_timeout(500)
        if "검사 제품" not in F.locator("#pl").inner_text(): err.append("제품 추가가 동작하지 않아요")
        F.locator("#fp").fill("50000"); F.locator("#fi").set_input_files(os.path.join(T, "chk_prod.png")); pg.wait_for_timeout(500); F.locator("#fn").fill("x"); F.locator("#fb").fill("x"); F.locator("#fu").fill("https://e.com"); F.locator("#fl").fill("30000"); F.locator("#fs").click(); pg.wait_for_timeout(400)
        if "정가" not in F.locator("#fm").inner_text(): err.append("할인가가 정가보다 커도 등록돼요")
        # 로그아웃 -> 로그인 화면
        F.locator("#lo").click(); pg.wait_for_timeout(400)
        if F.locator("#li").count() != 1: err.append("로그아웃해도 관리자 화면이 남아요")
        # --- 파트너 페이지 ---
        pg.click("#sw button[data-v=fp]"); pg.wait_for_timeout(500)
        pf = pg.locator("#fp").element_handle().content_frame(); P = pg.frame_locator("#fp")
        if P.locator("#cd").count() != 1: err.append("파트너 로그인에 코드 입력칸이 없어요")
        P.locator("#cd").fill("1234"); P.locator("#go").click(); pg.wait_for_timeout(400)
        if "맞지 않아요" not in P.locator("#lm").inner_text(): err.append("짧은 코드가 통과하거나 안내가 없어요")
        P.locator("#cd").fill("K7QM-X2PD-R9WT-H4NB"); P.locator("#go").click(); pg.wait_for_timeout(700)
        if P.locator(".big").count() != 1 or P.locator(".kpi div").count() < 4 or P.locator(".wk div").count() != 7: err.append("파트너 홈 요약이 부족해요 (%dpx)" % w)
        if pf.evaluate(READ_ONLY) > 2: err.append("파트너 홈에 입력/버튼이 있어요(읽기 전용이어야 해요)")
        if pf.evaluate("document.documentElement.scrollWidth") > w: err.append("파트너 홈이 가로로 넘쳐요 (%dpx)" % w)
        P.locator("[data-go=orders]").first.click(); pg.wait_for_timeout(500)
        n0 = P.locator(".o").count(); todo0 = P.locator("[data-s]").count()
        P.locator("[data-n]").first.fill("555566667777"); P.locator("[data-s]").first.click(); pg.wait_for_timeout(500)
        if P.locator("#m .tabs button").first.inner_text().split()[-1] != str(int(todo0) - 1): err.append("파트너가 송장을 입력해도 발송 대기가 줄지 않아요")
        # 엑셀 일괄 입력: 붙여넣기 -> 미리보기 -> 입력 (모르는 주문번호 1건은 오류로 표시)
        P.locator("#tb button[data-t=orders]").click(); pg.wait_for_timeout(300)
        left = P.locator("[data-s]").count()
        ids = pf.evaluate("[...document.querySelectorAll('[data-n]')].map(e=>e.dataset.n)")
        if P.locator("#dl").count() != 1 or P.locator("#cp").count() != 1: err.append("발송 대기 엑셀 받기/복사 버튼이 없어요")
        else:
            P.locator("#cp").click(); pg.wait_for_timeout(500)
            if "주문번호" not in P.locator("#bp").input_value() or "\t" not in P.locator("#bp").input_value(): err.append("엑셀 복사가 안 돼요(not found 등)")
            if "not found" in P.locator("#bres").inner_text().lower(): err.append("엑셀 받기에서 not found가 떠요")
            P.locator("#bp").fill("")
        # 눌린(선택된) 버튼의 글자가 배경과 구분되는지: 대비 3 이상
        bad = pf.evaluate("""()=>{const L=c=>{const m=c.match(/[\\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
          return [...document.querySelectorAll('button.on,.tabs button.on,.chips button.on')].filter(b=>{const s=getComputedStyle(b);const a=L(s.color),c=L(s.backgroundColor.startsWith('rgba(0, 0, 0, 0')?getComputedStyle(document.body).backgroundColor:s.backgroundColor);const r=(Math.max(a,c)+.05)/(Math.min(a,c)+.05);return r<3}).map(b=>b.textContent.trim())}""")
        if bad: err.append("선택된 버튼 글씨가 안 보여요: %s" % bad)
        if ids:
            P.locator("#bp").fill("주문번호\t택배사\t송장번호\n%s\tCJ대한통운\t900011112222\nXXXX\t롯데택배\t900011113333" % ids[0]); P.locator("#bgo").click(); pg.wait_for_timeout(300)
            if "2건을 읽었어요" not in P.locator("#bres").inner_text(): err.append("엑셀 붙여넣기 미리보기가 달라요")
            P.locator("#bok").click(); pg.wait_for_timeout(500)
            if "1건 입력했어요" not in P.locator("#bres").inner_text() or "내 브랜드" not in P.locator("#bres").inner_text(): err.append("엑셀 일괄 입력 결과가 달라요")
        # 실제 .xlsx 파일 올리기 (사용자가 만든 파일: C9 칸부터 시작, 택배사 비어 있음)
        P.locator("#tb button[data-t=orders]").click(); pg.wait_for_timeout(300)
        P.locator("#bc").select_option("cj"); P.locator("#bf").set_input_files(os.path.join(R, "scripts/fixtures/ship_sample.xlsx")); pg.wait_for_timeout(900)
        rt = P.locator("#bres").inner_text()
        if "2건을 읽었어요" not in rt or "SK2610180003" not in rt or "CJ대한통운" not in rt or "�" in rt: err.append("엑셀(.xlsx) 파일을 읽지 못해요: " + rt[:80])
        else:
            P.locator("#bok").click(); pg.wait_for_timeout(500)
            rt2 = P.locator("#bres").inner_text()
            if "0건 입력했어요" not in rt2 or "6자 이상" not in rt2: err.append("송장번호 '22'는 거절되고 이유가 보여야 해요: " + rt2[:80])
            # 올바른 송장번호로 고친 파일을 올리면 발송 대기에서 빠지고 결과가 남아 있어야 한다
            before = int(P.locator("#m .tabs button").first.inner_text().split()[-1])
            P.locator("#bp").fill("주문번호\t택배사\t송장번호\nSK2610180099\tCJ대한통운\t900011112222"); P.locator("#bgo").click(); pg.wait_for_timeout(300); P.locator("#bok").click(); pg.wait_for_timeout(700)
            after = int(P.locator("#m .tabs button").first.inner_text().split()[-1])
            if "1건 입력했어요" not in P.locator("#bres").inner_text() or after != before - 1: err.append("일괄 입력 뒤 목록이 갱신되지 않아요 (%d -> %d)" % (before, after))
        for tab, sel in (("stock", ".o"), ("cs", ".o"), ("settle", ".card")):
            P.locator("#tb button[data-t=%s]" % tab).click(); pg.wait_for_timeout(400)
            if P.locator(sel).count() < 1: err.append("파트너 %s 탭이 비어 있어요 (%dpx)" % (tab, w))
            if pf.evaluate("document.documentElement.scrollWidth") > w: err.append("파트너 %s 탭이 가로로 넘쳐요 (%dpx)" % (tab, w))
        P.locator("#tb button[data-t=stock]").click(); pg.wait_for_timeout(300)
        P.locator("[data-q=minic-allinone]").fill("0"); P.locator("[data-sq=minic-allinone]").click(); pg.wait_for_timeout(400)
        if "품절" not in P.locator(".o").first.inner_text(): err.append("재고 0을 저장해도 품절로 안 바뀌어요")
        P.locator("#tb button[data-t=cs]").click(); pg.wait_for_timeout(300)
        P.locator("[data-a=decide][data-x=approve]").first.click(); pg.wait_for_timeout(400)
        if "승인됨" not in P.locator("#m").inner_text(): err.append("반품 승인이 반영되지 않아요")
        P.locator("[data-a=received]").first.click(); pg.wait_for_timeout(400)
        if "환불 완료" not in P.locator("#m").inner_text(): err.append("입고 확인 후 환불 완료가 안 보여요")
        P.locator("#tb button[data-t=home]").click(); pg.wait_for_timeout(500)
        if errs: err.append("페이지 오류: %s" % errs)
        pg.close()
    # 로그인 없이 실제 페이지를 열면 로그인 화면만 보인다 (서버 응답이 없으면 로그인으로)
    pg = b.new_page(); pg.goto("file://" + os.path.join(R, AD)); pg.wait_for_timeout(700)
    if pg.locator("#li").count() != 1 or pg.locator("nav").count(): err.append("로그인 없이 관리자 화면이 열려요")
    pg = b.new_page(); pg.goto("file://" + os.path.join(R, PD)); pg.wait_for_timeout(700)
    if pg.locator("#cd").count() != 1 or pg.locator(".big").count(): err.append("로그인 없이 파트너 화면이 열려요")
    # 진단: 분석 중 4초 -> 카카오 화면
    pg = b.new_page(viewport={"width": 400, "height": 800})
    st = {"screen": "result", "i": 0, "a": [random.randint(0, 3) for _ in range(29)], "c": [random.randint(0, 3) for _ in range(5)], "start": 0, "simple": False, "notify": False, "recorded": False}
    pg.add_init_script("localStorage.removeItem('skinside_unlocked');localStorage.setItem('skinside_quiz_v2',%r)" % json.dumps(st))
    pg.goto("file://" + os.path.join(R, "public/quiz/index.html")); pg.wait_for_timeout(1000)
    if "피부타입 분석 중" not in pg.inner_text("#app"): err.append("분석 중 화면이 안 보여요")
    pg.wait_for_timeout(2400)
    if pg.locator(".an").count() != 1: err.append("분석 화면이 4초 전에 끝나요")
    pg.wait_for_timeout(1800)
    if pg.locator(".an").count() != 0 or pg.locator("#kk").count() != 1: err.append("분석 화면이 4초 뒤 카카오 화면으로 넘어가지 않아요")
    else:
        bg = pg.evaluate("getComputedStyle(document.getElementById('kk')).backgroundColor")
        if bg != "rgb(254, 229, 0)": err.append("카카오 버튼 색이 달라요: " + bg)
        tx = pg.inner_text("#app")
        for need in ["문장군", "친구 8,144", "카카오톡 채널 추가하기"]:
            if need not in tx: err.append("카카오 화면에 없어요: " + need)
    # 결과를 이미 본 사람(S.shown)에게는 분석 화면이 뜨지 않는다
    pg = b.new_page(viewport={"width": 400, "height": 800}); st2 = dict(st, shown=True)
    pg.add_init_script("localStorage.setItem('skinside_unlocked','1');localStorage.setItem('skinside_quiz_v2',%r)" % json.dumps(st2))
    pg.goto("file://" + os.path.join(R, "public/quiz/index.html")); pg.wait_for_timeout(1200)
    if pg.locator(".an").count(): err.append("결과를 이미 본 사람에게 분석 중 화면이 떠요")
    if "알파벳의 의미" in pg.inner_text("#app"): err.append("결과 화면에 '알파벳의 의미' 문구가 남아 있어요")
    b.close()
print("\n".join(err) if err else "OK: 관리자, 분석 화면, 카카오 화면 모두 정상"); sys.exit(1 if err else 0)
