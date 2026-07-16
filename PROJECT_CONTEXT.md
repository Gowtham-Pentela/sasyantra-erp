# Sasyantra ERP — Project Context (session handover)

> Read this first when opening a new session on this project. It is the
> authoritative "what we built, where it lives, how to run it, what's left"
> so a new session continues without re-discovering the codebase.
>
> Last updated: 2026-07-16. All 16 SRS modules + Budget live. This iteration:
> admin project edit (incl. client GST + payment-terms-in-days), expenses
> Excel import / edit / unpay-revert, and attendance fixes (bulk-mark now skips
> Sat+Sun while the grid still shows weekends for manual marking, plus
> bulk-revert and a code legend). Backend auto-redeployed on push (run
> `29525611700`); **frontend not yet redeployed** — live site is version-skewed
> until a manual `firebase deploy` (see §16). Live URLs in §14.

## 1. What this is

**Sasyantra Integrated Systems** — an ERP for a manpower-supply company
(Sasyantra). Manpower supply = the company deploys workers to client sites /
projects and bills for them. The ERP tracks employees, projects, attendance,
payroll, invoicing, budget/cash, and the commercial front-office (clients,
quotations, work orders).

Owner / GitHub: **Gowtham-Pentela** — repo is **private**:
https://github.com/Gowtham-Pentela/sasyantra-erp. `main` holds the original
SRS build (6 commits); this iteration's bug fixes + free-stack deploy live on
branch **`deploy/free-stack`** (14 commits, 8 ahead of `main`, not yet merged).
Working tree is clean; all deploy changes are committed there.

## 2. Stack (exact, do not drift)

- **Backend:** NestJS 10 + Prisma 5 + PostgreSQL 16 (native, trust auth) +
  JWT (8h access token) + bcryptjs + RBAC. Global prefix `api`. ValidationPipe
  `{ transform: true }` (no whitelist).
- **Frontend:** React 18 + TypeScript + Vite + Tailwind (dark/light) +
  ECharts (`echarts-for-react`) + zustand (persisted) + react-router + lucide-react.
- **Money:** `Decimal(18,2)` rupees (not paise). Coerced to JS number on output
  via a one-line override in `backend/src/main.ts`:
  `(Prisma.Decimal.prototype as any).toJSON = function(){return Number(this.toString())}`.
- **File uploads:** multer diskStorage → `backend/uploads/`, served statically
  at `/uploads` (express.static added in `main.ts`).

## 3. How to run (two terminals)

PostgreSQL on `localhost:5432`, DB `sasyantra_erp` (native/trust auth,
`postgresql://gowtham@localhost:5432/sasyantra_erp`).

```bash
# one-time / after schema change
createdb sasyantra_erp
cd backend && npm install
npx prisma migrate dev
npm run seed
npm run start:dev          # API on http://localhost:3000/api

# other terminal
cd frontend && npm install && npm run dev   # app on http://localhost:5173
```

End-to-end smoke (API must be running):
```bash
./verify.sh                 # 34 checks, reseeds a clean baseline each run
```

### Seeded logins (demo only — change before real use)
| Email | Password | Role |
|---|---|---|
| `admin@sasyantra.in` | `admin123` | ADMIN (everything) |
| `ops@sasyantra.in` | `admin123` | OPS (employees/projects/allocations/attendance) |
| `accounts@sasyantra.in` | `admin123` | ACCOUNTS (attendance/payroll; no employee create) |

## 4. Architecture / patterns (reuse these, don't invent new ones)

**One file per backend module** — controller + service + module combined in a
single file at `backend/src/<feature>/<feature>.module.ts`. Follow
`employees.module.ts` as the template. This is deliberate (fewest files).

**Audit trail** — the spine of the system. `backend/src/audit/audit.extension.ts`
does `prisma.$extends({ query: { $allModels: { create/update/delete/upsert }}})`.
User identity comes from a per-request `AsyncLocalStorage` set by Express
middleware that decodes the JWT. Audit rows are written via the **non-extended
base client** (no recursion); `AuditLog` itself is excluded. Old values read
before mutation, new values after. **All new models are auto-audited** — never
write audit code by hand.

- Writes → `this.prisma.audited` (auto-audited)
- Reads → `this.prisma` (plain, no audit overhead)

**Auth/RBAC** — `JwtAuthGuard` + `RolesGuard` registered globally as `APP_GUARD`.
`@Roles('ADMIN','OPS',...)` decorator in `backend/src/auth/decorators.ts`.
Roles: ADMIN / OPS / ACCOUNTS.

**Auto-numbering** — `count() + 1` formatted: `EMP-####`, `PRJ-####`,
`INV-####`, `QUO-####`, `WO-####`. See `employees.module.ts` pattern.

**Soft delete** — employees are archived (`archivedAt`), never hard-deleted.
Audit rows are never cascade-deleted.

