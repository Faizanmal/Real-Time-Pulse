// Export all animated components for easy import
export { AnimatedButton, PulseButton } from "./animated-button";
export { AnimatedCard, AnimatedCardHeader, AnimatedCardTitle, AnimatedCardDescription, AnimatedCardContent, AnimatedCardFooter } from "./animated-card";
export { AnimatedInput, SearchInput } from "./animated-input";
export { AnimatedBadge, StatusBadge, CountBadge } from "./animated-badge";
export { AnimatedTabs } from "./animated-tabs";
export { AnimatedModal, AnimatedModalFooter } from "./animated-modal";
export { AnimatedChart } from "./animated-chart";
export { StatsCard, StatsGrid } from "./stats-card";
export { LoadingSkeleton, CardSkeleton, TableSkeleton, DashboardSkeleton } from "./loading-skeleton";
export { PageTransition, FadeTransition, ScaleTransition } from "./page-transition";
export { FloatingActionButton } from "./floating-action-button";
export { NotificationProvider, notify, useWebSocketNotifications } from "./notification-provider";
export { ErrorBoundary } from "./error-boundary";

// New Interactive Components
export {
    ConfettiCanvas,
    AchievementToast,
    CelebrationProvider,
    useCelebration,
    celebrations,
    MiniCelebration
} from "./confetti-celebration";

export {
    LivePulse,
    DataUpdateFlash,
    AnimatedCounter,
    ConnectionStatus,
    LastUpdated,
    DataSyncStatus,
    ActivityFeed,
    Heartbeat,
    TypingIndicator
} from "./real-time-pulse-animations";

export {
    InteractiveNotificationCard,
    InteractiveNotificationList,
    type InteractiveNotification,
    type NotificationAction,
    type NotificationType
} from "./interactive-notifications";

export {
    InteractiveChart,
    type ChartDataPoint,
    type DrillDownLevel
} from "./interactive-chart";

// Phase 2: Live Collaboration
export {
    LiveCursor,
    LiveCursorsContainer,
    PresenceIndicator,
    CollaboratorPanel,
    useCursorBroadcast,
    ActivityRing,
    TypingAwareness,
    type Collaborator,
    type CursorPosition
} from "./live-collaboration";

// Phase 2: Natural Language Search
export {
    NaturalLanguageInput,
    QueryResults,
    AIQueryInterface,
    QuickInsightsBar,
    type QuerySuggestion,
    type QueryResult,
    type QuickInsight
} from "./natural-language-search";

// Phase 2: Advanced Gamification
export {
    XPProgressBar,
    BadgeDisplay,
    BadgeCollection,
    StreakDisplay,
    Leaderboard,
    AchievementProgress,
    GamificationProvider,
    useGamification,
    LEVELS,
    RARITY_COLORS,
    type Badge,
    type Achievement,
    type Level,
    type Streak,
    type LeaderboardEntry,
    type GamificationState,
    type BadgeRarity
} from "./gamification";

// Phase 3: Time Travel & Predictions
export {
    TimeTravelSlider,
    DateRangeQuickSelector,
    ComparisonSelector,
    PredictiveInsights,
    type TimePoint,
    type Prediction,
    type DateRangeOption,
    type ComparisonPeriod
} from "./time-travel";

// Phase 3: Context Menus & Gestures
export {
    ContextMenu,
    ContextMenuTrigger,
    buildQuickActions,
    GestureHandler,
    SwipeableCard,
    ZoomPanContainer,
    type ContextMenuItem,
    type ContextMenuPosition,
    type GestureConfig,
    type QuickActionsConfig
} from "./context-menu-gestures";

// Phase 3: Smart Onboarding
export {
    SpotlightHighlight,
    TooltipGuide,
    OnboardingProvider,
    useOnboarding,
    TourLauncher,
    FeatureAnnouncement,
    type OnboardingStep,
    type OnboardingTour
} from "./smart-onboarding";

// Phase 3: Data Annotations
export {
    AnnotationMarker,
    AnnotationTooltip,
    AnnotationLayer,
    type Annotation,
    type AnnotationReply,
    type AnnotationType
} from "./data-annotations";
