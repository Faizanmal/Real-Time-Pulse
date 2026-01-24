'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  Check,
  AlertTriangle,
  Clock,
  FileText,
  ExternalLink,
  Zap,
  BarChart3,
  Users,
  Database,
  Globe,
  TrendingUp,
} from 'lucide-react';
import {
  billingApi,
  BillingPlan,
  Subscription,
  Invoice,
  UsageStats,
} from '@/lib/enterprise-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BillingDashboardProps {
  className?: string;
}

export function BillingDashboard({ className }: BillingDashboardProps) {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [processingCheckout, setProcessingCheckout] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansData, subData, invoicesData, usageData] = await Promise.all([
        billingApi.getPlans(),
        billingApi.getCurrentSubscription(),
        billingApi.getInvoices(),
        billingApi.getUsage(),
      ]);
      setPlans(plansData);
      setSubscription(subData);
      setInvoices(invoicesData);
      setUsage(usageData);
    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: BillingPlan) => {
    if (!plan.stripePriceId) {
      toast.error('This plan is not available for purchase');
      return;
    }

    setProcessingCheckout(true);
    try {
      const { sessionUrl } = await billingApi.createCheckoutSession(plan.stripePriceId);
      window.location.href = sessionUrl;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      toast.error('Failed to start checkout');
      setProcessingCheckout(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { portalUrl } = await billingApi.createPortalSession();
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      toast.error('Failed to open billing portal');
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }

    try {
      const updated = await billingApi.cancelSubscription();
      setSubscription(updated);
      toast.success('Subscription will be cancelled at the end of the billing period');
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      toast.error('Failed to cancel subscription');
    }
  };

  const handleResumeSubscription = async () => {
    try {
      const updated = await billingApi.resumeSubscription();
      setSubscription(updated);
      toast.success('Subscription resumed');
    } catch (error) {
      console.error('Failed to resume subscription:', error);
      toast.error('Failed to resume subscription');
    }
  };

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-semibold">Billing & Subscription</h3>
        </div>
        {subscription && (
          <Button variant="outline" onClick={handleManageSubscription}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Billing
          </Button>
        )}
      </div>

      <Tabs defaultValue="subscription">
        <TabsList className="mb-6">
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription">
          {/* Current Plan */}
          {subscription && (
            <div className="mb-8">
              <h4 className="text-sm font-medium text-gray-500 mb-3">Current Plan</h4>
              <CurrentPlanCard
                subscription={subscription}
                onCancel={handleCancelSubscription}
                onResume={handleResumeSubscription}
              />
            </div>
          )}

          {/* Available Plans */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">
              {subscription ? 'Change Plan' : 'Choose a Plan'}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrentPlan={subscription?.planId === plan.id}
                  onSelect={() => setSelectedPlan(plan)}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="usage">
          {usage ? (
            <UsageSection usage={usage} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Usage data not available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesSection invoices={invoices} />
        </TabsContent>
      </Tabs>

      {/* Plan Selection Dialog */}
      {selectedPlan && (
        <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Subscribe to {selectedPlan.name}</DialogTitle>
              <DialogDescription>
                You are about to subscribe to the {selectedPlan.name} plan for $
                {selectedPlan.price}/{selectedPlan.interval}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-medium mb-2">Plan Features:</h5>
                <ul className="space-y-1">
                  {selectedPlan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedPlan(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSubscribe(selectedPlan)}
                  disabled={processingCheckout}
                >
                  {processingCheckout ? 'Processing...' : 'Subscribe Now'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

interface CurrentPlanCardProps {
  subscription: Subscription;
  onCancel: () => void;
  onResume: () => void;
}

function CurrentPlanCard({ subscription, onCancel, onResume }: CurrentPlanCardProps) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-red-100 text-red-800',
    canceled: 'bg-gray-100 text-gray-800',
    incomplete: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="border rounded-lg p-6 bg-linear-to-r from-emerald-50 to-teal-50">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-xl font-semibold">{subscription.plan.name}</h4>
            <Badge className={statusColors[subscription.status]}>
              {subscription.status}
            </Badge>
          </div>
          <p className="text-2xl font-bold">
            ${subscription.plan.price}
            <span className="text-sm font-normal text-gray-500">
              /{subscription.plan.interval}
            </span>
          </p>
        </div>

        <div className="text-right">
          {subscription.cancelAtPeriodEnd ? (
            <div>
              <Badge variant="outline" className="text-red-600 border-red-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Cancelling
              </Badge>
              <p className="text-sm text-gray-500 mt-1">
                Ends {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
              <Button size="sm" className="mt-2" onClick={onResume}>
                Resume Subscription
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500">
                <Clock className="h-4 w-4 inline mr-1" />
                Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={onCancel}>
                Cancel Subscription
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <h5 className="text-sm font-medium mb-2">Plan Limits</h5>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Portals:</span>{' '}
            <span className="font-medium">{subscription.plan.limits.portals}</span>
          </div>
          <div>
            <span className="text-gray-500">Widgets:</span>{' '}
            <span className="font-medium">{subscription.plan.limits.widgets}</span>
          </div>
          <div>
            <span className="text-gray-500">Members:</span>{' '}
            <span className="font-medium">{subscription.plan.limits.members}</span>
          </div>
          <div>
            <span className="text-gray-500">Integrations:</span>{' '}
            <span className="font-medium">{subscription.plan.limits.integrations}</span>
          </div>
          <div>
            <span className="text-gray-500">Storage:</span>{' '}
            <span className="font-medium">{subscription.plan.limits.storage} GB</span>
          </div>
          <div>
            <span className="text-gray-500">API Calls:</span>{' '}
            <span className="font-medium">
              {subscription.plan.limits.apiCalls.toLocaleString()}/mo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PlanCardProps {
  plan: BillingPlan;
  isCurrentPlan: boolean;
  onSelect: () => void;
}

function PlanCard({ plan, isCurrentPlan, onSelect }: PlanCardProps) {
  const isPopular = plan.name.toLowerCase().includes('pro');

  return (
    <div
      className={cn(
        'border rounded-lg p-6 relative',
        isPopular && 'ring-2 ring-emerald-500',
        isCurrentPlan && 'bg-gray-50'
      )}
    >
      {isPopular && (
        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500">
          Most Popular
        </Badge>
      )}

      <h4 className="text-lg font-semibold mb-1">{plan.name}</h4>
      <p className="text-sm text-gray-500 mb-4">{plan.description}</p>

      <div className="mb-6">
        <span className="text-3xl font-bold">${plan.price}</span>
        <span className="text-gray-500">/{plan.interval}</span>
      </div>

      <ul className="space-y-2 mb-6">
        {plan.features.slice(0, 5).map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            {feature}
          </li>
        ))}
        {plan.features.length > 5 && (
          <li className="text-sm text-gray-500">
            +{plan.features.length - 5} more features
          </li>
        )}
      </ul>

      <Button
        className="w-full"
        variant={isCurrentPlan ? 'outline' : isPopular ? 'default' : 'outline'}
        disabled={isCurrentPlan}
        onClick={onSelect}
      >
        {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
      </Button>
    </div>
  );
}

interface UsageSectionProps {
  usage: UsageStats;
}

function UsageSection({ usage }: UsageSectionProps) {
  const usageItems = [
    {
      name: 'Portals',
      icon: Globe,
      used: usage.portals.used,
      limit: usage.portals.limit,
    },
    {
      name: 'Widgets',
      icon: Zap,
      used: usage.widgets.used,
      limit: usage.widgets.limit,
    },
    {
      name: 'Integrations',
      icon: TrendingUp,
      used: usage.integrations.used,
      limit: usage.integrations.limit,
    },
    {
      name: 'Team Members',
      icon: Users,
      used: usage.members.used,
      limit: usage.members.limit,
    },
    {
      name: 'Storage (GB)',
      icon: Database,
      used: usage.storage.used,
      limit: usage.storage.limit,
    },
    {
      name: 'API Calls',
      icon: BarChart3,
      used: usage.apiCalls.used,
      limit: usage.apiCalls.limit,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {usageItems.map((item) => {
          const percentage = Math.min((item.used / item.limit) * 100, 100);
          const isNearLimit = percentage > 80;
          const isOverLimit = percentage >= 100;

          return (
            <div key={item.name} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <item.icon className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{item.name}</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold">
                  {item.used.toLocaleString()}
                </span>
                <span className="text-sm text-gray-500">
                  / {item.limit.toLocaleString()}
                </span>
              </div>
              <Progress
                value={percentage}
                className={cn(
                  'h-2',
                  isOverLimit && '[&>div]:bg-red-500',
                  isNearLimit && !isOverLimit && '[&>div]:bg-yellow-500'
                )}
              />
              {isNearLimit && (
                <p className="text-xs text-yellow-600 mt-1">
                  {isOverLimit ? 'Limit exceeded' : 'Approaching limit'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface InvoicesSectionProps {
  invoices: Invoice[];
}

function InvoicesSection({ invoices }: InvoicesSectionProps) {
  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    open: 'bg-blue-100 text-blue-800',
    draft: 'bg-gray-100 text-gray-800',
    void: 'bg-gray-100 text-gray-800',
    uncollectible: 'bg-red-100 text-red-800',
  };

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No invoices yet</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
              Date
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
              Period
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
              Amount
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
              Status
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm">
                {new Date(invoice.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(invoice.periodStart).toLocaleDateString()} -{' '}
                {new Date(invoice.periodEnd).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm font-medium">
                ${(invoice.amount / 100).toFixed(2)} {invoice.currency.toUpperCase()}
              </td>
              <td className="px-4 py-3">
                <Badge className={statusColors[invoice.status]}>
                  {invoice.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {invoice.invoiceUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8"
                    >
                      <a
                        href={invoice.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </a>
                    </Button>
                  )}
                  {invoice.invoicePdfUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8"
                    >
                      <a
                        href={invoice.invoicePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        PDF
                      </a>
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