**Frontend** — `frontend/src/api/client.ts` is the `http` wrapper (auth token
from zustand). **Login returns `{ accessToken, user }` — NOT `{ token }`.**
`frontend/src/components/ui.tsx` primitives: Card, KpiCard, Modal, Badge,
Spinner, Empty, Field, useToast, `inr`/`inr2` formatters. Single zustand store
(auth + theme, persisted). New page = add route in `App.tsx`, flip `live:true`
in `Layout.tsx` NAV, remove from `STUBS` map (now empty `{}`).

**Ponytail mode is active** (full). Write up to ~90% less code: native APIs,
no speculative abstraction, `// ponytail: <upgrade path>` annotations. Match
the existing terse style. Do not add interfaces/factories/config that have
one consumer.

## 5. What's built (all 16 SRS modules + Budget — live, no stubs)

| Module | Status | Notes |
|---|---|---|
| Dashboard | ✅ | live KPIs (activeProjects, employees, present%, salary liability, advances, renewals, availableBudget, monthlyRevenue/Expenses, outstandingPayments, overdueInvoices, totalPaidToEmployees, salaryPaidThisMonth, monthlyProfit). ECharts. |
| Employees | ✅ | CRUD, auto `EMP-####`, archive/restore, per-employee audit timeline, search + status filter |
| Projects | ✅ | CRUD, auto `PRJ-####`, workspace, financial summary, deployed list, allocation history. **Status filter tabs** (Ongoing/Shelved=ON_HOLD/Completed/Cancelled). **Inline status changer** in workspace (PUT). **Admin edit modal** (pencil on list + "Edit details" in workspace) — name, client GST, dates, contract value, GST %, billing cycle, **payment terms (days)**, manager, status; shared `ProjectFields` for create+edit. **Delete**: cancel-first — only `CANCELLED` projects can be deleted; on delete all 6 dependents are orphaned (`projectId=null`) so expenses/invoices/payroll/quotations/allocations/work-orders survive. **Monthly completion %** chart + PM entry (`ProjectProgress`, upsert on `(projectId, month)`) |
| Allocation | ✅ | assign/transfer (auto-ends prior, keeps history) |
| Attendance | ✅ | **GLOBAL** (all active employees, not project-scoped). Month grid (all days incl. weekends — weekends manually markable, e.g. Saturday OT), click cell. **Bulk P marks Mon–Fri only** (skips Sat+Sun). **Revert bulk** deletes only untouched auto-marked rows (manual edits kept). **Legend** shows full code meanings |
| Payroll | ✅ | generate from attendance, gross→net (PF/ESI/PT/advance/OT), CSV export, **Mark Paid** per row → SalaryPayment (drains budget) |
| Budget | ✅ | company cash fund: `available = opening + topups + invoice payments − expenses paid − salary paid` (recomputed live) |
| Invoices | ✅ | GST invoices, auto `INV-####`, computed gstAmount/total, record payments (UTR/mode), status PAID/PARTIAL/OVERDUE, payment lifts budget |
| Expenses | ✅ | categorized, project-taggable, Mark Paid reduces budget. **Excel import** (`POST /expenses/import`, .xlsx/.xls/.csv via SheetJS). **Edit modal** (pencil). **Unpay** reverts a mistaken PAID → UNPAID |
| Payments | ✅ | read-only ledger (invoice payments in / salary payments out), date-filtered |
| Settings · Users | ✅ | ADMIN creates users (email/name/password/role), reset pw, delete (guards self + last admin) |
| Clients | ✅ | client master (GST/PAN/contacts), search, links to projects/quotations/work orders |
| Quotations | ✅ | `QUO-####`, line-item editor, DRAFT→SENT→ACCEPTED, **Accept auto-creates Invoice** (idempotent via `convertedInvoiceId @unique`) |
| Work Orders | ✅ | `WO-####`, OPEN→IN_PROGRESS→CLOSED/CANCELLED |
| Documents | ✅ | attach files to any record (multipart upload, served from `/uploads`, admin delete) |
| Reports | ✅ | project margin (revenue−salary−expense), salary register, cash-flow; Print/save-as-PDF (browser, no server lib) |
| Analytics | ✅ | 12-mo revenue vs expense vs salary, contract-value pie, project-status bar, headcount, 30-day utilization, budget health |
| Activity Logs | ✅ | immutable audit trail (table + timeline views + CSV export) |
| Auth | ✅ | JWT, RBAC, role-gated UI, protected routes |

## 6. Schema (Prisma) — `backend/prisma/schema.prisma`

