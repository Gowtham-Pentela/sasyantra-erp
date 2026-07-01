import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { ProjectsModule } from './projects/projects.module';
import { AllocationsModule } from './allocations/allocations.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PayrollModule } from './payroll/payroll.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ActivityModule } from './activity/activity.module';
import { BudgetModule } from './budget/budget.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { QuotationsModule } from './quotations/quotations.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { DocumentsModule } from './documents/documents.module';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { JwtAuthGuard, RolesGuard } from './auth/guards';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    ProjectsModule,
    AllocationsModule,
    AttendanceModule,
    PayrollModule,
    BudgetModule,
    InvoicesModule,
    ExpensesModule,
    PaymentsModule,
    UsersModule,
    ClientsModule,
    QuotationsModule,
    WorkOrdersModule,
    DocumentsModule,
    ReportsModule,
    AnalyticsModule,
    DashboardModule,
    ActivityModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}