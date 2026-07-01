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
  -d "{\"employeeId\":$EID,\"projectId\":1,\"role\":\"Helper\",\"dailyWage\":500,\"effectiveDate\":\"$(date +%Y-%m-%d)\"}" >/dev/null
MMM=$(python3 -c "import datetime;d=datetime.date.today();print(f'{d.year}{d.month:02d}')")
P=$(curl -s "${auth[@]}" -X POST "$BASE/payroll/generate" -H 'Content-Type: application/json' -d "{\"month\":\"$MMM\",\"projectId\":1}")
PC=$(echo "$P" | J "['count']")
NET=$(echo "$P" | J "['rows'][0]['net']")
[ "$PC" -ge 1 ] 2>/dev/null && ok "payroll generated, count=$PC, first net=$NET" || bad "payroll count=$PC"

# 6. RBAC: ACCOUNTS cannot create employee (expect 403)
ACC=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"accounts@sasyantra.in","password":"admin123"}' | J "['accessToken']")
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ACC" -X POST "$BASE/employees" -H 'Content-Type: application/json' -d '{"name":"Blocked"}')
[ "$CODE" = "403" ] && ok "RBAC: ACCOUNTS denied employee create (403)" || bad "RBAC: got $CODE (expected 403)"

# 7. unauthenticated dashboard → 401
U=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard")
[ "$U" = "401" ] && ok "unauthenticated dashboard rejected (401)" || bad "unauth dashboard got $U"

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]