6 migrations: `init`, `finance`, `commercial`, `progress`, `nullable_project_links`,
`20260716125700_payment_terms_days`.
19 models + 11 enums (see `model`/`enum` list in schema). Key relations:
- `Project.clientId` + `Client?` (a project belongs to a client)
- `Invoice.fromQuotation` + `Quotation.convertedInvoiceId Int? @unique` (1:1 for accepted quotes)
- `Payroll.paid Boolean @default(false)` + `paidDate` + `salaryPayment SalaryPayment?`
- `Employee.documents`, `User.documents Document[]`
- `Document.@@index([entity, entityId])`
- `ProjectProgress` — PM's monthly 0–100 completion estimate; required `projectId` + `@@unique([projectId, month])` (one row per project per month, upserted not appended).
- `Allocation.projectId Int?` and `WorkOrder.projectId Int?` are now **nullable** (made so in `nullable_project_links`) so they can be orphaned when a cancelled project is deleted.
- `Project.paymentTerms Int?` — credit period in **days** (was free-text `String?`; changed in
  `payment_terms_days` via `ALTER ... USING NULLIF(substring(... from '^[0-9]+'),'')::INT`,
  so `'45 days from invoice'` → `45`, no data loss). Note: `Client.paymentTerms` is still
  `String?` (out of scope — only Project was switched).

Money fields are all `Decimal @db.Decimal(18,2)`.

## 7. Seed — `backend/prisma/seed.ts`

Cleanup block deletes in FK-safe order:
`auditLog, document, workOrder, quotation, client, salaryPayment,
invoicePayment, invoice, expense, budgetEntry, payroll, attendance,
allocation, employee, project, user`. **Postgres sequences are NOT reset by
reseed** → never assume id=1 after a reseed; fetch ids dynamically
(`verify.sh` does `PRJ=$(curl ... /projects | J "[0]['id'])`).

Seed data: 3 users, 2 projects (paymentTerms now integer days: 30 / 45), 6 employees, budget opening ₹5,00,000,
INV-0001 (paid 118000) + INV-0002 (partial 100000/236000, overdue),
2 expenses (Staff Wages PAID 150000, Office Rent UNPAID 40000),
last-month payroll + SalaryPayment (19709), 2 clients (GreenTech/Bharat Steel,
GST matching existing projects), QUO-0001 (ACCEPTED 123900),
QUO-0002 (SENT 198240), WO-0001 (IN_PROGRESS).

## 8. Verification — `verify.sh`

34 checks: auth/dashboard/audit/payroll/RBAC (1-7), finance (8-12: budget
topup both directions, invoice+payment, expense pay, payroll Mark Paid, user
mgmt), commercial (13-17: clients, quote→invoice + idempotent re-accept,
work-order status, document upload+serve, reports/analytics), projects
(18-20b: delete non-cancelled blocked 400, cancel-then-delete 200→404, orphan
expense survives with projectId=null, progress upsert+update).
**Reseeds at start** (`cd backend && npm run seed`) because the suite mutates
the DB. Run result: 34 passed, 0 failed. Keep it idempotent.

## 9. Known gotchas / decisions made (don't re-litigate)

- **Attendance is global.** `byMonth` selects all `archivedAt: null` employees
  (no project filter). `projectId` query param is still accepted but ignored.
  Payroll reads attendance by `employeeId + month`, not project — so the
  global change doesn't break payroll.
- **Project delete is cancel-first + orphaning.** `DELETE /projects/:id` 400s
  unless `status === CANCELLED`; the frontend trash button is disabled until
  then. On a cancelled delete, one `$transaction` nulls `projectId` on all six
  dependents (allocation, payroll, invoice, expense, quotation, workOrder),
  drops the project's `ProjectProgress` rows, then deletes the project — so
  expenses etc. survive in their modules with a cleared project link. This is
  why `Allocation.projectId` / `WorkOrder.projectId` were made nullable.
- **PT (professional tax) guards zero-gross rows:** `professionalTax = gross.gt(0)
  ? d(PT_FLAT) : d(0)`. Without this, daily-wage employees with zero attendance
  got negative net pay. Real bug fixed this iteration.
- **Login response shape** is `{ accessToken, user }`, not `{ token }`.
- **Invoice/expense `mode`** needs `as any` cast (string→PaymentMode enum).
- **Work-order `status`** needs `as any` cast (string→WorkOrderStatus enum).
- **Documents** use `@UseInterceptors(FileInterceptor('file', { storage:
  diskStorage(...) }))` (not the `@FileInterceptor` decorator alias — TS1241).
- **Quotation accept** is wrapped in `$transaction` and idempotent — if
  `convertedInvoiceId` is already set it returns the existing invoice instead
  of creating a second one.
- **Attendance grid vs bulk day-list are split.** `byMonth` returns **all** days
  (`allDays`) so weekends stay as columns and are manually markable (Saturday OT,
  WO, etc.); `bulk` uses `weekdays` (Mon–Fri only) so weekends are never auto-set
  to Present. Do not re-merge these two — the prior single `weekdays()` skipped
  only Sunday and was marking Saturdays Present (the bug this iteration fixed).
