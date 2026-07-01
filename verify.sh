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

# clean baseline each run — verify mutates the DB (creates rows, pays payroll),
# so reseed to avoid stale-state failures (e.g. a payroll row already paid).
(cd backend && npm run seed >/dev/null 2>&1)

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

# 13. clients: create + list shows it
CNAME="Verify Client $RANDOM"
CL=$(curl -s "${auth[@]}" -X POST "$BASE/clients" -H 'Content-Type: application/json' -d "{\"name\":\"$CNAME\",\"gst\":\"29TEST$RANDOM\",\"contactName\":\"VC\"}")
CID=$(echo "$CL" | J "['id']")
[ -n "$CID" ] && ok "client created id=$CID" || bad "client create"
CFOUND=$(curl -s "${auth[@]}" "$BASE/clients?q=Verify%20Client" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if any(c['id']==$CID for c in d) else 0)")
[ "$CFOUND" = "1" ] && ok "client appears in list" || bad "client not in list"

# 14. quotation: create (draft) + accept -> creates an invoice
Q=$(curl -s "${auth[@]}" -X POST "$BASE/quotations" -H 'Content-Type: application/json' -d "{\"clientId\":$CID,\"lineItems\":[{\"desc\":\"Test staffing\",\"qty\":2,\"rate\":10000}],\"gstPercent\":18}")
QID=$(echo "$Q" | J "['id']"); QNUM=$(echo "$Q" | J "['number']"); QTOT=$(echo "$Q" | J "['total']")
case "$QNUM" in QUO-*) ok "quotation created $QNUM total=$QTOT" ;; *) bad "quotation number=$QNUM" ;; esac
INVBEFORE=$(curl -s "${auth[@]}" "$BASE/invoices" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
ACC=$(curl -s "${auth[@]}" -X POST "$BASE/quotations/$QID/accept")
AST=$(echo "$ACC" | J "['status']"); ACI=$(echo "$ACC" | J "['convertedInvoiceId']")
INVAFTER=$(curl -s "${auth[@]}" "$BASE/invoices" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
[ "$AST" = "ACCEPTED" ] && [ -n "$ACI" ] && ok "quotation accepted -> invoiceId=$ACI" || bad "quotation accept status=$AST inv=$ACI"
QDELTA=$(python3 -c "print(1 if ($INVAFTER)-($INVBEFORE)==1 else 0)")
[ "$QDELTA" = "1" ] && ok "accept added 1 invoice ($INVBEFORE -> $INVAFTER)" || bad "invoice count unchanged ($INVBEFORE -> $INVAFTER)"
# re-accept is idempotent (no second invoice)
curl -s "${auth[@]}" -X POST "$BASE/quotations/$QID/accept" >/dev/null
INV2=$(curl -s "${auth[@]}" "$BASE/invoices" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
[ "$INV2" = "$INVAFTER" ] && ok "re-accept is idempotent (invoice count stays $INV2)" || bad "re-accept leaked a 2nd invoice ($INV2)"

# 15. work order: create + status transition
WO=$(curl -s "${auth[@]}" -X POST "$BASE/work-orders" -H 'Content-Type: application/json' -d "{\"title\":\"Verify WO\",\"projectId\":$PRJ,\"clientId\":$CID,\"value\":500000}")
WONUM=$(echo "$WO" | J "['number']"); WID=$(echo "$WO" | J "['id']")
case "$WONUM" in WO-*) ok "work order created $WONUM" ;; *) bad "work order number=$WONUM" ;; esac
WST=$(curl -s "${auth[@]}" -X POST "$BASE/work-orders/$WID/status" -H 'Content-Type: application/json' -d '{"status":"IN_PROGRESS"}' | J "['status']")
[ "$WST" = "IN_PROGRESS" ] && ok "work order moved to IN_PROGRESS" || bad "work order status=$WST"

# 16. documents: upload a file + fetch it back
echo "verify-doc-content" > /tmp/verify_doc.txt
DCODE=$(curl -s -o /dev/null -w "%{http_code}" "${auth[@]}" -X POST "$BASE/documents?entity=Employee&entityId=1" -F "file=@/tmp/verify_doc.txt")
DURL=$(curl -s "${auth[@]}" "$BASE/documents?entity=Employee&entityId=1" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[-1]['url'] if d else '')")
DROOT="${BASE%/api}"
DCONTENT=$(curl -s "$DROOT$DURL")
[ "$DCODE" = "201" ] && [ "$DCONTENT" = "verify-doc-content" ] && ok "document uploaded ($DCODE) and served" || bad "document upload/serve (code=$DCODE, content='$DCONTENT')"

# 17. reports + analytics read endpoints return data
PMN=$(curl -s "${auth[@]}" "$BASE/reports/project-margin" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if isinstance(d,list) and len(d)>=1 else 0)")
[ "$PMN" = "1" ] && ok "reports/project-margin returns per-project list" || bad "reports/project-margin empty"
HC=$(curl -s "${auth[@]}" "$BASE/analytics/headcount" | J "['total']")
[ -n "$HC" ] && [ "$HC" -ge 1 ] 2>/dev/null && ok "analytics/headcount total=$HC" || bad "analytics/headcount total=$HC"

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]