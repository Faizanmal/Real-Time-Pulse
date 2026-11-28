'use client';

import { CheckCircle2, Circle, Copy, ExternalLink, RefreshCw, Rocket, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { onboardingApi, type OnboardingStage, type OnboardingStatus } from '@/lib/api/onboarding';
import { portalApi } from '@/lib/api-client';

const STAGE_LABELS: Record<OnboardingStage, string> = {
  REGISTERED: 'Agency registered',
  CONNECTED: 'Provider connected',
  FIRST_VALID_SYNC: 'First valid sync',
  FIRST_PUBLISH: 'First client portal published',
  FIRST_CLIENT_VIEW: 'First client view',
  FIRST_DECISION: 'First client decision',
  PAID_CONVERSION: 'Paid conversion',
};

export default function OnboardingPage() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await onboardingApi.getStatus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Onboarding status could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createDemo = async () => {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await portalApi.createDemoClientPortal();
      setNotice('Fictional demo portal is ready. No provider account was contacted and no email was sent.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Demo setup failed. Your workspace is unchanged; retry or connect a provider.');
    } finally {
      setWorking(false);
    }
  };

  const changeConsent = async (consented: boolean) => {
    setWorking(true);
    setError(null);
    setStatus((current) => current ? { ...current, analyticsConsent: consented } : current);
    try {
      await onboardingApi.setAnalyticsConsent(consented);
      await load();
      setNotice(consented ? 'Optional funnel analytics enabled.' : 'Consent revoked and previously collected funnel events removed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Consent preference could not be saved.');
      await load();
    } finally {
      setWorking(false);
    }
  };

  const copyInvite = async () => {
    if (!status?.demoClientPath) return;
    const url = new URL(status.demoClientPath, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Demo client invitation link copied. Share it only with your intended tester.');
    } catch {
      setError('Clipboard access was unavailable. Open the client view and copy its address from the browser.');
    }
  };

  const completedStages = status?.stages.filter((stage) => stage.complete).length ?? 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8" aria-labelledby="onboarding-title">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Getting started</p>
        <h1 id="onboarding-title" className="mt-1 text-3xl font-bold">Onboarding and templates</h1>
        <p className="mt-2 text-muted-foreground">Start with a clearly labelled sample portal, then replace it with your client’s data when ready.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">{notice}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" />Build a sample client journey</CardTitle>
          <CardDescription>The demo creates a synthetic connector, starter portal, and published snapshot. It requires no provider keys or terminal commands.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => void createDemo()} disabled={loading || working}>
            {working ? 'Preparing…' : status?.demoClientPath ? 'Resume demo setup' : 'Create demo portal'}
          </Button>
          {status?.providerConnection && (
            <div className="rounded-lg border p-4 text-sm" aria-live="polite">
              <p className="font-medium">Provider status: {status.providerConnection.state.toLowerCase().replaceAll('_', ' ')}</p>
              {status.providerConnection.isDemo && <p className="mt-1 text-muted-foreground">Fictional local demo connector</p>}
              {status.providerConnection.lastValidDataAt && <p className="mt-1 text-muted-foreground">Last valid data: {new Date(status.providerConnection.lastValidDataAt).toLocaleString()}</p>}
              {status.providerConnection.failureCode && <p className="mt-2 text-amber-800 dark:text-amber-300">Connection needs attention ({status.providerConnection.failureCode}). {status.providerConnection.nextAction}</p>}
              <Link className="mt-2 inline-block underline" href="/dashboard/integrations">Review connections and retry</Link>
            </div>
          )}
          {status?.demoClientPath && (
            <div className="rounded-lg border border-dashed p-4">
              <p className="font-medium">Client invitation</p>
              <p className="mt-1 text-sm text-muted-foreground">This is a client-view link for the published fictional sample. Copying it does not send an email.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void copyInvite()}><Copy className="mr-2 h-4 w-4" />Copy invitation link</Button>
                <Button variant="outline" asChild><Link href={status.demoClientPath} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open client view</Link></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consent-based onboarding funnel</CardTitle>
          <CardDescription>Optional, pseudonymous first milestones. Event rows contain no workspace, user, client, email, token, or provider payload identifiers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p role="status">Loading onboarding status…</p> : !status ? <p role="status">Onboarding status is unavailable.</p> : (
            <>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={status.analyticsConsent} aria-busy={working} onChange={(event) => { if (!working) void changeConsent(event.target.checked); }} className="mt-1 h-4 w-4" />
                <span>Allow anonymous onboarding milestones for product improvement. This is optional. Revoking consent deletes the workspace’s funnel events.</span>
              </label>
              {!status.trackingAvailable && <p className="text-sm text-amber-800 dark:text-amber-300">Tracking is disabled until the server has an `ONBOARDING_FUNNEL_HMAC_KEY` of at least 32 bytes.</p>}
              {status.analyticsConsent && status.trackingAvailable ? (
                <>
                  <p className="text-sm text-muted-foreground">{completedStages} of {status.totalStages} milestones recorded. Last status check: {new Date().toLocaleString()}</p>
                  <ol className="space-y-2">
                    {status.stages.map((stage) => {
                      const Icon = stage.complete ? CheckCircle2 : Circle;
                      return <li key={stage.stage} className="flex items-center gap-3 text-sm"><Icon className="h-4 w-4" aria-hidden="true" /><span>{STAGE_LABELS[stage.stage]}</span><span className="ml-auto text-muted-foreground">{stage.happenedAt ? new Date(stage.happenedAt).toLocaleDateString() : 'Not yet'}</span></li>;
                    })}
                  </ol>
                </>
              ) : <p className="text-sm text-muted-foreground">No funnel events are recorded unless a workspace owner or admin opts in.</p>}
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />No event is sent to an external analytics provider.</p>
            </>
          )}
          <Button variant="ghost" onClick={() => void load()} disabled={loading || working}><RefreshCw className="mr-2 h-4 w-4" />Refresh status</Button>
        </CardContent>
      </Card>
    </main>
  );
}

