'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Smartphone,
  Mail,
  Key,
  LogOut,
  Monitor,
  Globe,
  AlertTriangle,
  Check,
  Copy,
  RefreshCw,
  Lock,
  Unlock,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  securityApi,
  TwoFactorStatus,
  TwoFactorSetup,
  Session,
  SSOProvider,
  SecuritySettings as SecuritySettingsType,
} from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/components/ui/tabs';
import { Switch } from '@/src/components/ui/switch';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/src/components/ui/input-otp';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface SecuritySettingsProps {
  className?: string;
}

export function SecuritySettings({ className }: SecuritySettingsProps) {
  const [loading, setLoading] = useState(true);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ssoProviders, setSsoProviders] = useState<SSOProvider[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettingsType | null>(null);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [status, sessionsData, providers, settings] = await Promise.all([
        securityApi.get2FAStatus(),
        securityApi.getSessions(),
        securityApi.getSSOProviders(),
        securityApi.getSecuritySettings(),
      ]);
      setTwoFactorStatus(status);
      setSessions(sessionsData);
      setSsoProviders(providers);
      setSecuritySettings(settings);
    } catch (error) {
      console.error('Failed to load security settings:', error);
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-5 w-5 text-red-500" />
        <h3 className="text-lg font-semibold">Security Settings</h3>
      </div>

      <Tabs defaultValue="2fa">
        <TabsList className="mb-6">
          <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="sso">SSO</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="2fa">
          <TwoFactorSection
            status={twoFactorStatus}
            onSetup={() => setShow2FASetup(true)}
            onDisable={() => setShow2FADisable(true)}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsSection sessions={sessions} onRefresh={loadData} />
        </TabsContent>

        <TabsContent value="sso">
          <SSOSection providers={ssoProviders} onRefresh={loadData} />
        </TabsContent>

        <TabsContent value="settings">
          {securitySettings && (
            <SettingsSection
              settings={securitySettings}
              onUpdate={async (settings) => {
                try {
                  const updated = await securityApi.updateSecuritySettings(settings);
                  setSecuritySettings(updated);
                  toast.success('Settings updated');
                } catch (error) {
                  console.error('Failed to update settings:', error);
                  toast.error('Failed to update settings');
                }
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* 2FA Setup Dialog */}
      <TwoFactorSetupDialog
        open={show2FASetup}
        onClose={() => {
          setShow2FASetup(false);
          loadData();
        }}
      />

      {/* 2FA Disable Dialog */}
      <TwoFactorDisableDialog
        open={show2FADisable}
        onClose={() => {
          setShow2FADisable(false);
          loadData();
        }}
      />
    </Card>
  );
}

interface TwoFactorSectionProps {
  status: TwoFactorStatus | null;
  onSetup: () => void;
  onDisable: () => void;
  onRefresh: () => void;
}

function TwoFactorSection({ status, onSetup, onDisable, onRefresh }: TwoFactorSectionProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const handleRegenerateBackupCodes = async () => {
    if (!confirm('This will invalidate your existing backup codes. Continue?')) return;

    setRegenerating(true);
    try {
      const result = await securityApi.regenerateBackupCodes();
      setBackupCodes(result.backupCodes);
      setShowBackupCodes(true);
      toast.success('Backup codes regenerated');
    } catch (error) {
      console.error('Failed to regenerate backup codes:', error);
      toast.error('Failed to regenerate backup codes');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'p-3 rounded-full',
              status?.enabled ? 'bg-green-100' : 'bg-gray-100'
            )}
          >
            {status?.enabled ? (
              <Lock className="h-6 w-6 text-green-600" />
            ) : (
              <Unlock className="h-6 w-6 text-gray-600" />
            )}
          </div>
          <div>
            <h4 className="font-medium">Two-Factor Authentication</h4>
            <p className="text-sm text-gray-500">
              {status?.enabled
                ? `Enabled via ${status.method === 'totp' ? 'Authenticator App' : 'Email'}`
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
        </div>
        {status?.enabled ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerateBackupCodes}>
              <RefreshCw className={cn('h-4 w-4 mr-2', regenerating && 'animate-spin')} />
              Backup Codes
            </Button>
            <Button variant="destructive" size="sm" onClick={onDisable}>
              Disable
            </Button>
          </div>
        ) : (
          <Button onClick={onSetup}>Enable 2FA</Button>
        )}
      </div>

      {status?.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Authenticator App</span>
            </div>
            <p className="text-sm text-gray-500">
              {status.method === 'totp'
                ? 'Currently active'
                : 'Use an app like Google Authenticator or Authy'}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Email Verification</span>
            </div>
            <p className="text-sm text-gray-500">
              {status.method === 'email'
                ? 'Currently active'
                : 'Receive codes via email'}
            </p>
          </div>
        </div>
      )}

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backup Codes</DialogTitle>
            <DialogDescription>
              Store these codes safely. Each can only be used once.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <code key={i} className="bg-white px-3 py-2 rounded border text-center font-mono">
                  {code}
                </code>
              ))}
            </div>
          </div>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(backupCodes.join('\n'));
              toast.success('Codes copied to clipboard');
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy All Codes
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TwoFactorSetupDialogProps {
  open: boolean;
  onClose: () => void;
}

