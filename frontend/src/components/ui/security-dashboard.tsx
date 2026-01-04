'use client';

/**
 * ============================================================================
 * SECURITY DASHBOARD & SESSION MANAGEMENT
 * ============================================================================
 * Enterprise security features including active sessions, security score,
 * two-factor authentication, security logs, and vulnerability alerts.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  Unlock,
  Key,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  Download,
  ChevronRight,
  ChevronDown,
  Info,
  Fingerprint,
  MapPin,
  Wifi,
  WifiOff,
  UserX,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Check,
  X,
  Copy,
  QrCode,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

// ==================== TYPES ====================

interface Session {
  id: string;
  device: {
    type: 'desktop' | 'mobile' | 'tablet';
    name: string;
    os: string;
    browser: string;
  };
  location: {
    city: string;
    country: string;
    ip: string;
  };
  createdAt: Date;
  lastActive: Date;
  isCurrent: boolean;
  isSuspicious: boolean;
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'password_change' | 'mfa_enable' | 'mfa_disable' | 'suspicious_activity' | 'api_key_created' | 'api_key_revoked';
  description: string;
  timestamp: Date;
  ip: string;
  location: string;
  severity: 'info' | 'warning' | 'critical';
  resolved?: boolean;
}

interface SecurityScore {
  overall: number;
  factors: {
    name: string;
    score: number;
    maxScore: number;
    status: 'good' | 'warning' | 'critical';
    recommendation?: string;
  }[];
}

interface TwoFactorSettings {
  enabled: boolean;
  method: 'app' | 'sms' | 'email';
  backupCodesRemaining: number;
  lastVerified?: Date;
}

interface SecurityContextValue {
  sessions: Session[];
  events: SecurityEvent[];
  securityScore: SecurityScore;
  twoFactorSettings: TwoFactorSettings;
  isLoading: boolean;
  terminateSession: (sessionId: string) => Promise<void>;
  terminateAllOtherSessions: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  enableTwoFactor: (method: 'app' | 'sms' | 'email') => Promise<string>;
  disableTwoFactor: () => Promise<void>;
  generateBackupCodes: () => Promise<string[]>;
}

// ==================== CONTEXT ====================

const SecurityContext = createContext<SecurityContextValue | null>(null);

// Sample data
const SAMPLE_SESSIONS: Session[] = [
  {
    id: '1',
    device: { type: 'desktop', name: 'MacBook Pro', os: 'macOS 14.2', browser: 'Chrome 120' },
    location: { city: 'San Francisco', country: 'US', ip: '192.168.1.1' },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    lastActive: new Date(),
    isCurrent: true,
    isSuspicious: false,
  },
  {
    id: '2',
    device: { type: 'mobile', name: 'iPhone 15', os: 'iOS 17', browser: 'Safari' },
    location: { city: 'New York', country: 'US', ip: '10.0.0.1' },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    lastActive: new Date(Date.now() - 1000 * 60 * 30),
    isCurrent: false,
    isSuspicious: false,
  },
  {
    id: '3',
    device: { type: 'desktop', name: 'Windows PC', os: 'Windows 11', browser: 'Firefox 121' },
    location: { city: 'Unknown', country: 'RU', ip: '185.234.x.x' },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 6),
    isCurrent: false,
    isSuspicious: true,
  },
];

const SAMPLE_EVENTS: SecurityEvent[] = [
  {
    id: '1',
    type: 'login',
    description: 'Successful login from Chrome on macOS',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    ip: '192.168.1.1',
    location: 'San Francisco, US',
    severity: 'info',
  },
  {
    id: '2',
    type: 'suspicious_activity',
    description: 'Login attempt from unusual location',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
    ip: '185.234.x.x',
    location: 'Moscow, RU',
    severity: 'critical',
    resolved: false,
  },
  {
    id: '3',
    type: 'password_change',
    description: 'Password was changed',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    ip: '192.168.1.1',
    location: 'San Francisco, US',
    severity: 'info',
  },
  {
    id: '4',
    type: 'mfa_enable',
    description: 'Two-factor authentication enabled',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    ip: '192.168.1.1',
    location: 'San Francisco, US',
    severity: 'info',
  },
];

const SAMPLE_SECURITY_SCORE: SecurityScore = {
  overall: 78,
  factors: [
    { name: 'Password Strength', score: 90, maxScore: 100, status: 'good' },
    { name: 'Two-Factor Auth', score: 100, maxScore: 100, status: 'good' },
    { name: 'Session Security', score: 60, maxScore: 100, status: 'warning', recommendation: 'You have a suspicious session active. Review and terminate if unauthorized.' },
    { name: 'API Key Usage', score: 80, maxScore: 100, status: 'good' },
    { name: 'Login History', score: 60, maxScore: 100, status: 'warning', recommendation: 'Unusual login detected from new location.' },
  ],
};

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [securityScore, setSecurityScore] = useState<SecurityScore>(SAMPLE_SECURITY_SCORE);
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorSettings, setTwoFactorSettings] = useState<TwoFactorSettings>({
    enabled: true,
    method: 'app',
    backupCodesRemaining: 8,
    lastVerified: new Date(),
  });

  useEffect(() => {
    // Set initial lastVerified date after mount or keep it null until loaded
    setTwoFactorSettings(prev => ({ ...prev, lastVerified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) }));
  }, []);

  useEffect(() => {
    // Simulate loading
    setSessions(SAMPLE_SESSIONS);
    setEvents(SAMPLE_EVENTS);
  }, []);

  const terminateSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 500));
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setEvents(prev => [{
      id: `event-${Date.now()}`,
      type: 'logout',
      description: 'Session terminated by user',
      timestamp: new Date(),
      ip: '192.168.1.1',
      location: 'San Francisco, US',
      severity: 'info',
    }, ...prev]);
    setIsLoading(false);
  }, []);

  const terminateAllOtherSessions = useCallback(async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setSessions(prev => prev.filter(s => s.isCurrent));
    setEvents(prev => [{
      id: `event-${Date.now()}`,
      type: 'logout',
      description: 'All other sessions terminated',
      timestamp: new Date(),
      ip: '192.168.1.1',
      location: 'San Francisco, US',
      severity: 'info',
    }, ...prev]);
    setIsLoading(false);
  }, []);

  const refreshSessions = useCallback(async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 500));
    setSessions([...SAMPLE_SESSIONS]);
    setIsLoading(false);
  }, []);

  const enableTwoFactor = useCallback(async (method: 'app' | 'sms' | 'email'): Promise<string> => {
    await new Promise(r => setTimeout(r, 1000));
    setTwoFactorSettings(prev => ({
      ...prev,
      enabled: true,
      method,
      lastVerified: new Date(),
    }));
    return 'otpauth://totp/RealTimePulse:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=RealTimePulse';
  }, []);

  const disableTwoFactor = useCallback(async () => {
    await new Promise(r => setTimeout(r, 500));
    setTwoFactorSettings(prev => ({
      ...prev,
      enabled: false,
    }));
  }, []);

  const generateBackupCodes = useCallback(async (): Promise<string[]> => {
    await new Promise(r => setTimeout(r, 500));
    const codes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
      Math.random().toString(36).substring(2, 6).toUpperCase()
    );
    setTwoFactorSettings(prev => ({
      ...prev,
      backupCodesRemaining: 10,
    }));
    return codes;
  }, []);

  return (
    <SecurityContext.Provider
      value={{
        sessions,
        events,
        securityScore,
        twoFactorSettings,
        isLoading,
        terminateSession,
        terminateAllOtherSessions,
        refreshSessions,
        enableTwoFactor,
        disableTwoFactor,
        generateBackupCodes,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within SecurityProvider');
  }
  return context;
}

// ==================== SECURITY SCORE CARD ====================

export function SecurityScoreCard({ className }: { className?: string }) {
  const { securityScore } = useSecurity();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getGradient = (score: number) => {
    if (score >= 80) return 'from-green-400 to-emerald-500';
    if (score >= 60) return 'from-yellow-400 to-orange-500';
    return 'from-red-400 to-rose-500';
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (securityScore.overall / 100) * circumference;

  return (
    <div className={cn('bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border dark:border-slate-800', className)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Security Score</h3>
          <p className="text-sm text-gray-500">Overall account security</p>
        </div>
        <Shield className="h-5 w-5 text-gray-400" />
      </div>

      <div className="flex items-center gap-6 mb-6">
        {/* Circular Score */}
        <div className="relative w-28 h-28">
          <svg className="transform -rotate-90 w-28 h-28">
            <circle
              cx="56"
              cy="56"
              r="45"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200 dark:text-slate-700"
            />
            <motion.circle
              cx="56"
              cy="56"
              r="45"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{
                strokeDasharray: circumference,
              }}
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" className={`stop-color-current ${getScoreColor(securityScore.overall)}`} />
                <stop offset="100%" className={`stop-color-current ${getScoreColor(securityScore.overall)}`} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className={cn('text-2xl font-bold', getScoreColor(securityScore.overall))}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              {securityScore.overall}
            </motion.span>
            <span className="text-xs text-gray-400">/ 100</span>
          </div>
        </div>

        {/* Status */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            {securityScore.overall >= 80 ? (
              <ShieldCheck className="h-5 w-5 text-green-500" />
            ) : securityScore.overall >= 60 ? (
              <ShieldAlert className="h-5 w-5 text-yellow-500" />
            ) : (
              <ShieldX className="h-5 w-5 text-red-500" />
            )}
            <span className={cn('font-semibold', getScoreColor(securityScore.overall))}>
              {securityScore.overall >= 80 ? 'Secure' : securityScore.overall >= 60 ? 'Needs Attention' : 'At Risk'}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {securityScore.factors.filter(f => f.status !== 'good').length} items need attention
          </p>
        </div>
      </div>

      {/* Factors */}
      <div className="space-y-3">
        {securityScore.factors.map(factor => (
          <div key={factor.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm">{factor.name}</span>
              <span className={cn('text-sm font-medium', getScoreColor(factor.score))}>
                {factor.score}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full bg-gradient-to-r', getGradient(factor.score))}
                initial={{ width: 0 }}
                animate={{ width: `${factor.score}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            {factor.recommendation && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                {factor.recommendation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== ACTIVE SESSIONS ====================

export function ActiveSessionsCard({ className }: { className?: string }) {
  const { sessions, isLoading, terminateSession, terminateAllOtherSessions, refreshSessions } = useSecurity();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getDeviceIcon = (type: 'desktop' | 'mobile' | 'tablet') => {
    switch (type) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      default: return Monitor;
    }
  };

  const suspiciousSessions = sessions.filter(s => s.isSuspicious);

  return (
    <div className={cn('bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border dark:border-slate-800', className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Active Sessions</h3>
          <p className="text-sm text-gray-500">{sessions.length} devices connected</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshSessions}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={terminateAllOtherSessions}
              disabled={isLoading}
              className="text-red-500 border-red-200 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Sign out all
            </Button>
          )}
        </div>
      </div>

      {/* Suspicious Alert */}
      {suspiciousSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">
                Suspicious activity detected
              </p>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                {suspiciousSessions.length} session(s) from unusual location. If this wasn&apos;t you, terminate immediately.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.map(session => {
          const DeviceIcon = getDeviceIcon(session.device.type);
          const isExpanded = expandedId === session.id;

          return (
            <motion.div
              key={session.id}
              layout
              className={cn(
                'border rounded-xl overflow-hidden transition-colors',
                session.isCurrent
                  ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                  : session.isSuspicious
                    ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                    : 'dark:border-slate-700'
              )}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'p-2 rounded-lg',
                    session.isCurrent
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-600'
                      : session.isSuspicious
                        ? 'bg-red-100 dark:bg-red-900/50 text-red-600'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600'
                  )}>
                    <DeviceIcon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{session.device.name}</span>
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/50 text-green-600 rounded-full">
                          Current
                        </span>
                      )}
                      {session.isSuspicious && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/50 text-red-600 rounded-full flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Suspicious
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {session.location.city}, {session.location.country} • {session.device.browser}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {session.isCurrent ? 'Active now' : formatDistanceToNow(session.lastActive, { addSuffix: true })}
                    </p>
                    <ChevronDown className={cn(
                      'h-4 w-4 text-gray-400 transition-transform ml-auto',
                      isExpanded && 'rotate-180'
                    )} />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-2 border-t dark:border-slate-700/50">
                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-400 mb-1">Device</p>
                          <p>{session.device.os}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">IP Address</p>
                          <p className="font-mono">{session.location.ip}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">First seen</p>
                          <p>{format(session.createdAt, 'MMM d, yyyy h:mm a')}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Last active</p>
                          <p>{format(session.lastActive, 'MMM d, yyyy h:mm a')}</p>
                        </div>
                      </div>

                      {!session.isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            terminateSession(session.id);
                          }}
                          disabled={isLoading}
                          className="w-full text-red-500 border-red-200 hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Terminate Session
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== TWO FACTOR AUTH CARD ====================

export function TwoFactorCard({ className }: { className?: string }) {
  const { twoFactorSettings, enableTwoFactor, disableTwoFactor, generateBackupCodes } = useSecurity();
  const [showSetup, setShowSetup] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleEnableTwoFactor = async () => {
    const otpUri = await enableTwoFactor('app');
    setQrCode(otpUri);
    setShowSetup(true);
  };

  const handleGenerateBackupCodes = async () => {
    const codes = await generateBackupCodes();
    setBackupCodes(codes);
    setShowBackupCodes(true);
  };

  return (
    <div className={cn('bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border dark:border-slate-800', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            twoFactorSettings.enabled
              ? 'bg-green-100 dark:bg-green-900/50 text-green-600'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600'
          )}>
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500">
              {twoFactorSettings.enabled
                ? `Enabled via ${twoFactorSettings.method === 'app' ? 'Authenticator App' : twoFactorSettings.method.toUpperCase()}`
                : 'Add an extra layer of security'
              }
            </p>
          </div>
        </div>
        <div>
          {twoFactorSettings.enabled ? (
            <CheckCircle className="h-6 w-6 text-green-500" />
          ) : (
            <AlertCircle className="h-6 w-6 text-yellow-500" />
          )}
        </div>
      </div>

      {twoFactorSettings.enabled ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Backup codes remaining</span>
            </div>
            <span className={cn(
              'font-medium',
              twoFactorSettings.backupCodesRemaining < 3 ? 'text-red-500' : 'text-green-500'
            )}>
              {twoFactorSettings.backupCodesRemaining} / 10
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleGenerateBackupCodes}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              New Codes
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 border-red-200 hover:bg-red-50"
              onClick={disableTwoFactor}
            >
              Disable 2FA
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
              <div>
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  Your account is not fully protected
                </p>
                <p className="text-sm text-yellow-600/80 dark:text-yellow-400/80 mt-1">
                  Enable two-factor authentication to add an extra layer of security to your account.
                </p>
              </div>
            </div>
          </div>

          <Button onClick={handleEnableTwoFactor} className="w-full">
            <Fingerprint className="h-4 w-4 mr-2" />
            Enable Two-Factor Auth
          </Button>
        </div>
      )}

      {/* Setup Modal */}
      <AnimatePresence>
        {showSetup && qrCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSetup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold">2FA Enabled!</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Scan the QR code with your authenticator app
                </p>
              </div>

              <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-8 flex items-center justify-center mb-4">
                <QrCode className="h-32 w-32 text-gray-400" />
              </div>

              <Button onClick={() => setShowSetup(false)} className="w-full">
                Done
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backup Codes Modal */}
      <AnimatePresence>
        {showBackupCodes && backupCodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBackupCodes(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">Backup Codes</h3>
              <p className="text-sm text-gray-500 mb-4">
                Save these codes in a secure place. Each code can only be used once.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {backupCodes.map((code, i) => (
                  <div key={i} className="font-mono text-sm bg-gray-100 dark:bg-slate-800 px-3 py-2 rounded">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodes.join('\n'));
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'backup-codes.txt';
                    a.click();
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>

              <Button onClick={() => setShowBackupCodes(false)} className="w-full mt-4">
                Done
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==================== SECURITY LOG ====================

export function SecurityLogCard({ className }: { className?: string }) {
  const { events } = useSecurity();
  const [filter, setFilter] = useState<'all' | 'warning' | 'critical'>('all');

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => e.severity === filter);
  }, [events, filter]);

  const getSeverityConfig = (severity: SecurityEvent['severity']) => {
    switch (severity) {
      case 'critical': return { icon: AlertCircle, color: 'text-red-500 bg-red-100 dark:bg-red-900/50' };
      case 'warning': return { icon: AlertTriangle, color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/50' };
      default: return { icon: Info, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/50' };
    }
  };

  const getEventIcon = (type: SecurityEvent['type']) => {
    switch (type) {
      case 'login': return Lock;
      case 'logout': return Unlock;
      case 'password_change': return Key;
      case 'mfa_enable': case 'mfa_disable': return Fingerprint;
      case 'suspicious_activity': return AlertTriangle;
      case 'api_key_created': case 'api_key_revoked': return Key;
      default: return Activity;
    }
  };

  return (
    <div className={cn('bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border dark:border-slate-800', className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Security Log</h3>
          <p className="text-sm text-gray-500">Recent security events</p>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as typeof filter)}
          className="text-sm px-3 py-1.5 border dark:border-slate-700 rounded-lg bg-transparent"
        >
          <option value="all">All events</option>
          <option value="warning">Warnings</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-gray-500">No security events</p>
          </div>
        ) : (
          filteredEvents.map(event => {
            const severityConfig = getSeverityConfig(event.severity);
            const EventIcon = getEventIcon(event.type);

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-4 rounded-xl border transition-colors',
                  event.severity === 'critical' && !event.resolved
                    ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                    : 'dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                )}
              >
                <div className="flex gap-3">
                  <div className={cn('p-2 rounded-lg h-fit', severityConfig.color)}>
                    <EventIcon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{event.description}</p>
                      <span className="text-xs text-gray-400 shrink-0">
                        {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {event.ip}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {events.length > 5 && (
        <Button variant="ghost" className="w-full mt-4">
          View all events
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}

// ==================== SECURITY DASHBOARD PAGE ====================

export function SecurityDashboard() {
  return (
    <SecurityProvider>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Security</h1>
          <p className="text-gray-500">Manage your account security and sessions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SecurityScoreCard />
          <TwoFactorCard />
          <div className="lg:col-span-1">
            <SecurityLogCard />
          </div>
        </div>

        <ActiveSessionsCard />
      </div>
    </SecurityProvider>
  );
}

export default {
  SecurityProvider,
  useSecurity,
  SecurityScoreCard,
  ActiveSessionsCard,
  TwoFactorCard,
  SecurityLogCard,
  SecurityDashboard,
};
