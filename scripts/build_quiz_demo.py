"""진단 페이지 미리보기(단일 HTML). 실제 public/quiz/index.html에 '결과 직전 화면 보기' 버튼만 덧붙인다.  사용: python3 scripts/build_quiz_demo.py <출력경로>"""
import os, sys
import re
def frag(h):
    """아티팩트는 <html>/<head>/<body>를 직접 쓰지 않으므로 안쪽 내용만 꺼낸다."""
    hd = re.search(r"<head[^>]*>(.*?)</head>", h, re.S).group(1)
    bd = re.search(r"<body[^>]*>(.*)</body>", h, re.S).group(1)
    hd = re.sub(r'<meta charset[^>]*>|<meta name="viewport"[^>]*>', "", hd)
    return hd + "\n" + bd
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
h = open(os.path.join(R, "public/quiz/index.html"), encoding="utf-8").read()
bar = '''<div id="pvbar" style="background:#fff8e6;color:#8a5a00;font-size:13px;text-align:center;padding:10px 16px;line-height:1.6">미리보기 화면이에요. 질문 30개를 풀지 않고 결과 직전 화면부터 볼 수 있어요.<br><button id="pvgo" style="font:inherit;font-weight:700;color:#8a5a00;background:none;border:0;text-decoration:underline;cursor:pointer;padding:4px">결과 직전 화면 보기 (분석 중 4초 후 카카오 화면)</button></div>
<script>document.addEventListener("DOMContentLoaded",function(){var b=document.getElementById("pvgo");if(!b)return;b.onclick=function(){try{localStorage.removeItem("skinside_unlocked")}catch(e){}
var r=function(n){var a=[];for(var i=0;i<n;i++)a.push(Math.floor(Math.random()*4));return a};
S={screen:"result",i:0,a:r(NQ),c:r(NC),start:0,simple:false,notify:false,recorded:false};save();render()}});</script>'''
assert "<body>" in h
h = h.replace("<body>", "<body>\n" + bar, 1)
open(sys.argv[1], "w", encoding="utf-8").write(frag(h)); print(len(h))
