# Sasyantra ERP — Project Context (session handover)

> Read this first when opening a new session on this project. It is the
> authoritative "what we built, where it lives, how to run it, what's left"
> so a new session continues without re-discovering the codebase.
>
> Last updated: 2026-07-01. All 16 SRS modules + Budget are live and green
> (`./verify.sh` 30/30). The code is pushed to GitHub (private).

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
- **Deployment** — the app currently only runs on localhost. To make it
  reachable by the company, prep a `Dockerfile` + `docker-compose` (app +
  Postgres) so it runs anywhere, or deploy to Render/Railway. **User has NOT
  confirmed this yet** — offer, don't start unprompted.

## 12. Repo state (as of this writing)

- branch `main`, 5 commits, `origin` → Gowtham-Pentela/sasyantra-erp (private).
- commits: `00d15e2` initial slice → `bce2e7b` finance → `893c9ca` commercial
  (clients/quotes/WO/docs/reports/analytics) → `07b2c73` verify reseed →
  `812b977` global attendance.
- Working tree clean.
- Servers were running at handover (`:3000` API, `:5173` web); DB had 4 users
  (3 seed + 1 created by a prior `verify.sh` run).

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