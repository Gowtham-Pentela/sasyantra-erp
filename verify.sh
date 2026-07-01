#!/usr/bin/env bash
# Sasyantra ERP — end-to-end smoke. ponytail: bash+curl+python3 (jq optional).
# Upgrade to Playwright e2e when the UI stabilises.
set -u
BASE="${BASE:-http://localhost:3000/api}"
PASS=0; FAIL=0
ok() { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
J() { python3 -c "import sys,json;d=json.load(sys.stdin)$1;print(d)" 2>/dev/null; }

echo "Sasyantra ERP — E2E smoke against $BASE"
echo

# 1. login
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@sasyantra.in","password":"admin123"}' | J "['accessToken']")
[ -n "$TOKEN" ] && ok "admin login returns JWT" || bad "admin login failed"

auth=(-H "Authorization: Bearer $TOKEN")

# first real project id (sequences aren't reset by reseed, so never assume id=1)
PRJ=$(curl -s "${auth[@]}" "$BASE/projects" | J "[0]['id']")

# 2. dashboard has real KPIs
K=$(curl -s "${auth[@]}" "$BASE/dashboard")
AP=$(echo "$K" | J "['kpis']['activeProjects']")
TE=$(echo "$K" | J "['kpis']['totalEmployees']")
[ "$AP" -ge 1 ] 2>/dev/null && ok "dashboard activeProjects=$AP" || bad "dashboard activeProjects"
[ "$TE" -ge 1 ] 2>/dev/null && ok "dashboard totalEmployees=$TE" || bad "dashboard totalEmployees"

# 3. create employee → empCode
E=$(curl -s "${auth[@]}" -X POST "$BASE/employees" -H 'Content-Type: application/json' -d '{"name":"Smoke User","designation":"Helper","dailyWage":500,"monthlySalary":13000}')
EC=$(echo "$E" | J "['empCode']")
case "$EC" in EMP-*) ok "employee created as $EC" ;; *) bad "employee empCode=$EC" ;; esac
EID=$(echo "$E" | J "['id']")

# 4. audit trail captured the create
sleep 0.3
A=$(curl -s "${auth[@]}" "$BASE/activity?module=Employee&limit=5")
ACT=$(echo "$A" | J "['data'][0]['action']")
[ "$ACT" = "CREATE" ] && ok "audit log recorded Employee CREATE" || bad "audit log top action=$ACT"

# 5. allocate employee to project 1, then generate payroll
curl -s "${auth[@]}" -X POST "$BASE/allocations" -H 'Content-Type: application/json' \
  -d "{\"employeeId\":$EID,\"projectId\":$PRJ,\"role\":\"Helper\",\"dailyWage\":500,\"effectiveDate\":\"$(date +%Y-%m-%d)\"}" >/dev/null
MMM=$(python3 -c "import datetime;d=datetime.date.today();print(f'{d.year}{d.month:02d}')")
P=$(curl -s "${auth[@]}" -X POST "$BASE/payroll/generate" -H 'Content-Type: application/json' -d "{\"month\":\"$MMM\",\"projectId\":$PRJ}")
PC=$(echo "$P" | J "['count']")
NET=$(echo "$P" | J "['rows'][0]['net']")
[ "$PC" -ge 1 ] 2>/dev/null && ok "payroll generated, count=$PC, first net=$NET" || bad "payroll count=$PC"
PID=$(echo "$P" | J "['rows'][0]['id']")

# 6. RBAC: ACCOUNTS cannot create employee (expect 403)
ACC=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"accounts@sasyantra.in","password":"admin123"}' | J "['accessToken']")
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ACC" -X POST "$BASE/employees" -H 'Content-Type: application/json' -d '{"name":"Blocked"}')
[ "$CODE" = "403" ] && ok "RBAC: ACCOUNTS denied employee create (403)" || bad "RBAC: got $CODE (expected 403)"

# 7. unauthenticated dashboard → 401
U=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard")
[ "$U" = "401" ] && ok "unauthenticated dashboard rejected (401)" || bad "unauth dashboard got $U"

# 8. budget: available is a number; a top-up increases it
B0=$(curl -s "${auth[@]}" "$BASE/budget" | J "['available']")
[ -n "$B0" ] && ok "GET /budget available=$B0" || bad "GET /budget empty"
curl -s "${auth[@]}" -X POST "$BASE/budget" -H 'Content-Type: application/json' -d '{"type":"TOPUP","amount":10000,"date":"2026-07-01","note":"verify topup"}' >/dev/null
B1=$(curl -s "${auth[@]}" "$BASE/budget" | J "['available']")
DIFF=$(python3 -c "print(1 if abs(($B1)-($B0)-10000)<0.01 else 0)")
[ "$DIFF" = "1" ] && ok "budget topup increased available by 10000 ($B0 → $B1)" || bad "budget topup delta ($B0 → $B1)"