function TwoFactorSetupDialog({ open, onClose }: TwoFactorSetupDialogProps) {
  const [step, setStep] = useState<'method' | 'setup' | 'verify' | 'backup'>('method');
  const [method, setMethod] = useState<'totp' | 'email'>('totp');
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const data = await securityApi.setup2FA(method);
      setSetupData(data);
      setStep('setup');
    } catch (error) {
      console.error('Failed to setup 2FA:', error);
      toast.error('Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return;

    setLoading(true);
    try {
      const result = await securityApi.verify2FA(verifyCode);
      if (result.verified) {
        setStep('backup');
        toast.success('2FA enabled successfully');
      } else {
        toast.error('Invalid code');
      }
    } catch (error) {
      console.error('Failed to verify:', error);
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('method');
    setMethod('totp');
    setSetupData(null);
    setVerifyCode('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            {step === 'method' && 'Choose your preferred verification method'}
            {step === 'setup' && 'Scan the QR code or enter the secret key'}
            {step === 'verify' && 'Enter the code from your authenticator app'}
            {step === 'backup' && 'Save your backup codes'}
          </DialogDescription>
        </DialogHeader>

        {step === 'method' && (
          <div className="space-y-4">
            <button
              className={cn(
                'w-full p-4 border rounded-lg text-left flex items-center gap-4 transition-colors',
                method === 'totp' && 'border-blue-500 bg-blue-50'
              )}
              onClick={() => setMethod('totp')}
            >
              <Smartphone className="h-8 w-8" />
              <div>
                <h4 className="font-medium">Authenticator App</h4>
                <p className="text-sm text-gray-500">
                  Use Google Authenticator, Authy, or similar
                </p>
              </div>
              {method === 'totp' && <Check className="h-5 w-5 text-blue-500 ml-auto" />}
            </button>

            <button
              className={cn(
                'w-full p-4 border rounded-lg text-left flex items-center gap-4 transition-colors',
                method === 'email' && 'border-blue-500 bg-blue-50'
              )}
              onClick={() => setMethod('email')}
            >
              <Mail className="h-8 w-8" />
              <div>
                <h4 className="font-medium">Email</h4>
                <p className="text-sm text-gray-500">
                  Receive verification codes via email
                </p>
              </div>
              {method === 'email' && <Check className="h-5 w-5 text-blue-500 ml-auto" />}
            </button>

            <Button className="w-full" onClick={handleSetup} disabled={loading}>
              {loading ? 'Setting up...' : 'Continue'}
            </Button>
          </div>
        )}

        {step === 'setup' && setupData && (
          <div className="space-y-4">
            {method === 'totp' && setupData.qrCode && (
              <>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img src={setupData.qrCode} alt="QR Code" className="w-48 h-48" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Or enter this code manually:</p>
                  <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                    {setupData.secret}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => {
                      navigator.clipboard.writeText(setupData.secret);
                      toast.success('Copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {method === 'email' && (
              <div className="text-center py-8">
                <Mail className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p>We've sent a verification code to your email.</p>
              </div>
            )}

            <Button className="w-full" onClick={() => setStep('verify')}>
              I've Set It Up
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={verifyCode}
                onChange={setVerifyCode}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={loading || verifyCode.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        )}

        {step === 'backup' && setupData && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">Save these backup codes!</span>
              </div>
              <p className="text-sm text-yellow-700">
                You'll need these if you lose access to your authenticator.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {setupData.backupCodes.map((code, i) => (
                <code key={i} className="bg-gray-100 px-3 py-2 rounded text-center font-mono">
                  {code}
                </code>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
                toast.success('Codes copied');
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Codes
            </Button>

            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface TwoFactorDisableDialogProps {
  open: boolean;
  onClose: () => void;
}

function TwoFactorDisableDialog({ open, onClose }: TwoFactorDisableDialogProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDisable = async () => {
    if (code.length !== 6) return;

    setLoading(true);
    try {
      const result = await securityApi.disable2FA(code);
      if (result.disabled) {
        toast.success('2FA disabled');
        onClose();
      } else {
        toast.error('Invalid code');
      }
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      toast.error('Failed to disable 2FA');
    } finally {
      setLoading(false);
      setCode('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Enter your verification code to disable 2FA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-sm text-red-800">
                Your account will be less secure without 2FA
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDisable}
              disabled={loading || code.length !== 6}
            >
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SessionsSectionProps {
  sessions: Session[];
  onRefresh: () => void;
}

function SessionsSection({ sessions, onRefresh }: SessionsSectionProps) {
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await securityApi.revokeSession(sessionId);
      toast.success('Session revoked');
      onRefresh();
    } catch (error) {
      console.error('Failed to revoke session:', error);
      toast.error('Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('This will log you out of all other devices. Continue?')) return;

    try {
      await securityApi.revokeAllSessions();
      toast.success('All other sessions revoked');
      onRefresh();
    } catch (error) {
      console.error('Failed to revoke sessions:', error);
      toast.error('Failed to revoke sessions');
    }
  };

  const getDeviceIcon = (device: string) => {
    if (device.toLowerCase().includes('mobile')) return <Smartphone className="h-5 w-5" />;
    return <Monitor className="h-5 w-5" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Manage your active sessions across devices
        </p>
        <Button variant="outline" size="sm" onClick={handleRevokeAll}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out All
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {sessions.map((session) => (
          <div key={session.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-gray-500">
                {getDeviceIcon(session.deviceInfo.device)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {session.deviceInfo.browser} on {session.deviceInfo.os}
                  </span>
                  {session.isCurrent && (
                    <Badge variant="default" className="bg-green-500">
                      Current
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  <span>{session.ipAddress}</span>
                  {session.location && <span> • {session.location}</span>}
                </div>
                <p className="text-xs text-gray-400">
                  Last active: {new Date(session.lastActive).toLocaleString()}
                </p>
              </div>
            </div>
            {!session.isCurrent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRevokeSession(session.id)}
                disabled={revoking === session.id}
              >
                {revoking === session.id ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SSOSectionProps {
  providers: SSOProvider[];
  onRefresh: () => void;
}

function SSOSection({ providers, onRefresh }: SSOSectionProps) {
  const handleConfigureSSO = async (provider: SSOProvider) => {
    // In a real app, this would open a configuration dialog
    toast.info('SSO configuration coming soon');
  };

  const handleInitiateLogin = async (providerId: string) => {
    try {
      const { redirectUrl } = await securityApi.initiateSSOLogin(providerId);
      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Failed to initiate SSO login:', error);
      toast.error('Failed to start SSO login');
    }
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'oidc':
        return <Key className="h-5 w-5" />;
      case 'saml':
        return <Shield className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  if (providers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No SSO providers configured</p>
        <p className="text-sm">Contact your administrator to set up SSO</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Single Sign-On providers for your organization
      </p>

      <div className="border rounded-lg divide-y">
        {providers.map((provider) => (
          <div key={provider.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-gray-500">{getProviderIcon(provider.type)}</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{provider.name}</span>
                  <Badge variant={provider.enabled ? 'default' : 'secondary'}>
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 uppercase">{provider.type}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfigureSSO(provider)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              {provider.enabled && (
                <Button size="sm" onClick={() => handleInitiateLogin(provider.id)}>
                  Login
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  settings: SecuritySettingsType;
  onUpdate: (settings: Partial<SecuritySettingsType>) => void;
}

function SettingsSection({ settings, onUpdate }: SettingsSectionProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [ipInput, setIpInput] = useState('');

  const handleSave = () => {
    onUpdate(localSettings);
  };

  const addIpToWhitelist = () => {
    if (!ipInput) return;
    setLocalSettings({
      ...localSettings,
      ipWhitelist: [...localSettings.ipWhitelist, ipInput],
    });
    setIpInput('');
  };

  const removeIpFromWhitelist = (ip: string) => {
    setLocalSettings({
      ...localSettings,
      ipWhitelist: localSettings.ipWhitelist.filter((i) => i !== ip),
    });
  };

  return (
    <div className="space-y-6">
      {/* Password Policy */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-4">Password Policy</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Minimum Length</Label>
            <Input
              type="number"
              min={8}
              max={32}
              value={localSettings.passwordPolicy.minLength}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  passwordPolicy: {
                    ...localSettings.passwordPolicy,
                    minLength: parseInt(e.target.value),
                  },
                })
              }
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Require Uppercase</Label>
            <Switch
              checked={localSettings.passwordPolicy.requireUppercase}
              onCheckedChange={(checked) =>
                setLocalSettings({
                  ...localSettings,
                  passwordPolicy: {
                    ...localSettings.passwordPolicy,
                    requireUppercase: checked,
                  },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Require Numbers</Label>
            <Switch
              checked={localSettings.passwordPolicy.requireNumbers}
              onCheckedChange={(checked) =>
                setLocalSettings({
                  ...localSettings,
                  passwordPolicy: {
                    ...localSettings.passwordPolicy,
                    requireNumbers: checked,
                  },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Require Symbols</Label>
            <Switch
              checked={localSettings.passwordPolicy.requireSymbols}
              onCheckedChange={(checked) =>
                setLocalSettings({
                  ...localSettings,
                  passwordPolicy: {
                    ...localSettings.passwordPolicy,
                    requireSymbols: checked,
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Session Policy */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-4">Session Policy</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Max Concurrent Sessions</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={localSettings.sessionPolicy.maxSessions}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  sessionPolicy: {
                    ...localSettings.sessionPolicy,
                    maxSessions: parseInt(e.target.value),
                  },
                })
              }
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Session Timeout (hours)</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={localSettings.sessionPolicy.sessionTimeout}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  sessionPolicy: {
                    ...localSettings.sessionPolicy,
                    sessionTimeout: parseInt(e.target.value),
                  },
                })
              }
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Require Re-authentication for Sensitive Actions</Label>
            <Switch
              checked={localSettings.sessionPolicy.requireReauth}
              onCheckedChange={(checked) =>
                setLocalSettings({
                  ...localSettings,
                  sessionPolicy: {
                    ...localSettings.sessionPolicy,
                    requireReauth: checked,
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      {/* IP Whitelist */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-4">IP Whitelist</h4>
        <p className="text-sm text-gray-500 mb-4">
          Restrict access to specific IP addresses
        </p>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="192.168.1.1 or 10.0.0.0/24"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
          />
          <Button onClick={addIpToWhitelist} variant="outline">
            Add
          </Button>
        </div>
        {localSettings.ipWhitelist.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {localSettings.ipWhitelist.map((ip) => (
              <Badge key={ip} variant="secondary" className="gap-1">
                {ip}
                <button
                  onClick={() => removeIpFromWhitelist(ip)}
                  className="ml-1 hover:text-red-600"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSave}>Save Settings</Button>
    </div>
  );
}
