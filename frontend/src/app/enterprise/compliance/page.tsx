'use client';

import React, { useState, useEffect } from 'react';
import { apiResources } from '@/lib/api-client';
import { Shield, CheckCircle, XCircle, FileText, Search, Download, RefreshCw, Box } from 'lucide-react';

export default function ComplianceCenterPage() {
    const [integrityIds, setIntegrityIds] = useState<{ isValid: boolean; blocksVerified: number; entriesVerified: number; verifiedAt: string } | null>(null);
    const [verificationEntryId, setVerificationEntryId] = useState('');
    const [verificationResult, setVerificationResult] = useState<{ valid?: boolean; error?: boolean; entry?: { timestamp: string; hash: string }; block?: { id: string } } | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isLoadingIntegrity, setIsLoadingIntegrity] = useState(false);

    // Fetch initial integrity status
    const fetchIntegrity = async () => {
        setIsLoadingIntegrity(true);
        try {
            const data = await apiResources.blockchain.verifyIntegrity();
            setIntegrityIds(data);
        } catch (error) {
            console.error('Failed to fetch integrity:', error);
        } finally {
            setIsLoadingIntegrity(false);
        }
    };

    useEffect(() => {
        fetchIntegrity();
    }, []);

    const handleVerifyEntry = async () => {
        if (!verificationEntryId) return;
        setIsVerifying(true);
        setVerificationResult(null);
        try {
            const result = await apiResources.blockchain.verifyEntry(verificationEntryId);
            setVerificationResult(result);
        } catch (error) {
            console.error('Verification failed:', error);
            setVerificationResult({ error: true });
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="p-8 space-y-8 min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        Compliance Center
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">
                        Immutable Audit Logs & Blockchain Verification
                    </p>
                </div>
                <button
                    onClick={fetchIntegrity}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoadingIntegrity ? 'animate-spin' : ''}`} />
                    Refresh Status
                </button>
            </div>

            {/* Hero Status Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 p-6 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Shield className="w-48 h-48" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5" /> System Integrity Status
                        </h2>

                        {integrityIds ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    {integrityIds.isValid ? (
                                        <CheckCircle className="w-12 h-12 text-green-300" />
                                    ) : (
                                        <XCircle className="w-12 h-12 text-red-300" />
                                    )}
                                    <div>
                                        <div className="text-3xl font-bold">
                                            {integrityIds.isValid ? 'Secure & Verified' : 'Integrity Issues Detected'}
                                        </div>
                                        <div className="text-indigo-100">
                                            Last verified: {new Date(integrityIds.verifiedAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                                        <div className="text-indigo-200 text-sm">Verified Blocks</div>
                                        <div className="text-2xl font-bold">{integrityIds.blocksVerified}</div>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                                        <div className="text-indigo-200 text-sm">Verified Entries</div>
                                        <div className="text-2xl font-bold">{integrityIds.entriesVerified}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-pulse flex space-x-4">
                                <div className="h-12 w-12 bg-white/20 rounded-full"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-white/20 rounded w-1/2"></div>
                                    <div className="h-4 bg-white/20 rounded w-3/4"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Quick Actions</h3>
                    <div className="space-y-3">
                        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition group">
                            <span className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-indigo-500" />
                                <span>Generate Report</span>
                            </span>
                            <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition group">
                            <span className="flex items-center gap-3">
                                <Download className="w-5 h-5 text-indigo-500" />
                                <span>Export Chain</span>
                            </span>
                            <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition group">
                            <span className="flex items-center gap-3">
                                <Box className="w-5 h-5 text-indigo-500" />
                                <span>View Validations</span>
                            </span>
                            <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Verification Tool */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Search className="w-5 h-5 text-indigo-500" /> Verify Transaction
                    </h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Enter Audit Entry ID (e.g. audit_173...)"
                            value={verificationEntryId}
                            onChange={(e) => setVerificationEntryId(e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                            onClick={handleVerifyEntry}
                            disabled={isVerifying || !verificationEntryId}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {isVerifying ? 'Checking...' : 'Verify'}
                        </button>
                    </div>

                    {/* Verification Result */}
                    {verificationResult && (
                        <div className={`mt-6 p-4 rounded-xl border ${verificationResult.valid ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                                verificationResult.error ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                                    'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}>
                            {verificationResult.valid ? (
                                <div>
                                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold mb-2">
                                        <CheckCircle className="w-5 h-5" /> Authenticity Verified
                                    </div>
                                    <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                        <p>Timestamp: {verificationResult.entry?.timestamp ? new Date(verificationResult.entry.timestamp).toLocaleString() : 'N/A'}</p>
                                        <p>Block ID: <span className="font-mono text-xs">{verificationResult.block?.id || 'N/A'}</span></p>
                                        <p>Hash: <span className="font-mono text-xs break-all">{verificationResult.entry?.hash || 'N/A'}</span></p>
                                    </div>
                                </div>
                            ) : verificationResult.error ? (
                                <div className="text-red-600 dark:text-red-400 flex items-center gap-2">
                                    <XCircle className="w-5 h-5" /> Entry not found or verification failed.
                                </div>
                            ) : (
                                <div className="text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                                    <XCircle className="w-5 h-5" /> Invalid Entry Hash
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Info Card */}
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-semibold mb-4">How it works</h3>
                    <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex gap-3">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                            <p>Every action in the workspace creates an immutable audit entry that is cryptographically hashed.</p>
                        </li>
                        <li className="flex gap-3">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                            <p>Entries are grouped into blocks (Merkle Trees) and chained together using SHA-256 hashing.</p>
                        </li>
                        <li className="flex gap-3">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                            <p>Any tampering with past data breaks the cryptographic chain, making it immediately detectable.</p>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