- **Attendance bulk-revert deletes untouched rows only.** `POST /attendance/bulk-revert`
  `deleteMany` where `code` matches AND `otHours/advance/bonus/travel/food/fine/otherAllowance`
  all `= 0` AND `remarks IS NULL`. A manually-edited cell (any non-zero extra or a
  remark) survives. `deleteMany` isn't per-row audited (§11), so one summary
  `AuditLog` row (`entityId: 'bulk-revert:<month>:<code>'`, `newValue: {deleted}`) is
  written via the base client to keep the event traceable.
- **Expense unpay** (`POST /expenses/:id/unpay`) sets `UNPAID`, `paidAmount 0`,
  `paidDate null` — the revert for a mistakenly-marked-PAID expense. Frontend
  swaps the row action between Mark paid ↔ Unpay based on `status`. There is no
  expense DELETE endpoint.
- **Expense Excel import** (`POST /expenses/import`, multipart `file`) — SheetJS
  `xlsx` (added dep). `FileInterceptor('file', { limits: 5MB })`; `@UploadedFile`
  buffer parsed with `cellDates:true`. Columns are matched case-insensitively
  (`date, category, vendor, amount, gst, project|projectId, dueDate, remarks`);
  `category`+`amount` required. `date` accepts Excel serials, `YYYY-MM-DD`, and
  `DD-MM-YYYY`. `project` (a name) is resolved to `projectId` via a case-insensitive
  `findMany(name in [...])` lookup; `projectId` (numeric) takes precedence. Rows are
  created `UNPAID`; bad rows are skipped with per-row errors (≤20 returned). Import is
  ADMIN/ACCOUNTS (OPS 403).
- **Frontend file uploads** use `http.upload(path, file)` (FormData) — added to
  `api/client.ts`. It must NOT set `Content-Type` (the browser sets the multipart
  boundary), so `api()` skips the JSON content-type header when `body instanceof FormData`.
- **`Project.paymentTerms` is `Int?` (days), but `Client.paymentTerms` is still
  `String?`.** They are independent columns on different models — don't assume one
  change covers both.

## 10. Security (preserve these)

- `.env` files (containing `DATABASE_URL`) are **gitignored**. Only
  `.env.example` is tracked. Never commit real env / secrets.
- The GitHub repo was deliberately created **PRIVATE** (company + client data
  in the seed). Do not change to public.
- Seed passwords (`admin123`) are demo-only; README notes this. Real deploys
  should change seed passwords or create admins via Settings→Users.

## 11. Explicit upgrade list (NOT done — the roadmap)

- Server-side branded PDF (salary register, bank transfer sheet, GST invoices)
  — currently browser Print / CSV only.
- Document storage → S3 + OCR + e-signatures (currently local fs).
- Refresh-token rotation (currently 8h access token only).
- Per-row audit for `createMany/updateMany/deleteMany` (currently single-op).
- Holiday calendar for `workingDays`; configurable PF/ESI/PT slabs
  (currently flat ₹200 PT, 12% PF, 0.75%/3.25% ESI, ESI ceiling ₹21,000).
- Expense split payments & invoice credit-notes/void; recurring expenses.
- Client portal, employee mobile app (GPS attendance, biometric),
  WhatsApp/email reminders.
- Multi-company / multi-branch, PF/ESI compliance automation, bank API disbursement.
- **Deployment** — **DONE.** Live stack: backend on **Google Cloud Run**
  (auto-redeploys on `git push` via GitHub Actions + Workload Identity
  Federation), DB on **Neon** Postgres, frontend on **Firebase Hosting**.
  Render/Vercel were paywalled (managed Postgres) and Cloudflare Pages was
  the original frontend plan, but Firebase Hosting was used instead
  (GCP-native, same Google account, clean SPA rewrites). `Dockerfile`
  (multi-stage, root), `cloudbuild.yaml`, `.gcloudignore`, `firebase.json`,
  `.firebaserc`, `.github/workflows/deploy-backend.yml` are all in the repo.
  The payslip PDF is **streamed server-side** (pdfkit, stateless — works on
  Cloud Run) instead of browser Print only. Full details + live URLs in §14.

## 12. Repo state (as of this writing)

- Active branch **`deploy/free-stack`** (14 commits), `origin` →
  Gowtham-Pentela/sasyantra-erp (private). It's 8 commits ahead of `main`;
  `main` is unchanged from the original SRS build (6 commits) — the deploy
  work has **not been merged to `main`** yet (a deliberate open question).
