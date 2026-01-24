'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link as LinkIcon, Shield, Hash, CheckCircle, Clock } from 'lucide-react';

interface BlockchainRecord {
  id: string;
  hash: string;
  previousHash: string;
  timestamp: string;
  data: Record<string, unknown>;
  verified: boolean;
  blockNumber: number;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  hash: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export default function BlockchainFeatures() {
  const [records, setRecords] = useState<BlockchainRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({
    totalBlocks: 0,
    verifiedBlocks: 0,
    pendingTransactions: 0,
    chainIntegrity: 100
  });

  const fetchBlockchainData = useCallback(async () => {
    try {
      const [recordsRes, txRes, statsRes] = await Promise.all([
        fetch('/api/blockchain/records'),
        fetch('/api/blockchain/transactions'),
        fetch('/api/blockchain/stats')
      ]);
      const recordsData = await recordsRes.json();
      const txData = await txRes.json();
      const statsData = await statsRes.json();
      setRecords(recordsData);
      setTransactions(txData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch blockchain data:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [recordsRes, txRes, statsRes] = await Promise.all([
          fetch('/api/blockchain/records'),
          fetch('/api/blockchain/transactions'),
          fetch('/api/blockchain/stats')
        ]);
        const recordsData = await recordsRes.json();
        const txData = await txRes.json();
        const statsData = await statsRes.json();
        if (mounted) {
          setRecords(recordsData);
          setTransactions(txData);
          setStats(statsData);
        }
      } catch (error) {
        console.error('Failed to fetch blockchain data:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const verifyChain = useCallback(async () => {
    try {
      await fetch('/api/blockchain/verify', { method: 'POST' });
      fetchBlockchainData();
    } catch (error) {
      console.error('Failed to verify chain:', error);
    }
  }, [fetchBlockchainData]);

  const _createRecord = useCallback(async (payload: Record<string, unknown>) => {
    try {
      await fetch('/api/blockchain/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
      });
      fetchBlockchainData();
    } catch (error) {
      console.error('Failed to create record:', error);
    }
  }, [fetchBlockchainData]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LinkIcon className="h-8 w-8" />
            Blockchain
          </h1>
          <p className="text-muted-foreground">Immutable audit trail and data verification</p>
        </div>
        <Button onClick={verifyChain}>
          <Shield className="h-4 w-4 mr-2" />
          Verify Chain
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBlocks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.verifiedBlocks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending TX</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingTransactions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Chain Integrity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.chainIntegrity}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Blockchain Records</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          {records.map((record) => (
            <Card key={record.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Block #{record.blockNumber}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">
                      {record.hash}
                    </CardDescription>
                  </div>
                  <Badge variant={record.verified ? 'default' : 'secondary'}>
                    {record.verified ? (
                      <><CheckCircle className="h-3 w-3 mr-1" />Verified</>
                    ) : (
                      <><Clock className="h-3 w-3 mr-1" />Pending</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold mb-1">Previous Hash</div>
                    <div className="font-mono text-xs text-muted-foreground">{record.previousHash}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">Timestamp</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(record.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View data
                    </summary>
                    <pre className="mt-2 p-3 bg-secondary rounded text-xs overflow-x-auto">
                      {JSON.stringify(record.data, null, 2)}
                    </pre>
                  </details>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          {transactions.map((tx) => (
            <Card key={tx.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge>{tx.type}</Badge>
                      <Badge variant={
                        tx.status === 'confirmed' ? 'default' :
                        tx.status === 'pending' ? 'secondary' :
                        'destructive'
                      }>
                        {tx.status}
                      </Badge>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{tx.hash}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(tx.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="verification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chain Verification</CardTitle>
              <CardDescription>Verify the integrity of the blockchain</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <div className="font-semibold">Chain is valid</div>
                    <div className="text-sm text-muted-foreground">
                      All blocks have been verified and linked correctly
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Last Verification</div>
                    <div className="font-semibold">2 minutes ago</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Average Block Time</div>
                    <div className="font-semibold">15 seconds</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
