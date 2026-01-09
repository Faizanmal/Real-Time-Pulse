// API Index - Export all API modules
export { alertsApi } from './alerts';
export type { Alert, AlertHistory, CreateAlertDto, UpdateAlertDto } from './alerts';

export { analyticsApi } from './analytics';
export type { DashboardOverview, PortalAnalytics, UsageMetric, PerformanceMetrics, ActivityItem, TrendingData } from './analytics';

export { annotationsApi } from './annotations';
export type { Annotation, AnnotationType, CreateAnnotationDto, UpdateAnnotationDto } from './annotations';

export { auditApi } from './audit';
export type { AuditLog, AuditLogFilters, AuditLogResponse } from './audit';

export { backupApi } from './backup';
export type { Backup } from './backup';

export { billingApi } from './billing';
export type { BillingPlan, Subscription, Invoice, UsageLimits } from './billing';

export { blockchainApi } from './blockchain';
export type { BlockchainAuditEntry, Block, BlockchainVerification, ComplianceReport, MerkleProof } from './blockchain';

export { apiClient } from './client';

export { commentsApi } from './comments';
export type { Comment, CreateCommentDto, UpdateCommentDto } from './comments';

export { exportsApi } from './exports';
export type { ExportFormat, ExportOptions } from './exports';

export { gdprApi } from './gdpr';
export type { GdprConsent, GdprDataRequest, GdprComplianceReport, GdprDashboard } from './gdpr';

export { iotApi } from './iot';
export type { IoTDevice, IoTMetric, IoTAlert, EdgeNode, EdgeRule } from './iot';

export { mlApi } from './ml';
export type { MLModel, TrainingJob, PredictionResult, CausalGraph, FeatureAnalysis } from './ml';

export { scheduledReportsApi } from './scheduled-reports';
export type { ScheduledReport, ReportRun, CreateScheduledReportDto, UpdateScheduledReportDto } from './scheduled-reports';

export { scriptingApi } from './scripting';
export type { Script, ScriptExecution, ScriptVersion, LibraryFunction, ValidationResult } from './scripting';

export { voiceApi, voiceControlApi } from './voice';
export type { VoiceTranscription, VoiceCommandResult, VoiceAnnotation, TTSVoice, SupportedLanguage, VoiceCommand } from './voice';

export { webhooksApi, WEBHOOK_EVENTS } from './webhooks';
export type { Webhook, WebhookDelivery, CreateWebhookDto, UpdateWebhookDto, WebhookEvent } from './webhooks';

export { workflowsApi } from './workflows';
export type { Workflow, WorkflowTrigger, WorkflowAction, WorkflowCondition, WorkflowNode, WorkflowEdge, WorkflowExecution, CreateWorkflowDto } from './workflows';

export { workspacesApi } from './workspaces';
export type { Workspace, WorkspaceSettings, WorkspaceMember, WorkspaceInvite, WorkspaceStats, UpdateWorkspaceDto, InviteMemberDto } from './workspaces';

export { notificationsApi } from './notifications';
export type { Notification, NotificationChannel, NotificationPreferences, NotificationStats, CreateNotificationDto } from './notifications';

