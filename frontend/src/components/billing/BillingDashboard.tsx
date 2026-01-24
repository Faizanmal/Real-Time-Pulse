'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, DollarSign, TrendingUp, Download, Calendar, Users, } from 'lucide-react';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  billingCycle: string;
  nextBillingDate: string;
  seats: number;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  date: string;
  pdfUrl: string;
}

interface UsageMetric {
  name: string;
  used: number;
  limit: number;
  unit: string;
}

export default function BillingDashboard() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<UsageMetric[]>([]);
  const [_loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const [subRes, invRes, usageRes] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/billing/invoices'),
        fetch('/api/billing/usage')
      ]);
      const subData = await subRes.json();
      const invData = await invRes.json();
      const usageData = await usageRes.json();
      setSubscription(subData);
      setInvoices(invData);
      setUsage(usageData);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      a.click();
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  };

  const upgradePlan = () => {
    window.location.href = '/billing/upgrade';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            Billing
          </h1>
          <p className="text-muted-foreground">Manage your subscription and billing</p>
        </div>
        <Button onClick={upgradePlan}>
          <TrendingUp className="h-4 w-4 mr-2" />
          Upgrade Plan
        </Button>
      </div>

      {subscription && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{subscription.plan} Plan</CardTitle>
                <CardDescription>Active subscription</CardDescription>
              </div>
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'} className="text-lg px-4 py-1">
                {subscription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Amount</div>
                <div className="text-2xl font-bold">
                  ${subscription.amount}
                  <span className="text-sm text-muted-foreground">/{subscription.billingCycle}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Next Billing</div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(subscription.nextBillingDate).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Seats</div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {subscription.seats}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Currency</div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {subscription.currency.toUpperCase()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment">Payment Method</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Usage</CardTitle>
              <CardDescription>Track your usage against plan limits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {usage.map((metric) => (
                  <div key={metric.name}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">{metric.name}</span>
                      <span className="text-muted-foreground">
                        {metric.used.toLocaleString()} / {metric.limit.toLocaleString()} {metric.unit}
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          (metric.used / metric.limit) > 0.9 ? 'bg-red-500' :
                          (metric.used / metric.limit) > 0.75 ? 'bg-yellow-500' :
                          'bg-primary'
                        }`}
                        style={{ width: `${Math.min((metric.used / metric.limit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          {invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-semibold text-lg">
                      ${invoice.amount.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(invoice.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                      {invoice.status}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => downloadInvoice(invoice.id)}>
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Manage your payment information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <CreditCard className="h-8 w-8" />
                  <div className="flex-1">
                    <div className="font-semibold">•••• •••• •••• 4242</div>
                    <div className="text-sm text-muted-foreground">Expires 12/2025</div>
                  </div>
                  <Badge variant="default">Default</Badge>
                </div>
                <Button variant="outline" className="w-full">
                  Update Payment Method
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
