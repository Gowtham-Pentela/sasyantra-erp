# Sasyantra ERP — Project Context (session handover)

> Read this first when opening a new session on this project. It is the
> authoritative "what we built, where it lives, how to run it, what's left"
> so a new session continues without re-discovering the codebase.
>
> Last updated: 2026-07-02. All 16 SRS modules + Budget live. Three payroll/
> attendance bugs fixed + payslip PDF download added. **Fully deployed &
> validated:** backend on Cloud Run, DB on Neon, frontend on Firebase Hosting.
> Live URLs in §14.

## 1. What this is

**Sasyantra Integrated Systems** — an ERP for a manpower-supply company
(Sasyantra). Manpower supply = the company deploys workers to client sites /
projects and bills for them. The ERP tracks employees, projects, attendance,
payroll, invoicing, budget/cash, and the commercial front-office (clients,
quotations, work orders).

Owner / GitHub: **Gowtham-Pentela** — repo is **private**:
https://github.com/Gowtham-Pentela/sasyantra-erp (branch `main`, 5 commits).

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
./verify.sh                 # 30 checks, reseeds a clean baseline each run
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
| Projects | ✅ | CRUD, auto `PRJ-####`, workspace, financial summary, deployed list, allocation history |
| Allocation | ✅ | assign/transfer (auto-ends prior, keeps history) |
| Attendance | ✅ | **GLOBAL** (all active employees, not project-scoped — changed this iteration). Month grid, click cell, bulk-mark weekdays Present |
| Payroll | ✅ | generate from attendance, gross→net (PF/ESI/PT/advance/OT), CSV export, **Mark Paid** per row → SalaryPayment (drains budget) |
| Budget | ✅ | company cash fund: `available = opening + topups + invoice payments − expenses paid − salary paid` (recomputed live) |
| Invoices | ✅ | GST invoices, auto `INV-####`, computed gstAmount/total, record payments (UTR/mode), status PAID/PARTIAL/OVERDUE, payment lifts budget |
| Expenses | ✅ | categorized, project-taggable, Mark Paid reduces budget |
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

3 migrations: `init`, `finance`, `commercial`.
18 models + 11 enums (see `model`/`enum` list in schema). Key relations:
- `Project.clientId` + `Client?` (a project belongs to a client)
- `Invoice.fromQuotation` + `Quotation.convertedInvoiceId Int? @unique` (1:1 for accepted quotes)
- `Payroll.paid Boolean @default(false)` + `paidDate` + `salaryPayment SalaryPayment?`
- `Employee.documents`, `User.documents Document[]`
- `Document.@@index([entity, entityId])`

Money fields are all `Decimal @db.Decimal(18,2)`.

## 7. Seed — `backend/prisma/seed.ts`

Cleanup block deletes in FK-safe order:
`auditLog, document, workOrder, quotation, client, salaryPayment,
invoicePayment, invoice, expense, budgetEntry, payroll, attendance,
allocation, employee, project, user`. **Postgres sequences are NOT reset by
reseed** → never assume id=1 after a reseed; fetch ids dynamically
(`verify.sh` does `PRJ=$(curl ... /projects | J "[0]['id'])`).

Seed data: 3 users, 2 projects, 6 employees, budget opening ₹5,00,000,
INV-0001 (paid 118000) + INV-0002 (partial 100000/236000, overdue),
2 expenses (Staff Wages PAID 150000, Office Rent UNPAID 40000),
last-month payroll + SalaryPayment (19709), 2 clients (GreenTech/Bharat Steel,
GST matching existing projects), QUO-0001 (ACCEPTED 123900),
QUO-0002 (SENT 198240), WO-0001 (IN_PROGRESS).

## 8. Verification — `verify.sh`

30 checks: auth/dashboard/audit/payroll/RBAC (1-7), finance (8-12: budget
topup both directions, invoice+payment, expense pay, payroll Mark Paid, user
mgmt), commercial (13-17: clients, quote→invoice + idempotent re-accept,
work-order status, document upload+serve, reports/analytics).
**Reseeds at start** (`cd backend && npm run seed`) because the suite mutates
the DB. Run result: 30 passed, 0 failed. Keep it idempotent.

