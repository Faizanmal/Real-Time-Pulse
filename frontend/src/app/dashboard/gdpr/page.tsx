'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gdprApi, type GdprConsent, type GdprDataRequest, type GdprComplianceReport } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
  FileText, Download, User, Lock, Eye, Trash2, Settings
} from 'lucide-react';
import { toast } from 'sonner';

const requestTypeLabels: Record<string, string> = {
  access: 'Data Access (DSAR)',
  erasure: 'Right to Erasure',
  rectification: 'Data Rectification',
  portability: 'Data Portability',
  restriction: 'Processing Restriction',
  objection: 'Right to Object',
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export default function GdprPage() {
  const [consents, setConsents] = useState<GdprConsent[]>([]);
  const [requests, setRequests] = useState<GdprDataRequest[]>([]);
  const [complianceReport, setComplianceReport] = useState<GdprComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  
  // Form state
  const [requestType, setRequestType] = useState('access');
  const [requestEmail, setRequestEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [consentsData, requestsData, reportsData] = await Promise.all([
        gdprApi.getConsents(),
        gdprApi.getDataRequests(),
        gdprApi.getComplianceReports(),
      ]);
      setConsents(consentsData);
      setRequests(requestsData);
      setComplianceReport(reportsData.length > 0 ? reportsData[0] : null);
    } catch (error) {
      console.error('Failed to load GDPR data:', error);
      toast.error('Failed to load GDPR data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmitRequest = async () => {
    if (!requestEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSaving(true);
    try {
      await gdprApi.submitDataRequest({
        type: requestType as GdprDataRequest['type'],
        email: requestEmail,
      });
      toast.success('Data request submitted');
      setRequestDialogOpen(false);
      setRequestEmail('');
      loadData();
    } catch (error) {
      console.error('Request failed:', error);
      toast.error('Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await gdprApi.processDataRequest(requestId);
      } else {
        await gdprApi.rejectDataRequest(requestId);
      }
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'}`);
      loadData();
    } catch (error) {
      console.error('Process failed:', error);
      toast.error(`Failed to ${action} request`);
    }
  };

  const handleUpdateConsent = async (consentId: string, granted: boolean) => {
    try {
      await gdprApi.updateConsent(consentId, { granted });
      loadData();
    } catch (error) {
      console.error('Update failed:', error);
      toast.error('Failed to update consent');
    }
  };

  const handleExportData = async () => {
    try {
      const blob = await gdprApi.exportPersonalData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personal-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    }
  };

  const stats = {
    totalConsents: consents.length,
    grantedConsents: consents.filter(c => c.granted).length,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
    completedRequests: requests.filter(r => r.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-500" />
            GDPR Compliance
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage data privacy and compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportData} className="gap-2">
            <Download className="h-4 w-4" />
            Export My Data
          </Button>
        </div>
      </div>

      {/* Compliance Score */}
      {complianceReport && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Compliance Score</h3>
                <p className="text-sm text-muted-foreground">Overall GDPR compliance status</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-purple-600">{complianceReport.score ?? 0}%</p>
                <Badge variant={(complianceReport.score ?? 0) >= 80 ? 'default' : (complianceReport.score ?? 0) >= 60 ? 'secondary' : 'destructive'}>
                  {(complianceReport.score ?? 0) >= 80 ? 'Compliant' : (complianceReport.score ?? 0) >= 60 ? 'Needs Attention' : 'Non-Compliant'}
                </Badge>
              </div>
            </div>
            <Progress value={complianceReport.score ?? 0} className="mt-4 h-2" />
            {complianceReport.issues && complianceReport.issues.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm font-medium flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle className="h-4 w-4" />
                  {complianceReport.issues.length} issue(s) require attention
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Consents</p>
                <p className="text-2xl font-bold">{stats.totalConsents}</p>
              </div>
              <Settings className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Granted</p>
                <p className="text-2xl font-bold">{stats.grantedConsents}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold">{stats.pendingRequests}</p>
              </div>
              <Clock className={`h-8 w-8 ${stats.pendingRequests > 0 ? 'text-yellow-500' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completedRequests}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="consents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consents">Consent Management</TabsTrigger>
          <TabsTrigger value="requests" className="relative">
            Data Requests
            {stats.pendingRequests > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-yellow-500 rounded-full text-xs text-white flex items-center justify-center">
                {stats.pendingRequests}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rights">Data Subject Rights</TabsTrigger>
        </TabsList>

        <TabsContent value="consents">
          <Card>
            <CardHeader>
              <CardTitle>Consent Preferences</CardTitle>
              <CardDescription>Manage your data processing consents</CardDescription>
            </CardHeader>
            <CardContent>
              {consents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No consents configured</p>
              ) : (
                <div className="space-y-4">
                  {consents.map((consent) => (
                    <div key={consent.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${consent.granted ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                          {consent.granted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{consent.purpose}</p>
                          <p className="text-sm text-muted-foreground">{consent.description}</p>
                          {consent.updatedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last updated: {new Date(consent.updatedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={consent.granted}
                        onCheckedChange={(checked) => handleUpdateConsent(consent.id, checked)}
                        disabled={consent.required}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Data Subject Requests</CardTitle>
                <CardDescription>Process data access and deletion requests</CardDescription>
              </div>
              <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <FileText className="h-4 w-4" />
                    New Request
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Submit Data Request</DialogTitle>
                    <DialogDescription>
                      Exercise your data subject rights under GDPR
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Request Type</Label>
                      <Select value={requestType} onValueChange={setRequestType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(requestTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={requestEmail}
                        onChange={(e) => setRequestEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSubmitRequest} disabled={saving}>
                      {saving ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Request'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No data requests</p>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {requests.map((request, index) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                            {request.type === 'access' ? <Eye className="h-5 w-5 text-purple-600" /> :
                             request.type === 'erasure' ? <Trash2 className="h-5 w-5 text-purple-600" /> :
                             request.type === 'portability' ? <Download className="h-5 w-5 text-purple-600" /> :
                             <Lock className="h-5 w-5 text-purple-600" />}
                          </div>
                          <div>
                            <p className="font-medium">{requestTypeLabels[request.type as keyof typeof requestTypeLabels] || request.type}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-3 w-3" />
                              {request.email}
                              <span>•</span>
                              <Clock className="h-3 w-3" />
                              {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                            {request.status}
                          </Badge>
                          {request.status === 'pending' && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleProcessRequest(request.id, 'approve')}
                              >
                                Approve
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleProcessRequest(request.id, 'reject')}
                                className="text-red-500"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rights">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Eye, title: 'Right to Access', description: 'Request a copy of your personal data', action: 'access' },
              { icon: Trash2, title: 'Right to Erasure', description: 'Request deletion of your personal data', action: 'erasure' },
              { icon: Download, title: 'Data Portability', description: 'Export your data in a portable format', action: 'portability' },
              { icon: Lock, title: 'Restrict Processing', description: 'Limit how your data is processed', action: 'restriction' },
              { icon: XCircle, title: 'Right to Object', description: 'Object to certain data processing', action: 'objection' },
              { icon: Settings, title: 'Rectification', description: 'Request correction of inaccurate data', action: 'rectification' },
            ].map((right) => (
              <Card key={right.action} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                      <right.icon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{right.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{right.description}</p>
                      <Button 
                        variant="link" 
                        className="px-0 mt-2"
                        onClick={() => {
                          setRequestType(right.action);
                          setRequestDialogOpen(true);
                        }}
                      >
                        Exercise this right →
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
