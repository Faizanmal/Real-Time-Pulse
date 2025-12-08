'use client';

import React, { useState } from 'react';
import { useBlockchain } from '@/hooks/useAdvancedFeatures';
import { blockchainAPI } from '@/lib/advanced-features-api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Link2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Search,
  Hash,
  FileText,
  Eye,
} from 'lucide-react';

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  data: Record<string, unknown>;
  timestamp: string;
  hash: string;
  previousHash?: string;
  blockNumber?: number;
}

interface IntegrityVerification {
  isValid: boolean;
  blocksVerified: number;
  entriesVerified: number;
  invalidBlocks: string[];
  invalidEntries: string[];
  verifiedAt: string;
}

export function BlockchainAuditPanel() {
  const { verifyIntegrity, getAuditTrail, generateReport } =
    useBlockchain();

  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [searchEntity, setSearchEntity] = useState('');
  const [searchEntityId, setSearchEntityId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<IntegrityVerification | null>(null);
  const [activeTab, setActiveTab] = useState<'trail' | 'verify' | 'report'>('trail');
  const [reportOptions, setReportOptions] = useState({
    startDate: '',
    endDate: '',
    entityTypes: [] as string[],
    actions: [] as string[],
  });

  const handleSearch = async () => {
    if (!searchEntity || !searchEntityId) return;

    try {
      const trail = await getAuditTrail(searchEntity, searchEntityId);
      setAuditTrail(trail);
    } catch (error) {
      console.error('Failed to fetch audit trail:', error);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyIntegrity();
      setVerificationResult(result);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyEntry = async (entryId: string) => {
    try {
      const result = await blockchainAPI.verifyEntry(entryId);
      // Update the entry in the list with verification status
      setAuditTrail((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, verified: result.valid } : entry
        )
      );
    } catch (error) {
      console.error('Failed to verify entry:', error);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const report = await generateReport(reportOptions);
      // Download as JSON
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const handleExportChain = async () => {
    try {
      const chain = await blockchainAPI.exportChain();
      const blob = new Blob([JSON.stringify(chain, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `blockchain-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export chain:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-linear-to-br from-cyan-500 to-blue-500 rounded-lg">
            <Link2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Blockchain Audit Trail</h2>
            <p className="text-sm text-gray-600">
              Immutable record of all data changes with cryptographic verification
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportChain}>
            <Download className="h-4 w-4 mr-2" />
            Export Chain
          </Button>
          <Button onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Verify Integrity
          </Button>
        </div>
      </div>

      {/* Integrity Status */}
      {verificationResult && (
        <Card
          className={`p-4 ${
            verificationResult.isValid
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {verificationResult.isValid ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
              <div>
                <h3 className="font-semibold">
                  {verificationResult.isValid
                    ? 'Blockchain Integrity Verified'
                    : 'Integrity Issues Detected'}
                </h3>
                <p className="text-sm text-gray-600">
                  {verificationResult.blocksVerified} blocks, {verificationResult.entriesVerified}{' '}
                  entries verified
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>Last verified</p>
              <p>{new Date(verificationResult.verifiedAt).toLocaleString()}</p>
            </div>
          </div>
          {!verificationResult.isValid && verificationResult.invalidEntries.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-red-700 mb-2">
                Invalid entries detected:
              </p>
              <div className="flex flex-wrap gap-2">
                {verificationResult.invalidEntries.map((id) => (
                  <Badge key={id} variant="outline" className="bg-red-100 text-red-700">
                    {id.slice(0, 8)}...
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {(['trail', 'verify', 'report'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'trail' ? 'Audit Trail' : tab === 'verify' ? 'Verify Entry' : 'Compliance Report'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'trail' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search */}
          <div className="lg:col-span-1">
            <Card className="p-4">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search Audit Trail
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Entity Type</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={searchEntity}
                    onChange={(e) => setSearchEntity(e.target.value)}
                  >
                    <option value="">Select type</option>
                    <option value="portal">Portal</option>
                    <option value="widget">Widget</option>
                    <option value="integration">Integration</option>
                    <option value="user">User</option>
                    <option value="workspace">Workspace</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Entity ID</label>
                  <Input
                    placeholder="Enter entity ID"
                    value={searchEntityId}
                    onChange={(e) => setSearchEntityId(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSearch}
                  disabled={!searchEntity || !searchEntityId}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            <Card className="divide-y">
              {auditTrail.length > 0 ? (
                auditTrail.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedEntry?.id === entry.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            entry.action === 'CREATE'
                              ? 'bg-green-100 text-green-700'
                              : entry.action === 'UPDATE'
                              ? 'bg-blue-100 text-blue-700'
                              : entry.action === 'DELETE'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }
                        >
                          {entry.action}
                        </Badge>
                        <span className="text-sm font-medium">{entry.entityType}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.blockNumber && (
                          <Badge variant="outline" className="text-xs">
                            Block #{entry.blockNumber}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Hash className="h-3 w-3" />
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {entry.hash.slice(0, 16)}...{entry.hash.slice(-8)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVerifyEntry(entry.id);
                        }}
                      >
                        <Shield className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <Link2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600">No audit trail</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Search for an entity to view its audit trail
                  </p>
                </div>
              )}
            </Card>

            {/* Selected Entry Details */}
            {selectedEntry && (
              <Card className="p-4 mt-4">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Entry Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Entity:</span>
                    <span className="ml-2 font-medium">{selectedEntry.entityType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Entity ID:</span>
                    <code className="ml-2 bg-gray-100 px-2 py-0.5 rounded text-xs">
                      {selectedEntry.entityId}
                    </code>
                  </div>
                  <div>
                    <span className="text-gray-500">Action:</span>
                    <span className="ml-2 font-medium">{selectedEntry.action}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">User:</span>
                    <span className="ml-2">{selectedEntry.userId}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Hash:</span>
                    <code className="ml-2 bg-gray-100 px-2 py-0.5 rounded text-xs block mt-1">
                      {selectedEntry.hash}
                    </code>
                  </div>
                  {selectedEntry.previousHash && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Previous Hash:</span>
                      <code className="ml-2 bg-gray-100 px-2 py-0.5 rounded text-xs block mt-1">
                        {selectedEntry.previousHash}
                      </code>
                    </div>
                  )}
                  {selectedEntry.data && Object.keys(selectedEntry.data).length > 0 && (
                    <div className="col-span-2">
                      <span className="text-gray-500 block mb-2">Data Changes:</span>
                      <pre className="bg-gray-100 p-3 rounded-lg text-xs overflow-auto max-h-40">
                        {JSON.stringify(selectedEntry.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'verify' && (
        <Card className="p-6">
          <h3 className="font-medium mb-4">Verify Single Entry</h3>
          <div className="max-w-md space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Entry ID or Hash</label>
              <Input placeholder="Enter entry ID or hash" />
            </div>
            <Button>
              <Shield className="h-4 w-4 mr-2" />
              Verify Entry
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'report' && (
        <Card className="p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Compliance Report
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <Input
                type="date"
                value={reportOptions.startDate}
                onChange={(e) =>
                  setReportOptions({ ...reportOptions, startDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <Input
                type="date"
                value={reportOptions.endDate}
                onChange={(e) =>
                  setReportOptions({ ...reportOptions, endDate: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Entity Types</label>
              <div className="flex flex-wrap gap-2">
                {['portal', 'widget', 'user', 'integration', 'workspace'].map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setReportOptions({
                        ...reportOptions,
                        entityTypes: reportOptions.entityTypes.includes(type)
                          ? reportOptions.entityTypes.filter((t) => t !== type)
                          : [...reportOptions.entityTypes, type],
                      })
                    }
                    className={`px-3 py-1 rounded-full text-sm capitalize ${
                      reportOptions.entityTypes.includes(type)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Actions</label>
              <div className="flex flex-wrap gap-2">
                {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'].map((action) => (
                  <button
                    key={action}
                    onClick={() =>
                      setReportOptions({
                        ...reportOptions,
                        actions: reportOptions.actions.includes(action)
                          ? reportOptions.actions.filter((a) => a !== action)
                          : [...reportOptions.actions, action],
                      })
                    }
                    className={`px-3 py-1 rounded-full text-sm ${
                      reportOptions.actions.includes(action)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Button onClick={handleGenerateReport}>
                <Download className="h-4 w-4 mr-2" />
                Generate & Download Report
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