- This iteration's commits on `deploy/free-stack`:
  - `91117d3` — payroll OT/joining-date/individual-payslip fixes + stored PDF + free-stack Dockerfile
  - `2107d45` — move Prisma CLI to dependencies (for prod install)
  - `b4112b6` — Cloud Run + Firebase Hosting live; GitHub Actions auto-redeploy (WIF)
  - `523e020` — docs: mark GitHub Actions auto-redeploy verified green
  - `fd05c21` — docs: reconcile PROJECT_CONTEXT with live/deployed state
  - `2791a80` — projects: status filter, cancel-first delete (orphan dependents), monthly progress; 2 new migrations; deployed live
  - `da1c0d3` — project edit + payment-terms-in-days; expenses Excel import/edit/unpay; attendance weekend split + bulk-revert + legend; 1 new migration (`payment_terms_days`); dep `xlsx`; backend auto-redeployed, frontend not yet (§16)
- **Working tree is clean** — everything is committed.
- Inert files still in tree (harmless, superseded): `render.yaml`, `vercel.json`.

## 13. Where to look first

- `backend/src/audit/audit.extension.ts` — the audit spine. Read it.
- `backend/src/employees/employees.module.ts` — the one-file-module template.
- `backend/src/payroll/payroll.module.ts` — the most complex computation
  (gross→net); has the PT guard and `pay()` transaction.
- `backend/src/attendance/attendance.module.ts` — the global attendance change.
- `backend/prisma/schema.prisma` — full data model.
- `frontend/src/components/ui.tsx` — UI primitives every page uses.
- `frontend/src/App.tsx` + `Layout.tsx` — routing + nav.
- `verify.sh` — the contract the whole system must keep green.

## 14. Current iteration (2026-07-02) — bug fixes + free-stack deploy

### Done & verified

1. **OT phantom hours** — root cause: seed injected `otHours` on non-OT days
   and the attendance grid hid OT. Fixed server-side: `attendance` upsert now
   forces `otHours = code === 'OT' ? Number(dto.otHours ?? 0) : 0`; `bulk`
   skips non-OT otHours; seed no longer sets otHours on P days (just `food:50`).
   Frontend grid now shows OT hours and clears the OT field when a non-OT code
   is picked. 27 dirty rows cleaned, 2 pre-joining rows deleted. Verified:
   Ravi=4h, Manoj=0, Deepa=0.
2. **Joining-date gate** — cannot mark attendance before `employee.joiningDate`.
   `attendance` upsert throws `BadRequestException` if `dto.date < ymd(joiningDate)`;
   `bulk` skips days before joining; grid cells before joining are disabled
   (opacity-30). Verified: 400 on pre-joining, 200 on valid.
3. **Individual payslip generation** — `/payroll/generate` now accepts
   `employeeId`; computes one employee from their active allocation wage.
   Frontend: "Generate one" modal (`UserPlus`), per-row PDF button (`FileText`).
4. **Payslip PDF download** — `GET /payroll/:id/payslip` (ADMIN/ACCOUNTS)
   **streams** a branded pdfkit PDF straight from the stored `Payroll` row
   (source of truth, no file written → works on ephemeral Cloud Run fs).
   Frontend `genPdf` does authenticated `fetch` → blob download. `pdfkit`
   added to backend deps; `BASE` exported from `api/client.ts`; vite proxies
   `/uploads`.

### What's deployed & running now (all live, all verified 2026-07-02)

| Piece | Host | URL / resource |
|---|---|---|
| Frontend (React SPA) | Firebase Hosting | https://kgf-foundry-06051646.web.app |
| Backend (NestJS API) | Google Cloud Run (auto-redeploy on push) | https://sasyantra-api-962851079223.us-central1.run.app |
| Database | Neon Postgres (free, scale-to-zero) | migrated (3 migrations) + seeded |
| Secrets | Secret Manager | `sasyantra-db-url`, `sasyantra-jwt-secret` |
| CI/CD | GitHub Actions → Cloud Run | `.github/workflows/deploy-backend.yml` (WIF) |

GCP project: `kgf-foundry-06051646` (billing on). The build/deploy chain runs
as SA `github-deployer@…` via Workload Identity Federation (no keys). Frontend
redeploys are still manual (`firebase deploy --only hosting`).

> **Security:** the Neon DB password appeared in this session's shell commands.
> If this transcript is shared, rotate it in Neon and add a new Secret Manager
> version (`gcloud secrets versions add sasyantra-db-url --data-file=-`) — the
> next push picks it up automatically. Demo seed passwords (`admin123`) are
> live — change via Settings → Users before real use.

### Chronological deploy log (most items DONE)

1. ~~Fix Prisma `binaryTargets`~~ **DONE 2026-07-02.** `binaryTargets = ["native",
   "linux-arm64-openssl-3.0.x","debian-openssl-3.0.x"]` (amd64 target is
   `debian-openssl-3.0.x`, NOT `linux-amd64-…`). `prisma generate`.
2. ~~Re-validate container~~ **DONE locally** — login + payslip PDF OK.
3. **DB decision: keep Neon** (free, migrated+seeded). Cloud SQL is the
   single-vendor alt but no permanent free tier (~$7-10/mo after $300 trial);
   swap = change `DATABASE_URL` + re-run migrate+seed, no code change.