# 9. invoice: auto-numbered; payment lifts totalPaid + budget
INV=$(curl -s "${auth[@]}" -X POST "$BASE/invoices" -H 'Content-Type: application/json' -d "{\"projectId\":$PRJ,\"subtotal\":50000,\"gstPercent\":18,\"issueDate\":\"2026-07-01\",\"dueDate\":\"2026-08-01\"}")
INO=$(echo "$INV" | J "['number']")
case "$INO" in INV-*) ok "invoice created as $INO" ;; *) bad "invoice number=$INO" ;; esac
IID=$(echo "$INV" | J "['id']")
BB=$(curl -s "${auth[@]}" "$BASE/budget" | J "['available']")
curl -s "${auth[@]}" -X POST "$BASE/invoices/$IID/payments" -H 'Content-Type: application/json' -d '{"amount":20000,"receivedDate":"2026-07-01","utr":"VRFYINV","mode":"BANK"}' >/dev/null
TP=$(curl -s "${auth[@]}" "$BASE/invoices" | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(i['totalPaid'] for i in d if i['id']==$IID))")
[ "$TP" = "20000" ] && ok "invoice totalPaid=20000 after payment" || bad "invoice totalPaid=$TP"
BA=$(curl -s "${auth[@]}" "$BASE/budget" | J "['available']")
INVUP=$(python3 -c "print(1 if abs(($BA)-($BB)-20000)<0.01 else 0)")
[ "$INVUP" = "1" ] && ok "invoice payment increased budget by 20000" || bad "invoice payment budget delta ($BB → $BA)"

# 10. expense: paying it reduces budget
EXP=$(curl -s "${auth[@]}" -X POST "$BASE/expenses" -H 'Content-Type: application/json' -d "{\"date\":\"2026-07-01\",\"category\":\"Verify Supplies\",\"amount\":15000,\"gst\":0,\"projectId\":$PRJ}")
EID=$(echo "$EXP" | J "['id']")
EB=$(curl -s "${auth[@]}" "$BASE/budget" | J "['available']")
curl -s "${auth[@]}" -X POST "$BASE/expenses/$EID/pay" >/dev/null
EST=$(curl -s "${auth[@]}" "$BASE/expenses" | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(e['status'] for e in d if e['id']==$EID))")
[ "$EST" = "PAID" ] && ok "expense marked PAID" || bad "expense status=$EST"
EA=$(curl -s "${auth[@]}" "$BASE/budget" | J "['available']")
EXDOWN=$(python3 -c "print(1 if abs(($EB)-($EA)-15000)<0.01 else 0)")
[ "$EXDOWN" = "1" ] && ok "expense pay reduced budget by 15000" || bad "expense budget delta ($EB → $EA)"

# 11. mark payroll paid: paid=true, budget drops by net, total paid to employees rises
PB=$(curl -s "${auth[@]}" "$BASE/budget" | J "['available']")
TB=$(curl -s "${auth[@]}" "$BASE/dashboard" | J "['kpis']['totalPaidToEmployees']")
PAY=$(curl -s "${auth[@]}" -X POST "$BASE/payroll/$PID/pay" -H 'Content-Type: application/json' -d '{"mode":"BANK","utr":"VRFPAY"}')
PST=$(echo "$PAY" | J "['paid']")
[ "$PST" = "True" ] && ok "payroll marked paid (paid=true)" || bad "payroll paid=$PST"
PA=$(curl -s "${auth[@]}" "$BASE/budget" | J "['available']")
PDOWN=$(python3 -c "print(1 if abs(($PB)-($PA)-($NET))<0.01 else 0)")
[ "$PDOWN" = "1" ] && ok "salary pay reduced budget by net=$NET" || bad "salary budget delta ($PB → $PA, net=$NET)"
TA=$(curl -s "${auth[@]}" "$BASE/dashboard" | J "['kpis']['totalPaidToEmployees']")
TPUP=$(python3 -c "print(1 if abs(($TA)-($TB)-($NET))<0.01 else 0)")
[ "$TPUP" = "1" ] && ok "totalPaidToEmployees rose by $NET ($TB → $TA)" || bad "totalPaidToEmployees ($TB → $TA)"

# 12. users: create a new admin, login works, can read dashboard
UEMAIL="verify_$(python3 -c "print(__import__('random').randrange(100000,999999))")@sasyantra.in"
curl -s "${auth[@]}" -X POST "$BASE/users" -H 'Content-Type: application/json' -d "{\"email\":\"$UEMAIL\",\"name\":\"Verify Admin\",\"password\":\"pass123\",\"role\":\"ADMIN\"}" >/dev/null
UTOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$UEMAIL\",\"password\":\"pass123\"}" | J "['accessToken']")
UCODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $UTOKEN" "$BASE/dashboard")
[ -n "$UTOKEN" ] && [ "$UCODE" = "200" ] && ok "new admin $UEMAIL logged in & read dashboard (200)" || bad "new-admin login (token len ${#UTOKEN}, code $UCODE)"

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]