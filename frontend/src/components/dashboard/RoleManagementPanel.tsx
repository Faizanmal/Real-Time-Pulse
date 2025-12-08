'use client';

import React, { useState, useEffect } from 'react';
import { useRoles } from '@/hooks/useAdvancedFeatures';
import type { Role } from '@/hooks/useAdvancedFeatures.types';
import { roleManagementAPI } from '@/lib/advanced-features-api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Key,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Copy,
  Search,
} from 'lucide-react';

interface Permission {
  resourceType: string;
  actions: string[];
  resourceId?: string;
}

// Removed unused RoleAssignment interface

const RESOURCE_TYPES = [
  { value: 'portal', label: 'Portals' },
  { value: 'widget', label: 'Widgets' },
  { value: 'integration', label: 'Integrations' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'user', label: 'Users' },
  { value: 'alert', label: 'Alerts' },
  { value: 'report', label: 'Reports' },
];

const ACTIONS = ['view', 'create', 'edit', 'delete', 'share', 'export', 'admin'];

export function RoleManagementPanel() {
  const { roles, templates, loading, fetchRoles, createRole } = useRoles();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRole, setNewRole] = useState<Partial<Role>>({ name: '', permissions: [] as Permission[] });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'roles' | 'templates' | 'assignments'>('roles');


  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleCreateRole = async () => {
    if (!newRole.name) return;
    
    try {
      await createRole(newRole);
      setIsCreating(false);
      setNewRole({ name: '', permissions: [] });
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    
    try {
      await roleManagementAPI.deleteRole(roleId);
      fetchRoles();
      if (selectedRole?.id === roleId) {
        setSelectedRole(null);
      }
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  const togglePermission = (resourceType: string, action: string) => {
    setNewRole((prev) => {
      const permissions = [...(prev.permissions || [])];
      const existingPermIndex = permissions.findIndex((p) => p.resourceType === resourceType);
      
      if (existingPermIndex >= 0) {
        const perm = permissions[existingPermIndex];
        if (perm.actions.includes(action)) {
          perm.actions = perm.actions.filter((a) => a !== action);
          if (perm.actions.length === 0) {
            permissions.splice(existingPermIndex, 1);
          }
        } else {
          perm.actions.push(action);
        }
      } else {
        permissions.push({ resourceType, actions: [action] });
      }
      
      return { ...prev, permissions };
    });
  };

  const hasPermission = (resourceType: string, action: string) => {
    return newRole.permissions?.some(
      (p) => p.resourceType === resourceType && p.actions.includes(action)
    );
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Shield className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Role Management</h2>
            <p className="text-sm text-gray-600">Manage roles and permissions</p>
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {(['roles', 'templates', 'assignments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search roles..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {loading ? (
              <Card className="p-4 text-center text-gray-500">Loading...</Card>
            ) : activeTab === 'roles' ? (
              filteredRoles.map((role) => (
                <Card
                  key={role.id}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedRole?.id === role.id
                      ? 'ring-2 ring-purple-500 bg-purple-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedRole(role)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Key className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {role.name}
                          {role.isSystemRole && (
                            <Badge variant="outline" className="text-xs">System</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {role.permissions?.length || 0} permissions
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </Card>
              ))
            ) : activeTab === 'templates' ? (
              templates.map((template) => (
                <Card
                  key={template.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                    const permissions = (template.permissions || []).map((p) => {
                      if (!p) return null;
                      if (typeof p === 'string') {
                        // Support formats like 'resourceType:action' or simple actions
                        const parts = p.split(':');
                        if (parts.length === 2) {
                          return { resourceType: parts[0], actions: [parts[1]] } as Permission;
                        }
                        return { resourceType: '*', actions: [p] } as Permission;
                      }
                      return p as Permission;
                    }).filter(Boolean) as Permission[];

                    setNewRole({
                      name: `Custom ${template.name}`,
                      description: template.description,
                      permissions,
                    });
                    setIsCreating(true);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-gray-500">{template.description}</div>
                    </div>
                    <Copy className="h-4 w-4 text-gray-400" />
                  </div>
                </Card>
              ))
            ) : null}
          </div>
        </div>

        {/* Role Details / Create Form */}
        <div className="lg:col-span-2">
          {isCreating ? (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Role</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Role Name</label>
                  <Input
                    placeholder="e.g., Editor, Viewer, Manager"
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Input
                    placeholder="Describe this role's purpose"
                    value={newRole.description || ''}
                    onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">Permissions</label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Resource</th>
                          {ACTIONS.map((action) => (
                            <th key={action} className="px-2 py-2 text-center font-medium capitalize">
                              {action}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {RESOURCE_TYPES.map((resource) => (
                          <tr key={resource.value} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{resource.label}</td>
                            {ACTIONS.map((action) => (
                              <td key={action} className="px-2 py-2 text-center">
                                <button
                                  onClick={() => togglePermission(resource.value, action)}
                                  className={`p-1 rounded ${
                                    hasPermission(resource.value, action)
                                      ? 'text-green-600 bg-green-50'
                                      : 'text-gray-300 hover:text-gray-400'
                                  }`}
                                >
                                  {hasPermission(resource.value, action) ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                  ) : (
                                    <XCircle className="h-5 w-5" />
                                  )}
                                </button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRole} disabled={!newRole.name}>
                    Create Role
                  </Button>
                </div>
              </div>
            </Card>
          ) : selectedRole ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">{selectedRole.name}</h3>
                  <p className="text-sm text-gray-500">{selectedRole.description}</p>
                </div>
                {!selectedRole.isSystemRole && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteRole(selectedRole.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Permissions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedRole.permissions?.map((perm, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Key className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">{perm.resourceType}</span>
                        <span className="text-gray-400">:</span>
                        <span className="text-sm text-gray-600">
                          {perm.actions.join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      Created: {selectedRole.createdAt ? new Date(selectedRole.createdAt).toLocaleDateString() : '—'}
                    </span>
                    <span>
                      Updated: {selectedRole.updatedAt ? new Date(selectedRole.updatedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <Shield className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600">Select a role</h3>
              <p className="text-sm text-gray-500 mt-1">
                Choose a role from the list to view its details and permissions
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
