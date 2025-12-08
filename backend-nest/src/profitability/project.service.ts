import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus } from '@prisma/client';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private prisma: PrismaService) {}

  async createProject(data: {
    workspaceId: string;
    name: string;
    clientName: string;
    description?: string;
    budgetAmount?: number;
    hourlyRate?: number;
    currency?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const project = await this.prisma.project.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        clientName: data.clientName,
        description: data.description,
        budgetAmount: data.budgetAmount,
        hourlyRate: data.hourlyRate,
        currency: data.currency || 'USD',
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });

    // Initialize profitability record
    await this.prisma.projectProfitability.create({
      data: {
        projectId: project.id,
      },
    });

    return project;
  }

  async getProjects(workspaceId: string, filters?: { status?: ProjectStatus }) {
    return this.prisma.project.findMany({
      where: {
        workspaceId,
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        profitability: true,
        _count: {
          select: {
            timeEntries: true,
            expenses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectById(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        profitability: true,
        timeEntries: {
          orderBy: { date: 'desc' },
          take: 50,
        },
        expenses: {
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });
  }

  async updateProject(
    projectId: string,
    data: {
      name?: string;
      description?: string;
      status?: ProjectStatus;
      budgetAmount?: number;
      hourlyRate?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return this.prisma.project.update({
      where: { id: projectId },
      data,
    });
  }

  async deleteProject(projectId: string) {
    return this.prisma.project.delete({
      where: { id: projectId },
    });
  }

  async addTimeEntry(data: {
    projectId: string;
    userId: string;
    description?: string;
    hours: number;
    billable?: boolean;
    hourlyRate?: number;
    date: Date;
  }) {
    const entry = await this.prisma.projectTimeEntry.create({
      data: {
        projectId: data.projectId,
        userId: data.userId,
        description: data.description,
        hours: data.hours,
        billable: data.billable ?? true,
        hourlyRate: data.hourlyRate,
        date: data.date,
      },
    });

    // Update project totals
    await this.updateProjectTotals(data.projectId);

    return entry;
  }

  async updateTimeEntry(
    entryId: string,
    data: {
      description?: string;
      hours?: number;
      billable?: boolean;
      hourlyRate?: number;
      date?: Date;
    },
  ) {
    const entry = await this.prisma.projectTimeEntry.update({
      where: { id: entryId },
      data,
    });

    await this.updateProjectTotals(entry.projectId);

    return entry;
  }

  async deleteTimeEntry(entryId: string) {
    const entry = await this.prisma.projectTimeEntry.findUnique({
      where: { id: entryId },
    });

    if (entry) {
      await this.prisma.projectTimeEntry.delete({
        where: { id: entryId },
      });

      await this.updateProjectTotals(entry.projectId);
    }
  }

  async addExpense(data: {
    projectId: string;
    description: string;
    amount: number;
    category?: string;
    billable?: boolean;
    date: Date;
  }) {
    const expense = await this.prisma.projectExpense.create({
      data: {
        projectId: data.projectId,
        description: data.description,
        amount: data.amount,
        category: data.category,
        billable: data.billable ?? true,
        date: data.date,
      },
    });

    await this.updateProjectTotals(data.projectId);

    return expense;
  }

  async updateExpense(
    expenseId: string,
    data: {
      description?: string;
      amount?: number;
      category?: string;
      billable?: boolean;
      date?: Date;
    },
  ) {
    const expense = await this.prisma.projectExpense.update({
      where: { id: expenseId },
      data,
    });

    await this.updateProjectTotals(expense.projectId);

    return expense;
  }

  async deleteExpense(expenseId: string) {
    const expense = await this.prisma.projectExpense.findUnique({
      where: { id: expenseId },
    });

    if (expense) {
      await this.prisma.projectExpense.delete({
        where: { id: expenseId },
      });

      await this.updateProjectTotals(expense.projectId);
    }
  }

  private async updateProjectTotals(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        timeEntries: true,
        expenses: true,
      },
    });

    if (!project) return;

    const totalHours = project.timeEntries.reduce(
      (sum, entry) => sum + entry.hours,
      0,
    );
    const billableHours = project.timeEntries
      .filter((entry) => entry.billable)
      .reduce((sum, entry) => sum + entry.hours, 0);

    const actualCosts = project.expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        totalHours,
        billableHours,
        actualCosts,
      },
    });
  }

  async getProjectsByClient(workspaceId: string, clientName: string) {
    return this.prisma.project.findMany({
      where: {
        workspaceId,
        clientName: {
          contains: clientName,
          mode: 'insensitive',
        },
      },
      include: {
        profitability: true,
      },
    });
  }
}
