#!/bin/sh
# 미리보기를 올리거나 배포하기 전에 반드시 전부 통과해야 하는 점검 모음
cd "$(dirname "$0")/.." || exit 1
fail=0
for c in "python3 scripts/check.py" "python3 scripts/check_store.py" "python3 scripts/check_admin.py" "python3 scripts/check_checkout.py" "python3 scripts/check_preview.py" "node scripts/test_functions.mjs" "python3 scripts/check_e2e.py"; do
  out=$($c 2>&1); rc=$?
  echo "== $c  ->  $(echo "$out" | tail -1)"
  [ $rc -ne 0 ] && { echo "$out" | tail -8; fail=1; }
done
[ $fail -eq 0 ] && echo "ALL OK" || echo "FAILED"
exit $fail
