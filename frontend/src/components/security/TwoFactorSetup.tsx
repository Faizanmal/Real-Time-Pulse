'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { securityApi } from '@/lib/enterprise-api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Smartphone, Mail, CheckCircle2, XCircle, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TwoFactorSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function TwoFactorSetup({ open, onOpenChange, onComplete }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'choose' | 'setup' | 'verify' | 'backup'>('choose');
  const [method, setMethod] = useState<'totp' | 'email'>('totp');
  const [setupData, setSetupData] = useState<{ secret?: string; qrCode?: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setStep('choose');
      setMethod('totp');
      setSetupData(null);
      setVerificationCode('');
      setBackupCodes([]);
      setError(null);
    }
  }, [open]);

  const handleSetup = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await securityApi.setup2FA(method);
      setSetupData(response);
      setStep('setup');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to initialize 2FA setup';
      setError(errorMessage || 'Failed to initialize 2FA setup');
      toast.error('Failed to initialize 2FA setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await securityApi.verify2FA(verificationCode);
      if (response.verified) {
        // Get backup codes
        const codesResponse = await securityApi.regenerateBackupCodes();
        setBackupCodes(codesResponse.backupCodes);
        setStep('backup');
        toast.success('2FA enabled successfully!');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Invalid verification code';
      setError(errorMessage || 'Invalid verification code');
      toast.error('Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('Backup codes copied to clipboard');
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Shield className="h-5 w-5 text-green-400" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {step === 'choose' && 'Choose your preferred 2FA method'}
            {step === 'setup' && 'Set up your authenticator'}
            {step === 'verify' && 'Verify your setup'}
            {step === 'backup' && 'Save your backup codes'}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Step 1: Choose Method */}
          {step === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Tabs value={method} onValueChange={(v) => setMethod(v as 'totp' | 'email')}>
                <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                  <TabsTrigger value="totp" className="data-[state=active]:bg-green-600">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Authenticator App
                  </TabsTrigger>
                  <TabsTrigger value="email" className="data-[state=active]:bg-green-600">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="totp" className="mt-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <h4 className="font-medium mb-2">Authenticator App</h4>
                    <p className="text-sm text-gray-400">
                      Use an authenticator app like Google Authenticator, Authy, or 1Password
                      to generate time-based one-time passwords.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="email" className="mt-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <h4 className="font-medium mb-2">Email Verification</h4>
                    <p className="text-sm text-gray-400">
                      Receive verification codes via email each time you sign in.
                      Less secure than authenticator apps but more convenient.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                onClick={handleSetup}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Continue with {method === 'totp' ? 'Authenticator' : 'Email'}
              </Button>
            </motion.div>
          )}

          {/* Step 2: Setup */}
          {step === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {method === 'totp' && setupData?.qrCode && (
                <div className="text-center space-y-4">
                  <div className="bg-white p-4 rounded-lg inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={setupData.qrCode}
                      alt="QR Code for authenticator app"
                      className="w-48 h-48"
                    />
                  </div>
                  <p className="text-sm text-gray-400">
                    Scan this QR code with your authenticator app
                  </p>

                  {setupData.secret && (
                    <div className="p-3 bg-slate-800 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Manual entry code:</p>
                      <code className="text-sm font-mono text-green-400">{setupData.secret}</code>
                    </div>
                  )}
                </div>
              )}

              {method === 'email' && (
                <div className="text-center space-y-4">
                  <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700">
                    <Mail className="h-12 w-12 mx-auto text-blue-400 mb-4" />
                    <p className="text-sm text-gray-400">
                      A verification code has been sent to your email address.
                      Check your inbox and enter the code below.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="code" className="text-gray-300">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <XCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('choose')}
                  className="flex-1 border-slate-700 text-gray-300 hover:bg-slate-800"
                >
                  Back
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={isLoading || verificationCode.length !== 6}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Verify
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Backup Codes */}
          {step === 'backup' && (
            <motion.div
              key="backup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-green-400 mb-4">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">2FA Enabled Successfully!</span>
              </div>

              <div className="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-sm text-yellow-400 mb-4">
                  <strong>Important:</strong> Save these backup codes in a secure location.
                  You can use them to access your account if you lose your authenticator device.
                </p>

                <div className="grid grid-cols-2 gap-2 bg-slate-800 p-4 rounded-lg font-mono text-sm">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="text-gray-300">{code}</div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={handleCopyBackupCodes}
                  className="w-full mt-4 border-slate-700 text-gray-300 hover:bg-slate-800"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Backup Codes
                </Button>
              </div>

              <Button
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
