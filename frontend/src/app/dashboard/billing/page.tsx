'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { billingApi, type BillingPlan, type Subscription, type Invoice, type UsageLimits } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  CreditCard, Check, Download, Zap, Users, Database, 
  Globe, AlertTriangle, Crown, Sparkles, Calendar, Receipt
} from 'lucide-react';
import { toast } from 'sonner';

export default function BillingPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [limits, setLimits] = useState<UsageLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansData, subData, invoicesData, limitsData] = await Promise.all([
        billingApi.getPlans(),
        billingApi.getCurrentSubscription().catch(() => null),
        billingApi.getInvoices().catch(() => []),
        billingApi.getUsageLimits(),
      ]);
      setPlans(plansData);
      setSubscription(subData);
      setInvoices(invoicesData);
      setLimits(limitsData);
    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpgrade = async (plan: BillingPlan) => {
    setSelectedPlan(plan);
    setUpgradeDialogOpen(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan) return;
    
    try {
      const session = await billingApi.createCheckoutSession(selectedPlan.id);
      // Redirect to Stripe checkout
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error('Failed to start checkout');
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    
    try {
      await billingApi.cancelSubscription();
      toast.success('Subscription canceled');
      loadData();
    } catch (error) {
      console.error('Cancel failed:', error);
      toast.error('Failed to cancel subscription');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  const currentPlan = plans.find(p => p.id === subscription?.planId) || plans[0];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-purple-500" />
          Billing & Subscription
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription, view usage, and download invoices
        </p>
      </div>

      {/* Current Plan & Usage */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Current Plan */}
        <Card className="lg:col-span-1 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">{currentPlan?.name || 'Free'}</h3>
                <p className="text-muted-foreground">
                  ${currentPlan?.price || 0}/{currentPlan?.interval || 'month'}
                </p>
              </div>
              <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
                {subscription?.status || 'Free'}
              </Badge>
            </div>
            
            {subscription?.currentPeriodEnd && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </div>
            )}

            <div className="pt-4 space-y-2">
              <Button className="w-full" onClick={() => setUpgradeDialogOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
              {subscription && subscription.status === 'active' && (
                <Button variant="outline" className="w-full" onClick={handleCancelSubscription}>
                  Cancel Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Limits */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              Usage & Limits
            </CardTitle>
            <CardDescription>Your current resource usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <UsageBar 
              label="Portals" 
              used={limits?.portals.used || 0} 
              limit={limits?.portals.limit || 5}
              icon={Globe}
            />
            <UsageBar 
              label="Team Members" 
              used={limits?.users.used || 0} 
              limit={limits?.users.limit || 3}
              icon={Users}
            />
            <UsageBar 
              label="Storage" 
              used={limits?.storage.used || 0} 
              limit={limits?.storage.limit || 1024}
              unit="MB"
              icon={Database}
            />
            <UsageBar 
              label="API Calls (this month)" 
              used={limits?.apiCalls.used || 0} 
              limit={limits?.apiCalls.limit || 10000}
              icon={Zap}
            />
          </CardContent>
        </Card>
      </div>

      {/* Pricing Plans */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`relative ${plan.id === currentPlan?.id ? 'border-purple-500 border-2' : ''} ${plan.popular ? 'shadow-lg' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-purple-500">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={plan.id === currentPlan?.id ? 'outline' : 'default'}
                    disabled={plan.id === currentPlan?.id}
                    onClick={() => handleUpgrade(plan)}
                  >
                    {plan.id === currentPlan?.id ? 'Current Plan' : 'Select Plan'}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-green-500" />
            Invoice History
          </CardTitle>
          <CardDescription>Download past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No invoices yet</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                      <Receipt className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{invoice.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold">${(invoice.amount / 100).toFixed(2)}</p>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'destructive'}>
                        {invoice.status}
                      </Badge>
                    </div>
                    {invoice.pdfUrl && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to {selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              You'll be redirected to our secure payment page
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border p-4">
              <div className="flex justify-between mb-2">
                <span>Plan</span>
                <span className="font-medium">{selectedPlan?.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Price</span>
                <span className="font-medium">${selectedPlan?.price}/{selectedPlan?.interval}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>${selectedPlan?.price}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setUpgradeDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmUpgrade}>
                Proceed to Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsageBar({ 
  label, 
  used, 
  limit, 
  unit = '',
  icon: Icon 
}: { 
  label: string; 
  used: number; 
  limit: number; 
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isWarning = percentage > 80;
  const isCritical = percentage > 95;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${isCritical ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-muted-foreground'}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {used.toLocaleString()}{unit} / {limit.toLocaleString()}{unit}
        </span>
      </div>
      <div className="relative">
        <Progress 
          value={percentage} 
          className={`h-2 ${isCritical ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-yellow-500' : ''}`}
        />
        {isCritical && (
          <AlertTriangle className="absolute -right-1 -top-1 h-4 w-4 text-red-500 animate-pulse" />
        )}
      </div>
    </div>
  );
}
