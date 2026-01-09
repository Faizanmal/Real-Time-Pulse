'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { blockchainApi, type BlockchainAuditEntry, type Block, type BlockchainVerification } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, RefreshCw, CheckCircle2, XCircle, Clock, Link2,
  Search, FileText, Lock, Hash, Database, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

export default function BlockchainPage() {
  const [entries, setEntries] = useState<BlockchainAuditEntry[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyEntryId, setVerifyEntryId] = useState('');
  const [verification, setVerification] = useState<BlockchainVerification | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesData, blocksData] = await Promise.all([
        blockchainApi.getAllAuditEntries(),
        blockchainApi.getBlocks(),
      ]);
      setEntries(entriesData);
      setBlocks(blocksData);
    } catch (error) {
      console.error('Failed to load blockchain data:', error);
      toast.error('Failed to load blockchain data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerify = async () => {
    if (!verifyEntryId.trim()) {
      toast.error('Please enter an entry ID or hash');
      return;
    }

    setVerifying(true);
    try {
      const result = await blockchainApi.verifyEntry(verifyEntryId);
      setVerification(result as BlockchainVerification);
      if (result.valid) {
        toast.success('Entry verified successfully');
      } else {
        toast.error('Verification failed');
      }
    } catch (error) {
      console.error('Verification failed:', error);
      toast.error('Failed to verify entry');
      setVerification(null);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyChain = async () => {
    try {
      const result = await blockchainApi.verifyChainIntegrity();
      if (result.valid) {
        toast.success('Blockchain integrity verified');
      } else {
        toast.error(`Integrity check failed: ${result.errors?.join(', ')}`);
      }
    } catch (error) {
      console.error('Chain verification failed:', error);
      toast.error('Failed to verify chain integrity');
    }
  };

  const stats = {
    totalEntries: entries.length,
    totalBlocks: blocks.length,
    verifiedEntries: entries.filter(e => e.verified).length,
    lastBlock: blocks[0]?.createdAt,
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
            <Link2 className="h-8 w-8 text-purple-500" />
            Blockchain Audit Trail
          </h1>
          <p className="text-muted-foreground mt-1">
            Immutable record of all data changes with cryptographic verification
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleVerifyChain} className="gap-2">
            <Shield className="h-4 w-4" />
            Verify Chain Integrity
          </Button>
          <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Search className="h-4 w-4" />
                Verify Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Verify Audit Entry</DialogTitle>
                <DialogDescription>
                  Enter an entry ID or hash to verify its authenticity
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="entryId">Entry ID or Hash</Label>
                  <Input
                    id="entryId"
                    placeholder="Enter entry ID or transaction hash"
                    value={verifyEntryId}
                    onChange={(e) => { setVerifyEntryId(e.target.value); setVerification(null); }}
                    className="font-mono"
                  />
                </div>
                {verification && (
                  <div className={`p-4 rounded-lg ${verification.valid ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {verification.valid ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-green-800 dark:text-green-300">Verified</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span className="font-medium text-red-800 dark:text-red-300">Verification Failed</span>
                        </>
                      )}
                    </div>
                    {verification.entry && (
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>Action: {verification.entry.action}</p>
                        <p>Entity: {verification.entry.entityType}</p>
                        <p>Timestamp: {new Date(verification.entry.timestamp).toLocaleString()}</p>
                      </div>
                    )}
                    {verification.error && (
                      <p className="text-sm text-red-600">{verification.error}</p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setVerifyDialogOpen(false); setVerification(null); setVerifyEntryId(''); }}>
                  Close
                </Button>
                <Button onClick={handleVerify} disabled={verifying}>
                  {verifying ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Verify
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{stats.totalEntries}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Blocks</p>
                <p className="text-2xl font-bold">{stats.totalBlocks}</p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold">{stats.verifiedEntries}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Block</p>
                <p className="text-lg font-bold">
                  {stats.lastBlock ? new Date(stats.lastBlock).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Audit Entries</TabsTrigger>
          <TabsTrigger value="blocks">Blocks</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <CardTitle>Audit Entries</CardTitle>
              <CardDescription>Cryptographically secured audit records</CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No audit entries</h3>
                  <p className="text-muted-foreground">Audit entries will appear here as actions are recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {entries.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg ${entry.verified ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                              {entry.verified ? (
                                <Lock className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{entry.action}</p>
                                <Badge variant="outline">{entry.entityType}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {entry.description || `${entry.action} on ${entry.entityType} ${entry.entityId}`}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(entry.timestamp).toLocaleString()}
                                </span>
                                {entry.userId && (
                                  <span>User: {entry.userId}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={entry.verified ? 'default' : 'secondary'}>
                              {entry.verified ? 'Verified' : 'Pending'}
                            </Badge>
                            {entry.hash && (
                              <p className="text-xs text-muted-foreground mt-2 font-mono truncate max-w-[200px]" title={entry.hash}>
                                <Hash className="h-3 w-3 inline mr-1" />
                                {entry.hash.substring(0, 16)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocks">
          <Card>
            <CardHeader>
              <CardTitle>Blockchain Blocks</CardTitle>
              <CardDescription>Immutable blocks containing audit entries</CardDescription>
            </CardHeader>
            <CardContent>
              {blocks.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No blocks yet</h3>
                  <p className="text-muted-foreground">Blocks are created as audit entries accumulate</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {blocks.map((block, index) => (
                    <motion.div
                      key={block.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative"
                    >
                      {/* Chain connector */}
                      {index > 0 && (
                        <div className="absolute -top-4 left-8 w-0.5 h-4 bg-purple-300 dark:bg-purple-700" />
                      )}
                      
                      <Card className="border-purple-200 dark:border-purple-800">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                                <Database className="h-6 w-6 text-purple-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">Block #{block.index || index + 1}</p>
                                  <Badge variant="outline">{block.entriesCount || 0} entries</Badge>
                                </div>
                                <div className="mt-2 space-y-1 text-sm">
                                  <p className="text-muted-foreground flex items-center gap-1">
                                    <Hash className="h-3 w-3" />
                                    <span className="font-mono">{block.hash?.substring(0, 32)}...</span>
                                  </p>
                                  {block.previousHash && (
                                    <p className="text-muted-foreground flex items-center gap-1">
                                      <Link2 className="h-3 w-3" />
                                      <span className="font-mono text-xs">Prev: {block.previousHash.substring(0, 16)}...</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {block.createdAt ? new Date(block.createdAt).toLocaleString() : 'N/A'}
                              </p>
                              {block.nonce && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Nonce: {block.nonce}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
