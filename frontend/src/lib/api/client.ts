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
    // Try to get token from localStorage on init
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  setAuthToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    responseType: 'json' | 'blob' = 'json'
  ): Promise<ApiResponse<T>> {
    // Refresh token from localStorage in case it was updated
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }

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

      const data = responseType === 'blob' ? await response.blob() : await response.json();
      return { data };
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Generic HTTP methods for new API files
  async get<T>(endpoint: string, config?: { params?: Record<string, unknown>; responseType?: 'json' | 'blob' }): Promise<T> {
    let url = endpoint;
    if (config?.params) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(config.params)) {
        params.append(key, String(value));
      }
      url += `?${params.toString()}`;
    }
    const result = await this.request<T>(url, {}, config?.responseType || 'json');
    if (result.error) throw new Error(result.error);
    return result.data!;
  }

  async post<T>(endpoint: string, data?: object, config?: { headers?: Record<string, string>; responseType?: 'json' | 'blob' }): Promise<T> {
    const options: RequestInit = {
      method: 'POST',
    };
    if (data) {
      if (data instanceof FormData) {
        options.body = data;
      } else {
        options.body = JSON.stringify(data);
      }
    }
    if (config?.headers) {
      options.headers = { ...options.headers, ...config.headers };
    }
    const result = await this.request<T>(endpoint, options, config?.responseType || 'json');
    if (result.error) throw new Error(result.error);
    return result.data!;
  }

  async put<T>(endpoint: string, data: object, config?: { headers?: Record<string, string>; responseType?: 'json' | 'blob' }): Promise<T> {
    const options: RequestInit = {
      method: 'PUT',
      body: JSON.stringify(data),
    };
    if (config?.headers) {
      options.headers = { ...options.headers, ...config.headers };
    }
    const result = await this.request<T>(endpoint, options, config?.responseType || 'json');
    if (result.error) throw new Error(result.error);
    return result.data!;
  }

  async patch<T>(endpoint: string, data: object, config?: { headers?: Record<string, string>; responseType?: 'json' | 'blob' }): Promise<T> {
    const options: RequestInit = {
      method: 'PATCH',
      body: JSON.stringify(data),
    };
    if (config?.headers) {
      options.headers = { ...options.headers, ...config.headers };
    }
    const result = await this.request<T>(endpoint, options, config?.responseType || 'json');
    if (result.error) throw new Error(result.error);
    return result.data!;
  }

  async delete<T = void>(endpoint: string, config?: { headers?: Record<string, string>; responseType?: 'json' | 'blob' }): Promise<T> {
    const options: RequestInit = {
      method: 'DELETE',
    };
    if (config?.headers) {
      options.headers = { ...options.headers, ...config.headers };
    }
    const result = await this.request<T>(endpoint, options, config?.responseType || 'json');
    if (result.error) throw new Error(result.error);
    return result.data as T;
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    // Refresh token from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
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

  async createDataSource(workspaceId: string, data: Record<string, unknown>) {
    return this.request(`/data-health/sources`, {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId }),
    });
  }

  // Data Validation
  async getValidationRules(workspaceId: string) {
    return this.request(`/data-validation/rules/${workspaceId}`);
  }

  async createValidationRule(data: Record<string, unknown>) {
    return this.request(`/data-validation/rules`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateValidationRule(ruleId: string, data: Record<string, unknown>) {
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

  async getViolations(workspaceId: string, filters?: Record<string, unknown>) {
    const query = new URLSearchParams(filters as Record<string, string>).toString();
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

  async createProject(data: Record<string, unknown>) {
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

  async addTimeEntry(projectId: string, data: Record<string, unknown>) {
    return this.request(`/profitability/time-entries`, {
      method: 'POST',
      body: JSON.stringify({ ...data, projectId }),
    });
  }

  async addExpense(projectId: string, data: Record<string, unknown>) {
    return this.request(`/profitability/expenses`, {
      method: 'POST',
      body: JSON.stringify({ ...data, projectId }),
    });
  }

  // Client Reporting
  async getClientReports(workspaceId: string) {
    return this.request(`/client-report/reports/${workspaceId}`);
  }

  async createClientReport(data: Record<string, unknown>) {
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

  async recordConsent(data: Record<string, unknown>) {
    return this.request(`/gdpr/consent`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDataRequests(workspaceId: string) {
    return this.request(`/gdpr/data-requests/${workspaceId}`);
  }

  async createDataRequest(data: Record<string, unknown>) {
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