## 9. Known gotchas / decisions made (don't re-litigate)

- **Attendance is global.** `byMonth` selects all `archivedAt: null` employees
  (no project filter). `projectId` query param is still accepted but ignored.
  Payroll reads attendance by `employeeId + month`, not project — so the
  global change doesn't break payroll.
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
- **Deployment** — Dockerfile now exists (multi-stage, root). Render/Vercel
  were paywalled (managed Postgres) → pivoted to **Google Cloud Run (backend,
  generous free tier) + Neon (Postgres, scale-to-zero) + Cloudflare Pages
  (frontend)**. See §14 for in-progress state. The payslip PDF is now
  **streamed server-side** (pdfkit, stateless — works on Cloud Run) instead
  of browser Print only — done.

## 12. Repo state (as of this writing)

- branch `main`, 5 commits, `origin` → Gowtham-Pentela/sasyantra-erp (private).
- commits: `00d15e2` initial slice → `bce2e7b` finance → `893c9ca` commercial
  (clients/quotes/WO/docs/reports/analytics) → `07b2c73` verify reseed →
  `812b977` global attendance.
- **Working tree NOT clean** — this iteration's changes are uncommitted:
  `backend/src/attendance/attendance.module.ts`, `backend/src/payroll/payroll.module.ts`
  (pdfkit streaming), `backend/prisma/seed.ts`, `backend/package.json`
  (pdfkit dep), `frontend/src/pages/{Payroll,Attendance}.tsx`,
  `frontend/src/api/client.ts` (`BASE` export), `frontend/vite.config.ts`
  (`/uploads` proxy), `frontend/src/vite-env.d.ts`, `Dockerfile`,
  `render.yaml` (now inert), `vercel.json` (now inert). Commit once the
  binaryTargets blocker is fixed and the container validates.

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

### Free-stack deploy (in progress)

- **DB:** Neon Postgres provisioned, 3 migrations applied, seeded
  (admin/ops/accounts). Connection string (in `backend/.env`, gitignored) uses
  `sslmode=require&channel_binding=require` and works with Prisma. **The
  password in the Neon connection string is a live secret — rotate it if this
  transcript is ever shared.**
- **Backend → Google Cloud Run:** `Dockerfile` (multi-stage, node20-bookworm-slim,
  installs openssl at runtime, `prisma migrate deploy && node dist/main.js`,
  reads `PORT`). Builds locally. **BLOCKER:** image crashes at
  `PrismaService.onModuleInit` — Prisma Client generated for
  `linux-arm64-openssl-1.1.x` but runtime needs `linux-arm64-openssl-3.0.x`
  (built on Apple Silicon). Fix: add `binaryTargets` to the generator block in
  `backend/prisma/schema.prisma` — e.g.
  `binaryTargets = ["native","linux-arm64-openssl-3.0.x","debian-openssl-3.0.x"]`
  (bookworm = Debian 12 = openssl 3, so amd64 uses `debian-openssl-3.0.x` —
  NOT `linux-amd64-…`, which isn't a valid Prisma target), `prisma generate`, Then re-run container and verify login + payslip PDF
  returns `application/pdf`.
- **Cloud Run deploy steps (not yet executed):** create GCP project, enable
  Cloud Run + Artifact Registry (or build-from-source), deploy the image with
  env vars `DATABASE_URL`, `JWT_SECRET` (`918451…c14bb`), `JWT_ACCESS_EXPIRES=8h`,
  `PORT=8080`, allow unauthenticated. Frontend env `VITE_API_URL=https://<run-url>/api`.
- **Frontend → Cloudflare Pages:** root `frontend/`, build `npm run build`,
  output `dist`, env `VITE_API_URL` as above. Repo is private but CF Pages can
  build from a private repo. `vercel.json` left in tree but inert.

### Pending (next session, in order)

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
8. (Loose end) `deploy/render-vercel` PR is open and superseded — close it.
9. Commit this iteration's changes (see §12).