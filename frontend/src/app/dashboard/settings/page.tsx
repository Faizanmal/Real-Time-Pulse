'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/src/store/auth';
import { workspaceApi } from '@/src/lib/api-client';
import type { Workspace, WorkspaceMember } from '@/src/types';
import {
  Settings,
  ArrowLeft,
  Upload,
  Users,
  Palette,
  Mail,
  UserPlus,
  Trash2,
  Shield,
  Save,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'branding' | 'security'>('general');

  // Form states
  const [workspaceName, setWorkspaceName] = useState('');
  const [brandColor, setBrandColor] = useState('#8b5cf6');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router]);

  const loadData = async () => {
    if (!user?.workspaceId) return;

    try {
      const [workspaceData, membersData] = await Promise.all([
        workspaceApi.getMyWorkspace(),
        workspaceApi.getMembers(user.workspaceId),
      ]);

      setWorkspace(workspaceData);
      setMembers(membersData);
      setWorkspaceName(workspaceData.name);
      setBrandColor(workspaceData.brandColor || '#8b5cf6');
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGeneral = async () => {
    if (!workspace) return;

    try {
      const updated = await workspaceApi.updateWorkspace(workspace.id, {
        name: workspaceName,
      });
      setWorkspace(updated);
      toast.success('Workspace updated successfully');
    } catch (error) {
      console.error('Failed to update workspace:', error);
      toast.error('Failed to update workspace');
    }
  };

  const handleSaveBranding = async () => {
    if (!workspace) return;

    try {
      const updated = await workspaceApi.updateWorkspace(workspace.id, {
        brandColor,
      });
      setWorkspace(updated);
      toast.success('Branding updated successfully');
    } catch (error) {
      console.error('Failed to update branding:', error);
      toast.error('Failed to update branding');
    }
  };

  const handleUploadLogo = async () => {
    if (!workspace || !logoFile) return;

    try {
      const updated = await workspaceApi.uploadLogo(workspace.id, logoFile);
      setWorkspace(updated);
      setLogoFile(null);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Failed to upload logo:', error);
      toast.error('Failed to upload logo');
    }
  };

  const handleDeleteLogo = async () => {
    if (!workspace || !workspace.logoUrl) return;

    if (!confirm('Are you sure you want to delete the logo?')) return;

    try {
      const updated = await workspaceApi.deleteLogo(workspace.id);
      setWorkspace(updated);
      toast.success('Logo deleted successfully');
    } catch (error) {
      console.error('Failed to delete logo:', error);
      toast.error('Failed to delete logo');
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !inviteEmail) return;

    try {
      await workspaceApi.inviteMember(workspace.id, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
      toast.success('Invitation sent successfully');
      loadData();
    } catch (error) {
      console.error('Failed to invite member:', error);
      toast.error('Failed to send invitation');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!workspace) return;

    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await workspaceApi.removeMember(workspace.id, memberId);
      setMembers(members.filter((m) => m.id !== memberId));
      toast.success('Member removed successfully');
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!workspace) return;

    try {
      await workspaceApi.updateMemberRole(workspace.id, memberId, newRole);
      setMembers(
        members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      toast.success('Role updated successfully');
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-300">Loading settings...</p>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: 'general' as const, label: 'General', icon: <Settings className="h-4 w-4" /> },
    { id: 'members' as const, label: 'Members', icon: <Users className="h-4 w-4" /> },
    { id: 'branding' as const, label: 'Branding', icon: <Palette className="h-4 w-4" /> },
    { id: 'security' as const, label: 'Security', icon: <Shield className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/30 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05, x: -5 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-gray-300 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </motion.button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Settings className="h-7 w-7 text-orange-400" />
                Workspace Settings
              </h1>
              <p className="text-sm text-gray-400">{workspace?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-slate-900/30 rounded-2xl border border-slate-800/50 p-2">
              {tabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-slate-800/50'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3"
          >
            <div className="bg-slate-900/30 rounded-2xl border border-slate-800/50 p-8">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">General Settings</h2>
                    <p className="text-gray-400">Manage your workspace basic information</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Workspace Slug
                    </label>
                    <input
                      type="text"
                      value={workspace?.slug || ''}
                      disabled
                      className="w-full px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Slug cannot be changed</p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveGeneral}
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Changes
                  </motion.button>
                </div>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Team Members</h2>
                    <p className="text-gray-400">Manage workspace members and permissions</p>
                  </div>

                  {/* Invite Form */}
                  <form onSubmit={handleInviteMember} className="p-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Invite New Member
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="email"
                        placeholder="Email address"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Mail className="h-4 w-4" />
                        Send Invite
                      </motion.button>
                    </div>
                  </form>

                  {/* Members List */}
                  <div className="space-y-3">
                    {members.map((member) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                            {member.firstName?.[0] || member.email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {member.firstName} {member.lastName}
                            </p>
                            <p className="text-sm text-gray-400">{member.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                            disabled={member.id === user?.id}
                            className="px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>

                          {member.id !== user?.id && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleRemoveMember(member.id)}
                              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Branding Tab */}
              {activeTab === 'branding' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Branding</h2>
                    <p className="text-gray-400">Customize your workspace appearance</p>
                  </div>

                  {/* Logo Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Workspace Logo
                    </label>
                    <div className="flex items-center gap-4">
                      {workspace?.logoUrl ? (
                        <div className="relative w-24 h-24">
                          <Image
                            src={workspace.logoUrl}
                            alt="Logo"
                            width={96}
                            height={96}
                            className="rounded-xl object-cover border-2 border-slate-700"
                          />
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleDeleteLogo}
                            className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white"
                          >
                            <X className="h-3 w-3" />
                          </motion.button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-xl bg-slate-800/50 border-2 border-dashed border-slate-700 flex items-center justify-center">
                          <Upload className="h-8 w-8 text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="inline-block px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-white rounded-lg cursor-pointer transition-colors"
                        >
                          Choose File
                        </label>
                        {logoFile && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleUploadLogo}
                            className="ml-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                          >
                            Upload
                          </motion.button>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          PNG, JPG, GIF up to 5MB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Brand Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Brand Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="w-20 h-20 rounded-xl cursor-pointer border-2 border-slate-700"
                      />
                      <div className="flex-1">
                        <input
                          type="text"
                          value={brandColor}
                          onChange={(e) => setBrandColor(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveBranding}
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Changes
                  </motion.button>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Security Settings</h2>
                    <p className="text-gray-400">Manage workspace security and access control</p>
                  </div>

                  <div className="p-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-green-500/20 rounded-lg">
                        <Shield className="h-6 w-6 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">Two-Factor Authentication</h3>
                        <p className="text-sm text-gray-400 mb-4">
                          Add an extra layer of security to your workspace by requiring 2FA for all members.
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                        >
                          Enable 2FA (Coming Soon)
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-500/20 rounded-lg">
                        <Shield className="h-6 w-6 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">Access Logs</h3>
                        <p className="text-sm text-gray-400 mb-4">
                          View and audit all access attempts and security events in your workspace.
                        </p>
                        <Link href="/dashboard/audit">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                          >
                            View Access Logs
                          </motion.button>
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-purple-500/20 rounded-lg">
                        <Shield className="h-6 w-6 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">API Keys</h3>
                        <p className="text-sm text-gray-400 mb-4">
                          Manage API keys for programmatic access to your workspace.
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                        >
                          Manage API Keys (Coming Soon)
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
