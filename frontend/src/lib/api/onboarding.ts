import { apiClient } from './client';

export type OnboardingStage =
  | 'REGISTERED'
  | 'CONNECTED'
  | 'FIRST_VALID_SYNC'
  | 'FIRST_PUBLISH'
  | 'FIRST_CLIENT_VIEW'
  | 'FIRST_DECISION'
  | 'PAID_CONVERSION';

export interface OnboardingStatus {
  analyticsConsent: boolean;
  trackingAvailable: boolean;
  completedStages: number;
  totalStages: number;
  stages: { stage: OnboardingStage; complete: boolean; happenedAt: string | null }[];
  providerConnection: null | {
    provider: string;
    state: string;
    failureCode: string | null;
    nextAction: string | null;
    lastValidDataAt: string | null;
    isDemo: boolean;
  };
  demoClientPath: string | null;
  publishedAt: string | null;
}

export const onboardingApi = {
  getStatus: () => apiClient.get<OnboardingStatus>('/onboarding/status'),
  setAnalyticsConsent: (consented: boolean) =>
    apiClient.patch<{ analyticsConsent: boolean; trackingAvailable: boolean; message: string }>(
      '/onboarding/analytics-consent',
      { consented },
    ),
};
