/**
 * API Client for Real-Time Pulse Enterprise Features
 * Centralized service for all backend API communications
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Data Health Monitoring
  async getDataSourceHealth(workspaceId: string) {
    return this.request(`/data-health/sources/${workspaceId}`);
  }

  async getHealthChecks(sourceId: string, limit = 50) {
    return this.request(`/data-health/checks/${sourceId}?limit=${limit}`);
  }

  async triggerHealthCheck(sourceId: string) {
    return this.request(`/data-health/check/${sourceId}`, {
      method: 'POST',
    });
  }

  async createDataSource(workspaceId: string, data: any) {
    return this.request(`/data-health/sources`, {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId }),
    });
  }

  // Data Validation
  async getValidationRules(workspaceId: string) {
    return this.request(`/data-validation/rules/${workspaceId}`);
  }

  async createValidationRule(data: any) {
    return this.request(`/data-validation/rules`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateValidationRule(ruleId: string, data: any) {
    return this.request(`/data-validation/rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteValidationRule(ruleId: string) {
    return this.request(`/data-validation/rules/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async getViolations(workspaceId: string, filters?: any) {
    const query = new URLSearchParams(filters).toString();
    return this.request(`/data-validation/violations/${workspaceId}?${query}`);
  }

  async resolveViolation(violationId: string, resolution: string) {
    return this.request(`/data-validation/violations/${violationId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    });
  }

  async getViolationStatistics(workspaceId: string) {
    return this.request(`/data-validation/statistics/${workspaceId}`);
  }

  // Profitability Analytics
  async getProjects(workspaceId: string) {
    return this.request(`/profitability/projects/${workspaceId}`);
  }

  async createProject(data: any) {
    return this.request(`/profitability/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProjectProfitability(projectId: string) {
    return this.request(`/profitability/calculate/${projectId}`);
  }

  async getProfitabilityHeatmap(workspaceId: string, period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request(`/profitability/heatmap/${workspaceId}${query}`);
  }

  async getClientProfitabilityScoring(workspaceId: string) {
    return this.request(`/profitability/client-scoring/${workspaceId}`);
  }

  async addTimeEntry(projectId: string, data: any) {
    return this.request(`/profitability/time-entries`, {
      method: 'POST',
      body: JSON.stringify({ ...data, projectId }),
    });
  }

  async addExpense(projectId: string, data: any) {
    return this.request(`/profitability/expenses`, {
      method: 'POST',
      body: JSON.stringify({ ...data, projectId }),
    });
  }

  // Client Reporting
  async getClientReports(workspaceId: string) {
    return this.request(`/client-report/reports/${workspaceId}`);
  }

  async createClientReport(data: any) {
    return this.request(`/client-report/reports`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateReport(reportId: string) {
    return this.request(`/client-report/generate/${reportId}`, {
      method: 'POST',
    });
  }

  async getReportContent(reportId: string) {
    return this.request(`/client-report/content/${reportId}`);
  }

  async scheduleReport(reportId: string, schedule: string) {
    return this.request(`/client-report/schedule/${reportId}`, {
      method: 'POST',
      body: JSON.stringify({ schedule }),
    });
  }

  // GDPR Compliance
  async getConsents(workspaceId: string) {
    return this.request(`/gdpr/consents/${workspaceId}`);
  }

  async recordConsent(data: any) {
    return this.request(`/gdpr/consent`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDataRequests(workspaceId: string) {
    return this.request(`/gdpr/data-requests/${workspaceId}`);
  }

  async createDataRequest(data: any) {
    return this.request(`/gdpr/data-request`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async processDataRequest(requestId: string, action: 'approve' | 'reject') {
    return this.request(`/gdpr/data-request/${requestId}/${action}`, {
      method: 'POST',
    });
  }

  async getComplianceReport(workspaceId: string) {
    return this.request(`/gdpr/compliance-report/${workspaceId}`);
  }

  async getComplianceScore(workspaceId: string) {
    return this.request(`/gdpr/compliance-score/${workspaceId}`);
  }

  async exportUserData(userId: string) {
    return this.request(`/gdpr/export/${userId}`, {
      method: 'POST',
    });
  }

  async deleteUserData(userId: string) {
    return this.request(`/gdpr/delete/${userId}`, {
      method: 'DELETE',
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export types
export type { ApiResponse };