4. ~~Execute the Cloud Run deploy~~ **DONE 2026-07-02.** Project
   `kgf-foundry-06051646` (billing on). Enabled APIs: run, cloudbuild,
   secretmanager, artifactregistry. Created: AR repo `sasyantra` (+ Cloud Build
   auto-created `cloud-run-source-deploy` for `--source` deploys), Secret Manager
   secrets `sasyantra-db-url` + `sasyantra-jwt-secret`. IAM: Cloud Build SA
   granted `run.admin`/`iam.serviceAccountUser`/`artifactregistry.writer`; Cloud
   Run runtime SA (default compute) granted `secretmanager.secretAccessor`.
   Deployed via `gcloud run deploy sasyantra-api --source . --region us-central1
   --allow-unauthenticated --memory=512Mi --cpu=1 --set-env-vars=JWT_ACCESS_EXPIRES=8h
   --set-secrets=DATABASE_URL=...,JWT_SECRET=...`. **NOTE: do NOT pass `PORT` in
   `--set-env-vars` — Cloud Run injects it (reserved; deploy rejects it).**
   Config files added: `cloudbuild.yaml` (build-from-source trigger, uses
   Secret Manager), `.gcloudignore` (excludes node_modules/dist/.env/uploads).
   **Live URL: `https://sasyantra-api-962851079223.us-central1.run.app`** —
   validated: 401 unauth, login→token, payroll generate count=3, payslip PDF
   `200 application/pdf`. ✅ Backend is live.
