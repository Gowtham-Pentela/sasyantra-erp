# Sasyantra Manpower Operations ERP

A premium, audit-proof ERP for manpower-supply businesses. This repository contains a
**working vertical slice** — the core value loop (Employee → Project → Allocate →
Attendance → Payroll → Dashboard) plus **Finance** (Budget, Invoices, Expenses, Payments,
per-row salary payout), **Commercial front-office** (Clients, Quotations, Work Orders),
**Reporting & Analytics**, **Documents**, and **User management** — all 16 original modules
live, under an immutable audit trail and JWT/RBAC auth.

> Built Ponytail-first: native APIs, fewest files, no speculative abstraction. The full
> SRS feature surface is the *upgrade path*, not this release.

## Stack
- **Backend:** NestJS 10 + Prisma 5 + PostgreSQL 16 + JWT + bcrypt. Audit via a single
  Prisma `$extends` hook on all models.
- **Frontend:** React 18 + TypeScript + Vite + Tailwind (dark/light) + ECharts + zustand.
- **Money:** `Decimal(18,2)` in rupees (zero float drift), coerced to JS numbers on output
  via a one-line `Prisma.Decimal.prototype.toJSON` override.

## Run it (two terminals)

PostgreSQL must be running on `localhost:5432`. A database `sasyantra_erp` is required.

```bash
# one-time: create db + backend deps + schema + seed
createdb sasyantra_erp                       # or: psql -d postgres -c 'CREATE DATABASE sasyantra_erp;'
cd backend && npm install
npx prisma migrate dev        # creates tables
npm run seed                  # 3 users, 2 projects, 6 employees, sample attendance
npm run start:dev             # API on http://localhost:3000/api

# other terminal: frontend
cd frontend && npm install && npm run dev   # app on http://localhost:5173
```

End-to-end smoke (with the API running):
```bash
./verify.sh        # 30 checks: auth, dashboard, audit, payroll, RBAC, finance (budget both
                   #           directions, invoice, expense, salary payout), user mgmt, clients,
                   #           quotation→invoice conversion, work orders, documents, reports, analytics
```

## Seeded logins
| Email | Password | Role |
|---|---|---|
| `admin@sasyantra.in` | `admin123` | Administrator (everything) |
| `ops@sasyantra.in` | `admin123` | Operations Manager (employees/projects/allocations/attendance) |
| `accounts@sasyantra.in` | `admin123` | Accounts (attendance/payroll; no employee create) |

## What's working (this slice)
- **Dashboard** — live KPIs from data (active projects, employees, present-today %, salary
  liability, advances, renewals); project cards + dynamic workspace; ECharts.
- **Employees** — CRUD, auto `EMP-####` codes, archive/restore (never hard-deleted),
  per-employee audit timeline drawer, search + status filter.
- **Projects** — CRUD, auto `PRJ-####` codes, workspace with details, financial summary,
  deployed-employee list, full allocation history.
- **Allocation** — assign/transfer (auto-ends prior allocation, keeps full history).
- **Attendance** — month calendar grid (rows=employees, cols=days), click any cell to set
  code + OT + advance + allowances; bulk-mark weekdays Present.
- **Payroll** — one-click generate from attendance; gross → net with PF/ESI/PT/advance
  recovery/OT; totals; CSV export; **Mark Paid** per row (creates a SalaryPayment, drains the
  budget, shows UTR + paid badge, "Paid this month" tile).
- **Budget** — company cash fund: `available = opening + top-ups + invoice payments − expenses
  paid − salary paid`, recomputed live from the other modules. Add opening/top-up, in/out
  breakdown, recent movements ledger.
- **Invoices** — GST invoices linked to projects, auto `INV-####`, computed `gstAmount`/`total`;
  record payments (UTR/mode) → status PAID/PARTIAL/OVERDUE; payment lifts the budget.
- **Expenses** — categorized, project-taggable, paid/overdue status; Mark Paid reduces the budget.
- **Payments** — read-only ledger of money in (invoice payments) and out (salary payments),
  date-filtered.
- **Settings · Users** — ADMIN creates other users (email/name/password/role), resets passwords,
  deletes (guards self + last admin).
- **Clients** — client master (GST/PAN/contacts/billing), search, links to projects,
  quotations & work orders.
- **Quotations** — `QUO-####`, line-item editor with live subtotal/GST/total; DRAFT→SENT→ACCEPTED;
  **Accept auto-creates an Invoice** from its lines (idempotent).
- **Work Orders** — `WO-####` against a project (optional client/quotation), scope + period + value,
  status OPEN→IN_PROGRESS→CLOSED/CANCELLED.
- **Documents** — attach files to any record (Employee/Project/Client/Invoice); multipart upload,
  served from local `/uploads`, download links, admin delete.
- **Reports** — per-project margin (revenue − salary − expenses), salary register, and cash-flow
  views, date-filtered, with **Print / save-as-PDF** (browser, no server lib).
- **Analytics** — 12-month revenue vs expenses vs salary chart, contract-value pie, project-status
  bar, headcount & skill mix, 30-day attendance utilization, budget health (ECharts).
- **Activity Logs** — immutable audit trail of every create/update/delete/upsert across all
  tables, with table + timeline views and CSV export.
- **Auth** — JWT, RBAC (ADMIN/OPS/ACCOUNTS), role-gated UI, protected routes.

All 16 original modules + Budget are now live. No nav item is a stub anymore.

## Audit trail (how it works)
Every write goes through `prisma.$extends({ query: { $allModels: { create/update/delete/upsert } }})`
in `backend/src/audit/audit.extension.ts`. User identity comes from a per-request
`AsyncLocalStorage` set by an Express middleware that decodes the JWT. Audit rows are
written via the *non-extended* base client (no recursion). `AuditLog` itself is excluded.
Old values are read before mutation; new values captured after.

## Explicit upgrade list
- Server-side branded PDF (salary register, bank transfer sheet, GST invoices) — currently browser Print/CSV.
- Document storage to S3 + OCR + e-signatures (currently local fs).
- Refresh-token rotation (currently 8h access token).
- Per-row audit for `createMany/updateMany/deleteMany` (currently single-op only).
- Holiday calendar for `workingDays`; configurable PF/ESI/PT slabs (currently flat ₹200 PT, 12% PF, 0.75%/3.25% ESI, ESI ceiling ₹21,000).
- Expense split payments & invoice credit-notes/void; recurring expenses.
- Client portal, employee mobile app with GPS attendance, biometric, WhatsApp/email reminders.
- Multi-company / multi-branch, PF/ESI compliance automation, bank API disbursement.

## Project layout
```
backend/   NestJS app — one file per feature module (controller+service+module combined)
  prisma/schema.prisma    6 models + AuditLog
  src/audit/audit.extension.ts   the DRY audit hook (read it — it's the spine of the system)
frontend/  Vite + React — pages/, components/, single zustand store (auth+theme)
verify.sh  curl+python3 end-to-end smoke
```

## Notes
- Money is rupees (`Decimal`), not paise. Int32-paise overflows at ~₹2.14 cr per field;
  Decimal is unbounded and Postgres-native.
- Soft delete only: employees are archived (`archivedAt`), never deleted. Audit rows are
  never cascade-deleted.