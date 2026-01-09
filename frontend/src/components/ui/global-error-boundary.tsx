'use client';

/**
 * ============================================================================
 * PRODUCTION-READY GLOBAL ERROR BOUNDARY
 * ============================================================================
 * Comprehensive error handling with recovery options, error reporting,
 * and graceful degradation for production environments.
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Bug, 
  ChevronDown,
  Copy,
  CheckCircle,
  MessageSquare,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Button } from './button';

// Error severity levels
type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: Date;
  severity: ErrorSeverity;
  errorId: string;
  userAgent: string;
  url: string;
  userId?: string;
  workspaceId?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorDetails: ErrorDetails | null;
  isExpanded: boolean;
  copied: boolean;
  isOnline: boolean;
  retryCount: number;
  isRecovering: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  enableRecovery?: boolean;
  maxRetries?: number;
}

// Generate unique error ID
function generateErrorId(): string {
  return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}

// Determine error severity
function determineErrorSeverity(error: Error): ErrorSeverity {
  const message = error.message.toLowerCase();
  
  if (message.includes('chunk') || message.includes('loading')) {
    return 'low'; // Likely a loading/network issue
  }
  if (message.includes('undefined') || message.includes('null')) {
    return 'medium';
  }
  if (message.includes('unauthorized') || message.includes('forbidden')) {
    return 'high';
  }
  if (message.includes('security') || message.includes('injection')) {
    return 'critical';
  }
  return 'medium';
}

// Error reporting service (can be connected to Sentry, LogRocket, etc.)
async function reportError(errorDetails: ErrorDetails): Promise<void> {
  try {
    // In production, this would send to your error tracking service
    const errorPayload = {
      ...errorDetails,
      timestamp: errorDetails.timestamp.toISOString(),
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Reported');
      console.error('Error ID:', errorDetails.errorId);
      console.error('Message:', errorDetails.message);
      console.error('Severity:', errorDetails.severity);
      console.error('Stack:', errorDetails.stack);
      console.groupEnd();
    }

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorPayload),
      }).catch(() => {
        // Silently fail if error reporting fails
      });
    }
  } catch {
    // Don't throw if error reporting fails
  }
}

export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorDetails: null,
      isExpanded: false,
      copied: false,
      isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
      retryCount: 0,
      isRecovering: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      timestamp: new Date(),
      severity: determineErrorSeverity(error),
      errorId: generateErrorId(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    // Try to get user context
    if (typeof window !== 'undefined') {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          errorDetails.userId = parsed?.state?.user?.id;
          errorDetails.workspaceId = parsed?.state?.user?.workspaceId;
        }
      } catch {
        // Ignore auth storage errors
      }
    }

    this.setState({ errorInfo, errorDetails });

    // Report error
    reportError(errorDetails);

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  componentDidMount(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  componentWillUnmount(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleOnline = (): void => {
    this.setState({ isOnline: true });
  };

  handleOffline = (): void => {
    this.setState({ isOnline: false });
  };

  handleRetry = async (): Promise<void> => {
    const { maxRetries = 3, enableRecovery = true } = this.props;
    const { retryCount } = this.state;

    if (!enableRecovery || retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRecovering: true });

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);

    await new Promise(resolve => {
      this.retryTimeoutId = setTimeout(resolve, delay);
    });

    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
      isRecovering: false,
    }));
  };

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorDetails: null,
      isExpanded: false,
      retryCount: 0,
      isRecovering: false,
    });
  };

  handleGoHome = (): void => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  handleCopyError = async (): Promise<void> => {
    const { errorDetails } = this.state;
    if (!errorDetails) return;

    const errorText = `
Error ID: ${errorDetails.errorId}
Message: ${errorDetails.message}
Severity: ${errorDetails.severity}
Time: ${errorDetails.timestamp.toISOString()}
URL: ${errorDetails.url}
User Agent: ${errorDetails.userAgent}

Stack Trace:
${errorDetails.stack || 'Not available'}

Component Stack:
${errorDetails.componentStack || 'Not available'}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback for older browsers
      console.log(errorText);
    }
  };

  toggleExpand = (): void => {
    this.setState(prev => ({ isExpanded: !prev.isExpanded }));
  };

  render(): ReactNode {
    const { children, fallback, showDetails = true, maxRetries = 3, enableRecovery = true } = this.props;
    const { hasError, errorDetails, isExpanded, copied, isOnline, retryCount, isRecovering } = this.state;

    if (!hasError) {
      return children;
    }

    if (fallback) {
      return fallback;
    }

    const canRetry = enableRecovery && retryCount < maxRetries;
    const severityColors = {
      low: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
      medium: 'bg-orange-500/10 border-orange-500/20 text-orange-600',
      high: 'bg-red-500/10 border-red-500/20 text-red-600',
      critical: 'bg-red-600/20 border-red-600/30 text-red-700',
    };

    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          {/* Connection Status */}
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3"
            >
              <WifiOff className="h-5 w-5 text-yellow-500" />
              <span className="text-yellow-400 text-sm">You&apos;re offline. Some features may not work.</span>
            </motion.div>
          )}

          {/* Main Error Card */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex items-start gap-4">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                  className="p-3 bg-red-500/10 rounded-xl"
                >
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </motion.div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white mb-1">
                    Something went wrong
                  </h2>
                  <p className="text-gray-400 text-sm">
                    We&apos;ve logged this error and our team will look into it.
                  </p>
                </div>
              </div>

              {/* Error ID Badge */}
              {errorDetails && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 bg-slate-800 rounded-full text-xs font-mono text-gray-400">
                    {errorDetails.errorId}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${severityColors[errorDetails.severity]}`}>
                    {errorDetails.severity.toUpperCase()}
                  </span>
                  {isOnline ? (
                    <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400 flex items-center gap-1">
                      <Wifi className="h-3 w-3" /> Online
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs text-yellow-400 flex items-center gap-1">
                      <WifiOff className="h-3 w-3" /> Offline
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Error Details (Expandable) */}
            {showDetails && errorDetails && (
              <div className="border-b border-slate-700/50">
                <button
                  onClick={this.toggleExpand}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Technical Details
                  </span>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Error Message</p>
                          <p className="text-sm text-gray-300 font-mono break-all">
                            {errorDetails.message}
                          </p>
                        </div>
                        
                        {errorDetails.stack && (
                          <div className="p-3 bg-slate-800/50 rounded-lg max-h-40 overflow-auto">
                            <p className="text-xs text-gray-500 mb-1">Stack Trace</p>
                            <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
                              {errorDetails.stack}
                            </pre>
                          </div>
                        )}

                        <button
                          onClick={this.handleCopyError}
                          className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          {copied ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy error details
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Actions */}
            <div className="p-6 space-y-3">
              {canRetry && (
                <Button
                  onClick={this.handleRetry}
                  disabled={isRecovering}
                  className="w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
                >
                  {isRecovering ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                      </motion.div>
                      Recovering...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again {retryCount > 0 && `(${maxRetries - retryCount} attempts left)`}
                    </>
                  )}
                </Button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="border-slate-600 text-gray-300 hover:bg-slate-800"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="border-slate-600 text-gray-300 hover:bg-slate-800"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
              </div>

              {/* Support Link */}
              <div className="pt-3 text-center">
                <a
                  href="mailto:support@realtimepulse.io"
                  className="text-sm text-gray-500 hover:text-purple-400 transition-colors inline-flex items-center gap-1"
                >
                  <MessageSquare className="h-4 w-4" />
                  Contact Support
                </a>
              </div>
            </div>
          </div>

          {/* Recovery Progress */}
          {retryCount > 0 && retryCount < maxRetries && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-center text-sm text-gray-500"
            >
              Recovery attempt {retryCount} of {maxRetries}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }
}

// Async Error Boundary for Suspense boundaries
interface AsyncErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AsyncErrorBoundary({ children, fallback }: AsyncErrorBoundaryProps) {
  return (
    <GlobalErrorBoundary fallback={fallback}>
      {children}
    </GlobalErrorBoundary>
  );
}

// Hook for programmatic error handling
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, context?: string) => {
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      severity: determineErrorSeverity(error),
      errorId: generateErrorId(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    if (context) {
      errorDetails.message = `[${context}] ${errorDetails.message}`;
    }

    reportError(errorDetails);
    console.error('Handled error:', errorDetails);
  }, []);

  return { handleError };
}

export default GlobalErrorBoundary;