5. ~~Frontend deploy~~ **DONE 2026-07-02.** Rebuilt `frontend/dist` with
   `VITE_API_URL=https://sasyantra-api-962851079223.us-central1.run.app/api`.
   Installed `firebase-tools`; `firebase login` (pentelagowtham@gmail.com);
   added Firebase to project via **Firebase Console** (CLI `addfirebase` 403s
   until ToS accepted in console — that's the manual gate). Created `firebase.json`
   (hosting: public `frontend/dist`, `**→/index.html` SPA rewrite, asset cache
   headers) + `.firebaserc` (`default: kgf-foundry-06051646`). Deployed via
   `firebase deploy --only hosting --project kgf-foundry-06051646`.
   **Frontend URL: https://kgf-foundry-06051646.web.app** — validated: root
   `200 text/html`, deep route `/payroll` `200` (SPA rewrite), JS asset `200`.
   ✅ Frontend is live.
6. ~~Smoke test~~ **DONE.** Full deployed stack validated end-to-end: frontend
   → Cloud Run backend → Neon. Login → token; `GET /api/payroll/:id/payslip`
   → `200 application/pdf`. ✅
7. **(Optional) auto-redeploy on git push** — **backend DONE 2026-07-02** via
   GitHub Actions + Workload Identity Federation (no GitHub app, no keys to
   paste). Created: deployer SA `github-deployer@…` (roles run.admin /
   artifactregistry.writer / secretmanager.secretAccessor + serviceAccountUser
   on the runtime SA); WIF pool `github-pool` + OIDC provider `github-provider`
   (issuer `token.actions.githubusercontent.com`, condition
   `assertion.repository=='Gowtham-Pentela/sasyantra-erp'`, mapping
   `repository`/`repository_owner`/`subject`); SA WIF binding
   `principalSet://…/github-pool/attribute.repository/Gowtham-Pentela/sasyantra-erp`
   → `roles/iam.workloadIdentityUser` (set via `set-iam-policy` JSON — the CLI
   `add-iam-policy-binding` wrongly rejects valid `principalSet` members; and
   the format is **`attribute.`** singular, not `attributes.` plural — both
   were blockers). Workflow `.github/workflows/deploy-backend.yml` triggers on
   push to `main`/`deploy/free-stack` (paths: backend/**, Dockerfile,
   cloudbuild.yaml, the workflow), builds the Dockerfile on the runner, pushes
   to AR repo `sasyantra`, `gcloud run deploy --image` with the same
   env/secrets. **Activates on first `git push`** of the workflow file. Existing
   service keeps its last good revision if a workflow run fails (no outage).
   Frontend: re-run `firebase deploy` after rebuilding `dist` with the right
   `VITE_API_URL` (not yet automated).
   **ACTIVATED & VERIFIED 2026-07-02** — first `git push` (commit `b4112b6`)
   triggered the workflow; it built + pushed to AR + deployed a new revision
   (`sasyantra-api-00002-…`) via WIF. One fix needed: the deployer SA's
   `roles/iam.serviceAccountUser` on the runtime SA had silently failed to
   grant (re-granted via `add-iam-policy-binding` without the masking
   `--condition=None >/dev/null`); after that the run went green. Live backend
   re-verified (401/login/payslip PDF) post-redeploy. Frontend redeploy still
   manual (`firebase deploy`).
8. (Loose end) `deploy/render-vercel` PR is open and superseded — close it
   (and decide whether to merge `deploy/free-stack` → `main`).
9. ~~Commit this iteration's changes~~ **DONE** — committed as `91117d3`,
   `b4112b6`, `523e020` on `deploy/free-stack` (see §12). Working tree clean.

## 15. Current iteration (2026-07-03 / 2026-07-06) — Projects: status filter, delete, monthly progress

### Done & verified (local: `verify.sh` 34/34 green; deployed live)

1. **Status filtering** — Projects list has filter tabs (All / Ongoing=ACTIVE /
   Shelved=ON_HOLD / Completed / Cancelled). Client-side filter on loaded rows;
   `ON_HOLD` is displayed as "Shelved" everywhere. Badge tones map per status.
2. **Inline status change** — Project Workspace header has a Status `<select>`
   (ADMIN/OPS) that `PUT /projects/:id { status }`. ACCOUNTS still sees a
   read-only badge. Cancelling shows a hint that the project can now be deleted.
3. **Cancel-first delete with orphaning** — `DELETE /projects/:id` 400s unless
   `status === CANCELLED`. On a cancelled delete, one interactive
   `audited.$transaction` nulls `projectId` on all six dependents (allocation,
   payroll, invoice, expense, quotation, workOrder), drops the project's
   `ProjectProgress` rows, then deletes the project. Expenses etc. therefore
   **survive in their modules** with a cleared project link (only the project
   row is removed). Required making `Allocation.projectId` and
   `WorkOrder.projectId` nullable (migration `nullable_project_links`); the
   other four were already nullable. `updateMany` orphaning isn't per-row
   audited (known limitation, §11) — the DELETE itself is audited.
4. **Monthly completion %** — new `ProjectProgress` model
   (`projectId Int`, `month Int` YYYYMM, `percent Decimal(5,2) 0..100`,
   `@@unique([projectId, month])`). Endpoints: `GET /projects/:id/progress`,
   `POST` (upsert by month, validates 0–100 + YYYYMM), `DELETE
   /projects/:id/progress/:pid` (ADMIN/OPS). Workspace renders an ECharts line
   (0–100%, months on x) + progress bar + inline entry form + entries table.
   Seed logs 3 sample rows (25/45/60%) on PRJ-0001.

### Migrations added
- `20260703140440_progress` — `ProjectProgress` table.
- `20260703141444_nullable_project_links` — `Allocation.projectId`,
  `WorkOrder.projectId` → `Int?` (relations → `Project?`).

### Deployed (2026-07-06)
- Commit `2791a80` pushed to `deploy/free-stack`; GitHub Actions "Deploy backend
  to Cloud Run" run `28667789631` → **success**. `prisma migrate deploy` on
  container start applied both new migrations to Neon (verified: progress
  upsert round-trips live).
- Frontend rebuilt with
  `VITE_API_URL=https://sasyantra-api-962851079223.us-central1.run.app/api` and
  `firebase deploy --only hosting` → live at
  https://kgf-foundry-06051646.web.app.
- Live URLs unchanged (§14 table): backend
  https://sasyantra-api-962851079223.us-central1.run.app, frontend
  https://kgf-foundry-06051646.web.app.

### Still open (unchanged from §11 / §14)
- Merge `deploy/free-stack` → `main` (now 8 commits ahead); close superseded
  `deploy/render-vercel` PR.
- Frontend redeploy is still manual (`firebase deploy`) — not CI-wired.
- Demo seed passwords (`admin123`) remain live — change via Settings → Users.

## 16. Current iteration (2026-07-16) — project edit + payment-terms-in-days, expenses import/edit/unpay, attendance weekends + revert + legend

### Done & verified (local: `verify.sh` 34/34 green; backend auto-redeployed)

1. **Admin project edit** — the backend `PUT /projects/:id` already existed
   (ADMIN/OPS); added the UI. A ✏️ pencil on each Projects-list card and an
   "Edit details" button in the Project Workspace open a full edit modal
   (name, client name, **client GST**, site, dates, contract value, GST %,
   billing cycle, **payment terms (days)**, manager, status). One shared
   `ProjectFields` (exported from `Projects.tsx`) is used by create + edit in
   both pages — single definition, no drift, no new file. RBAC verified:
   ADMIN ✅, ACCOUNTS 403.
2. **Payment terms in days** — `Project.paymentTerms` changed `String?` → `Int?`
   (credit period in days). Migration `20260716125700_payment_terms_days`
   coerces existing rows via
   `ALTER ... USING NULLIF(substring("paymentTerms" FROM '^[0-9]+'),'')::INTEGER`
   so `'45 days from invoice'` → `45` (no data loss — verified on the local DB:
   PRJ-0002 became `45`). Seed updated to integers (`30` / `45`). Workspace now
   renders "45 days" instead of the raw string. `Client.paymentTerms` left as
   `String?` (out of scope — only Project was requested).
3. **Expense Excel import** — `POST /expenses/import` (ADMIN/ACCOUNTS, OPS 403),
   multipart `file`, `FileInterceptor('file', { limits: 5MB })`, parsed with
   SheetJS `xlsx` (new backend dep, `cellDates:true`). Columns matched
   case-insensitively: `date, category, vendor, amount, gst, project|projectId,
   dueDate, remarks` (`category`+`amount` required). `date` accepts Excel serials,
   `YYYY-MM-DD`, and `DD-MM-YYYY`. `project` (a name) resolves to `projectId`
   case-insensitively. Rows created as `UNPAID`; bad rows skipped with per-row
   errors (≤20 returned). Verified: 4-row sample → 2 created / 1 skipped (bad
   row) / project name resolved to id 40 / DD-MM-YYYY date parsed. Frontend
   "Import Excel" button + modal showing the column spec + file picker.
   `http.upload(path, file)` added to `api/client.ts` (FormData, no forced
   JSON content-type).
4. **Expense edit + unpay** — edit modal (✏️ pencil) reuses the create form
   (`PUT /expenses/:id`). `POST /expenses/:id/unpay` reverts a mistakenly-PAD
   expense → `UNPAID`, `paidAmount 0`, `paidDate null`; frontend swaps the row
   action between Mark paid ↔ Unpay on `status`. Verified PAID→UNPAID
   round-trip. (No expense DELETE endpoint.)
5. **Attendance weekend fix** — the old `weekdays()` skipped only Sunday, so
   bulk-mark was marking **Saturdays** Present. Split into `allDays` (every
   day — used for grid columns, so weekends stay manually markable, e.g.
   Saturday OT) and `weekdays` (Mon–Fri — used by bulk). Verified: July 2026
   bulk created 0 weekend rows; grid shows all 31 days incl. 8 weekend columns.
6. **Attendance bulk-revert** — `POST /attendance/bulk-revert?month=&code=P`
   (ADMIN/OPS) `deleteMany` of rows matching the code AND with all extras `= 0`
   and `remarks IS NULL` — i.e. only untouched auto-marked rows; manual edits
   survive. One summary `AuditLog` row written (deleteMany isn't per-row
   audited, §11). Frontend "Revert bulk" button. Verified 141 created → 141
   deleted; manual OT/advance cell preserved.
7. **Attendance legend** — each code chip now reads `P — Present`, `A — Absent`,
   `OT — Overtime`, `HD — Half Day`, `WO — Weekly Off`, `LV — Leave`,
   `HL — Holiday`, `NS — Night Shift`, `DS — Double Shift`, `TR — Training`
   (also as tooltips).

### Migration added
- `20260716125700_payment_terms_days` — `Project.paymentTerms` `String?` → `Int?`
  with the leading-int `USING` coercion above.

### Deploy status (⚠ read before touching the live site)
- Commit `da1c0d3` pushed to `deploy/free-stack`. The GitHub Actions
  "Deploy backend to Cloud Run" workflow (triggers on `backend/**` pushes to
  `deploy/free-stack`) run **`29525611700`** — **completed, success** in 1m44s
  (started 2026-07-16T18:50Z).
  The Dockerfile CMD is `npx prisma migrate deploy && node dist/main.js`, so the
  new `payment_terms_days` migration is **auto-applied to the Neon prod DB on
  container start** (idempotent). Backend: live + migrated.
- **Frontend is NOT auto-deployed.** The live Firebase Hosting site still
  serves the **old** frontend bundle, which is now **version-skewed** from the
  migrated backend:
  - Old frontend project create/edit sends `paymentTerms` as a string
    (`'30 days from invoice'`) → the new backend column is `Int?` → Prisma
    will reject/ coerce oddly on project create+edit. **Rebuild + redeploy the
    frontend before using the live Projects create/edit.**
  - The new Expenses (import/edit/unpay) and Attendance (revert/legend/weekend
    grid) UI does not exist on the live site yet.
- To sync the frontend:
  `cd frontend && VITE_API_URL=https://sasyantra-api-962851079223.us-central1.run.app/api npm run build && firebase deploy --only hosting --project kgf-foundry-06051646`
- `verify.sh` was **not** extended with new checks for these features (the
  features were verified manually + via curl). Add critical-path checks
  (import, unpay, bulk-revert, weekend skip) to `verify.sh` when stable —
  it's the contract that must stay green (§13).

### Still open (unchanged from §11 / §14 / §15)
- Merge `deploy/free-stack` → `main` (now 8 commits ahead); close superseded
  `deploy/render-vercel` PR.
- Frontend redeploy is still manual (`firebase deploy`) — not CI-wired.
- Demo seed passwords (`admin123`) remain live — change via Settings → Users.
- Extend `verify.sh` to cover the new expenses/attendance endpoints (above).