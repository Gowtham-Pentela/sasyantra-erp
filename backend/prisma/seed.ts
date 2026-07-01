import { PrismaClient, Role, EmployeeStatus, SalaryType, AttendanceCode, ProjectStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// seed uses the RAW client (no audit extension) — bootstrap data isn't audited.
async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.salaryPayment.deleteMany();
  await prisma.invoicePayment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.budgetEntry.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const pwd = await bcrypt.hash('admin123', 10);
  const users = await Promise.all([
    prisma.user.create({ data: { email: 'admin@sasyantra.in', passwordHash: pwd, name: 'Administrator', role: Role.ADMIN } }),
    prisma.user.create({ data: { email: 'ops@sasyantra.in', passwordHash: pwd, name: 'Operations Manager', role: Role.OPS } }),
    prisma.user.create({ data: { email: 'accounts@sasyantra.in', passwordHash: pwd, name: 'Accounts User', role: Role.ACCOUNTS } }),
  ]);

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        code: 'PRJ-0001',
        name: 'Tech Park Housekeeping',
        clientName: 'GreenTech Infra Pvt Ltd',
        clientGst: '29AABCG1234L1Z5',
        siteLocation: 'Whitefield, Bengaluru',
        mapsUrl: 'https://maps.google.com/?q=Whitefield+Bengaluru',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2026-12-31'),
        billingCycle: 'Monthly',
        paymentTerms: '30 days from invoice',
        contractValue: 4800000,
        gstPercent: 18,
        status: ProjectStatus.ACTIVE,
        projectManager: 'Ramesh Kumar',
      },
    }),
    prisma.project.create({
      data: {
        code: 'PRJ-0002',
        name: 'Factory Security Staffing',
        clientName: 'Bharat Steel Works',
        clientGst: '33AAACB5678M1Z2',
        siteLocation: 'Hosur, Tamil Nadu',
        mapsUrl: 'https://maps.google.com/?q=Hosur',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2027-05-31'),
        billingCycle: 'Monthly',
        paymentTerms: '45 days from invoice',
        contractValue: 7200000,
        gstPercent: 18,
        status: ProjectStatus.ACTIVE,
        projectManager: 'Suresh Patel',
      },
    }),
  ]);

  const empSeed = [
    ['Ravi Shankar', 'Supervisor', 'Housekeeping', 850, true, true],
    ['Manoj Kumar', 'Cleaner', 'Housekeeping', 600, true, false],
    ['Deepa Rani', 'Cleaner', 'Housekeeping', 550, false, true],
    ['Imran Khan', 'Security Guard', 'Security', 700, true, false],
    ['Lakshmi N', 'Security Guard', 'Security', 700, true, true],
    ['Vijay Prasad', 'Lead Security', 'Security', 950, true, false],
  ] as const;

  const employees: any[] = [];
  for (let i = 0; i < empSeed.length; i++) {
    const [name, designation, skill, dailyWage, pf, esi] = empSeed[i];
    const e = await prisma.employee.create({
      data: {
        empCode: `EMP-${String(i + 1).padStart(4, '0')}`,
        name,
        fatherName: '—',
        mobile: `90000${10000 + i}`,
        address: 'Bengaluru',
        dob: new Date('1990-01-01'),
        gender: i % 2 ? 'Female' : 'Male',
        bloodGroup: 'O+',
        emergencyContact: `90000${20000 + i}`,
        aadhar: `1234-5678-${900 + i}`,
        pan: `ABCDE${1000 + i}F`,
        bankAccount: `${1000000000 + i}`,
        ifsc: 'HDFC0000123',
        upi: `emp${i + 1}@upi`,
        joiningDate: new Date('2025-01-15'),
        skillCategory: skill,
        designation,
        salaryType: SalaryType.DAILY,
        dailyWage,
        monthlySalary: dailyWage * 26,
        pf,
        esi,
        uan: pf ? `UAN${100000 + i}` : null,
        status: EmployeeStatus.ACTIVE,
      },
    });
    employees.push(e);
  }

  // allocate first 3 to project 1, last 3 to project 2
  await Promise.all([
    ...employees.slice(0, 3).map((e, idx) =>
      prisma.allocation.create({
        data: { employeeId: e.id, projectId: projects[0].id, role: idx === 0 ? 'Supervisor' : 'Worker', dailyWage: e.dailyWage, effectiveDate: new Date('2025-01-16') },
      }),
    ),
    ...employees.slice(3).map((e, idx) =>
      prisma.allocation.create({
        data: { employeeId: e.id, projectId: projects[1].id, role: idx === 0 ? 'Lead' : 'Guard', dailyWage: e.dailyWage, effectiveDate: new Date('2025-06-01') },
      }),
    ),
  ]);

  // sample attendance: mark all present for the last 5 working days (excluding Sundays)
  const today = new Date();
  for (let d = 0; d < 10; d++) {
    const day = new Date(today);
    day.setDate(today.getDate() - d);
    if (day.getDay() === 0) continue; // skip Sunday
    if (d >= 5) break; // last 5 working days
    for (const e of employees) {
      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: e.id, date: day } },
        create: { employeeId: e.id, date: day, code: AttendanceCode.P, otHours: d % 2 ? 2 : 0, food: 50 },
        update: {},
      });
    }
  }
  // mark today: 1 absent, 1 half-day
  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: employees[1].id, date: today } },
    create: { employeeId: employees[1].id, date: today, code: AttendanceCode.A },
    update: { code: AttendanceCode.A },
  });
  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: employees[2].id, date: today } },
    create: { employeeId: employees[2].id, date: today, code: AttendanceCode.HD, advance: 500 },
    update: { code: AttendanceCode.HD, advance: 500 },
  });

  // ---- finance seed ----
  await prisma.budgetEntry.create({ data: { amount: 500000, type: 'OPENING', date: new Date('2025-01-01'), note: 'Initial company cash fund' } });

  // invoice 1 on project 1 — fully paid (₹1,00,000 + 18% GST)
  const inv1 = await prisma.invoice.create({
    data: {
      number: 'INV-0001', projectId: projects[0].id, issueDate: new Date('2025-02-01'), dueDate: new Date('2025-03-01'),
      subtotal: 100000, gstPercent: 18, gstAmount: 18000, total: 118000, notes: 'Monthly billing Jan',
    },
  });
  await prisma.invoicePayment.create({ data: { invoiceId: inv1.id, amount: 118000, receivedDate: new Date('2025-02-20'), mode: 'BANK', utr: 'UTRINV1', remarks: 'Paid in full' } });

  // invoice 2 on project 2 — partial + overdue (₹2,00,000 + 18% GST, only 1,00,000 received)
  const inv2 = await prisma.invoice.create({
    data: {
      number: 'INV-0002', projectId: projects[1].id, issueDate: new Date('2025-03-01'), dueDate: new Date('2025-04-01'),
      subtotal: 200000, gstPercent: 18, gstAmount: 36000, total: 236000, notes: 'Monthly billing Feb',
    },
  });
  await prisma.invoicePayment.create({ data: { invoiceId: inv2.id, amount: 100000, receivedDate: new Date('2025-03-25'), mode: 'BANK', utr: 'UTRINV2A', remarks: 'Partial' } });

  // expenses: one PAID (staff wages ₹1,50,000), one UNPAID (office rent ₹40,000)
  await prisma.expense.create({
    data: { date: new Date('2025-02-05'), category: 'Staff Wages', vendor: 'Cash Labour', amount: 150000, gst: 0, projectId: projects[0].id, paidAmount: 150000, status: 'PAID', paidDate: new Date('2025-02-05'), remarks: 'Daily-wage labour payout' },
  });
  await prisma.expense.create({
    data: { date: new Date('2025-03-01'), category: 'Office Rent', vendor: 'Workspace LLP', amount: 40000, gst: 0, paidAmount: 0, status: 'UNPAID', dueDate: new Date('2025-04-01'), remarks: 'Quarterly office rent' },
  });

  // last month's payroll for employee 0 (project 1) — mark paid so "paid to employees" is non-zero.
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lm = Number(`${lastMonth.getFullYear()}${String(lastMonth.getMonth() + 1).padStart(2, '0')}`);
  const payroll0 = await prisma.payroll.create({
    data: {
      employeeId: employees[0].id, projectId: projects[0].id, month: lm,
      workingDays: 26, presentDays: 24, otHours: 0, gross: 22100, attendanceDeduction: 1700, basic: 11050, otAmount: 0,
      bonus: 0, advanceRecovery: 0, travel: 0, food: 1300, pf: 1326, esi: 165, professionalTax: 200, net: 19709, employerCost: 25705,
    },
  });
  await prisma.salaryPayment.create({ data: { payrollId: payroll0.id, employeeId: employees[0].id, month: lm, amount: 19709, paidDate: lastMonth, mode: 'BANK', utr: 'UTRSAL0', remarks: 'Last month salary' } });

  console.log(`Seeded: ${users.length} users, ${projects.length} projects, ${employees.length} employees`);
  console.log('Login: admin@sasyantra.in / admin123  (also ops@, accounts@ — same password)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());