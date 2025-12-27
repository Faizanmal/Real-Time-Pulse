import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfitabilityService {
  private readonly logger = new Logger(ProfitabilityService.name);

  constructor(private prisma: PrismaService) {}

  // Calculate profitability for all projects every hour
  @Cron(CronExpression.EVERY_HOUR)
  async calculateAllProfitability() {
    this.logger.log('Calculating profitability for all projects...');

    const projects = await this.prisma.project.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'ON_HOLD'],
        },
      },
    });

    for (const project of projects) {
      try {
        await this.calculateProjectProfitability(project.id);
      } catch (error) {
        this.logger.error(
          `Failed to calculate profitability for project ${project.id}: ${error.message}`,
        );
      }
    }
  }

  async calculateProjectProfitability(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        timeEntries: true,
        expenses: true,
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Calculate revenue
    const billableEntries = project.timeEntries.filter((e) => e.billable);
    const totalRevenue = billableEntries.reduce((sum, entry) => {
      const rate = entry.hourlyRate || project.hourlyRate || 0;
      return sum + entry.hours * rate;
    }, 0);

    // Calculate labor costs
    const laborCosts = project.timeEntries.reduce((sum, entry) => {
      const rate = entry.hourlyRate || project.hourlyRate || 0;
      return sum + entry.hours * rate * 0.7; // Assume 70% is cost
    }, 0);

    // Calculate expense costs
    const expenseCosts = project.expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

    const totalCosts = laborCosts + expenseCosts;
    const grossProfit = totalRevenue - totalCosts;
    const profitMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Calculate utilization rate
    const totalHours = project.timeEntries.reduce(
      (sum, entry) => sum + entry.hours,
      0,
    );
    const billableHours = billableEntries.reduce(
      (sum, entry) => sum + entry.hours,
      0,
    );
    const utilizationRate =
      totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
    const billableRatio =
      totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

    // Calculate profitability score (0-100)
    const profitabilityScore = this.calculateProfitabilityScore({
      profitMargin,
      utilizationRate,
      grossProfit,
      budgetAmount: project.budgetAmount,
    });

    // Update profitability record
    await this.prisma.projectProfitability.update({
      where: { projectId },
      data: {
        totalRevenue,
        billableRevenue: totalRevenue,
        laborCosts,
        expenseCosts,
        totalCosts,
        grossProfit,
        profitMargin,
        utilizationRate,
        billableRatio,
        profitabilityScore,
        lastCalculatedAt: new Date(),
      },
    });

    return {
      totalRevenue,
      laborCosts,
      expenseCosts,
      totalCosts,
      grossProfit,
      profitMargin,
      utilizationRate,
      billableRatio,
      profitabilityScore,
    };
  }

  private calculateProfitabilityScore(data: {
    profitMargin: number;
    utilizationRate: number;
    grossProfit: number;
    budgetAmount?: number | null;
  }): number {
    let score = 0;

    // Profit margin (40 points)
    if (data.profitMargin >= 30) score += 40;
    else if (data.profitMargin >= 20) score += 30;
    else if (data.profitMargin >= 10) score += 20;
    else if (data.profitMargin >= 0) score += 10;

    // Utilization rate (30 points)
    if (data.utilizationRate >= 80) score += 30;
    else if (data.utilizationRate >= 70) score += 25;
    else if (data.utilizationRate >= 60) score += 20;
    else if (data.utilizationRate >= 50) score += 15;

    // Gross profit (20 points)
    if (data.grossProfit > 0) score += 20;
    else if (data.grossProfit > -1000) score += 10;

    // Budget adherence (10 points)
    if (data.budgetAmount && data.grossProfit > 0) {
      const budgetUtilization = (data.grossProfit / data.budgetAmount) * 100;
      if (budgetUtilization <= 100) score += 10;
      else if (budgetUtilization <= 110) score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  async getProfitabilityHeatmap(workspaceId: string) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      include: {
        profitability: true,
      },
    });

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      profitabilityScore: project.profitability?.profitabilityScore || 0,
      profitMargin: project.profitability?.profitMargin || 0,
      grossProfit: project.profitability?.grossProfit || 0,
      status: project.status,
    }));
  }

  async getClientProfitabilityScoring(workspaceId: string) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      include: {
        profitability: true,
      },
    });

    // Group by client
    const clientMap = new Map<
      string,
      {
        projectCount: number;
        totalRevenue: number;
        totalCosts: number;
        totalProfit: number;
        avgProfitMargin: number;
        avgScore: number;
      }
    >();

    for (const project of projects) {
      const clientName = project.clientName;
      const prof = project.profitability;

      if (!prof) continue;

      const existing = clientMap.get(clientName) || {
        projectCount: 0,
        totalRevenue: 0,
        totalCosts: 0,
        totalProfit: 0,
        avgProfitMargin: 0,
        avgScore: 0,
      };

      existing.projectCount++;
      existing.totalRevenue += prof.totalRevenue;
      existing.totalCosts += prof.totalCosts;
      existing.totalProfit += prof.grossProfit;

      clientMap.set(clientName, existing);
    }

    // Calculate averages
    const clientScores = Array.from(clientMap.entries()).map(
      ([clientName, data]) => {
        const avgProfitMargin =
          data.totalRevenue > 0
            ? (data.totalProfit / data.totalRevenue) * 100
            : 0;

        // Calculate client score based on total profitability
        let clientScore = 0;
        if (avgProfitMargin >= 30) clientScore = 100;
        else if (avgProfitMargin >= 20) clientScore = 80;
        else if (avgProfitMargin >= 10) clientScore = 60;
        else if (avgProfitMargin >= 0) clientScore = 40;
        else clientScore = 20;

        return {
          clientName,
          projectCount: data.projectCount,
          totalRevenue: data.totalRevenue,
          totalCosts: data.totalCosts,
          totalProfit: data.totalProfit,
          avgProfitMargin,
          clientScore,
        };
      },
    );

    return clientScores.sort((a, b) => b.clientScore - a.clientScore);
  }

  async getResourceUtilizationMetrics(workspaceId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
      include: {
        timeEntries: true,
        profitability: true,
      },
    });

    // Group by user
    const userMetrics = new Map<
      string,
      {
        totalHours: number;
        billableHours: number;
        projectCount: number;
      }
    >();

    for (const project of projects) {
      for (const entry of project.timeEntries) {
        const existing = userMetrics.get(entry.userId) || {
          totalHours: 0,
          billableHours: 0,
          projectCount: 0,
        };

        existing.totalHours += entry.hours;
        if (entry.billable) {
          existing.billableHours += entry.hours;
        }

        userMetrics.set(entry.userId, existing);
      }
    }

    return Array.from(userMetrics.entries()).map(([userId, metrics]) => ({
      userId,
      totalHours: metrics.totalHours,
      billableHours: metrics.billableHours,
      utilizationRate:
        metrics.totalHours > 0
          ? (metrics.billableHours / metrics.totalHours) * 100
          : 0,
      efficiency:
        metrics.billableHours > 0
          ? Math.min(100, (metrics.billableHours / 160) * 100)
          : 0, // 160 hours = 4 weeks
    }));
  }

  async getProfitabilitySummary(workspaceId: string, period?: string) {
    let dateFilter = {};

    if (period === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      dateFilter = { gte: startOfMonth };
    } else if (period === 'quarter') {
      const startOfQuarter = new Date();
      startOfQuarter.setMonth(Math.floor(startOfQuarter.getMonth() / 3) * 3);
      startOfQuarter.setDate(1);
      startOfQuarter.setHours(0, 0, 0, 0);
      dateFilter = { gte: startOfQuarter };
    }

    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId,
        ...(period && {
          createdAt: dateFilter,
        }),
      },
      include: {
        profitability: true,
      },
    });

    const totalRevenue = projects.reduce(
      (sum, p) => sum + (p.profitability?.totalRevenue || 0),
      0,
    );
    const totalCosts = projects.reduce(
      (sum, p) => sum + (p.profitability?.totalCosts || 0),
      0,
    );
    const totalProfit = projects.reduce(
      (sum, p) => sum + (p.profitability?.grossProfit || 0),
      0,
    );

    const avgProfitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const profitableProjects = projects.filter(
      (p) => (p.profitability?.grossProfit || 0) > 0,
    ).length;
    const unprofitableProjects = projects.length - profitableProjects;

    return {
      totalProjects: projects.length,
      profitableProjects,
      unprofitableProjects,
      totalRevenue,
      totalCosts,
      totalProfit,
      avgProfitMargin,
      period: period || 'all-time',
    };
  }
}
