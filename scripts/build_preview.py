"""스토어와 진단을 한 화면에서 오가며 시험하는 통합 미리보기(단일 HTML). 아래 탭으로 스토어/피부 진단이 같은 화면 안에서 전환된다.
사용: python3 scripts/build_preview.py <출력경로>"""
import json, os, subprocess, sys, tempfile
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
T = tempfile.gettempdir()
def sub(script, env=None):
    o = os.path.join(T, "pv_" + script.replace(".py", ".html"))
    subprocess.run([sys.executable, os.path.join(R, "scripts", script), o], check=True, stdout=subprocess.DEVNULL, env=dict(os.environ, **(env or {})))
    return open(o, encoding="utf-8").read()
def doc(frag): return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + frag + "</body></html>"
j = lambda s: json.dumps(s, ensure_ascii=False).replace("</", "<\\/")
store, quiz = doc(sub("build_demo.py")), doc(sub("build_quiz_demo.py"))
html = '''<title>스킨인사이드 미리보기</title>
<style>html,body{margin:0;height:100%;background:#f2f4f6}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;background:#fff}</style>
<iframe id="fs" title="스토어"></iframe><iframe id="fq" title="피부 진단" hidden></iframe>
<script>
var fs = document.getElementById("fs"), fq = document.getElementById("fq"), loaded = false;
fs.srcdoc = @@STORE@@;
function go(w){ if(w === "quiz" && !loaded){ fq.srcdoc = @@QUIZ@@; loaded = true; } fq.hidden = w !== "quiz"; fs.hidden = w === "quiz"; }
addEventListener("message", function(e){ if(e.data && e.data.skgo) go(e.data.skgo); });
</script>'''.replace("@@STORE@@", j(store)).replace("@@QUIZ@@", j(quiz))
open(sys.argv[1], "w", encoding="utf-8").write(html); print(len(html))
