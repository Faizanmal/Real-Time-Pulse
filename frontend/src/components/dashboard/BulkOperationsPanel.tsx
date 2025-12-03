'use client';

import { useState } from 'react';
import {
  Copy,
  Trash2,
  RefreshCw,
  CheckSquare,
  Square,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  MoreHorizontal,
  FileSpreadsheet,
  Layout,
  Bell,
} from 'lucide-react';
import {
  bulkOperationsApi,
  BulkOperationResult,
  BulkUpdateWidgetsDto,
} from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Label } from '@/src/components/ui/label';
import { Switch } from '@/src/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/src/components/ui/accordion';
import { Progress } from '@/src/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface BulkItem {
  id: string;
  name: string;
  type: 'portal' | 'widget' | 'alert';
  status?: string;
  metadata?: Record<string, unknown>;
}

interface BulkOperationsPanelProps {
  className?: string;
  items?: BulkItem[];
  onOperationComplete?: () => void;
}

export function BulkOperationsPanel({
  className,
  items = [],
  onOperationComplete,
}: BulkOperationsPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [operationResult, setOperationResult] = useState<BulkOperationResult | null>(null);
  const [operationType, setOperationType] = useState<string | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Update settings
  const [updateRefreshInterval, setUpdateRefreshInterval] = useState('');
  const [updateIsActive, setUpdateIsActive] = useState<boolean | null>(null);

  // Clone settings
  const [cloneIncludeWidgets, setCloneIncludeWidgets] = useState(true);
  const [cloneIncludeSettings, setCloneIncludeSettings] = useState(true);
  const [cloneNameSuffix, setCloneNameSuffix] = useState(' (Copy)');

  // Import file
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'portals' | 'widgets' | 'alerts'>('widgets');

  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) {
      toast.error('No items selected');
      return;
    }

    setLoading(true);
    setOperationType('update');

    try {
      const widgetIds = selectedItems
        .filter((i) => i.type === 'widget')
        .map((i) => i.id);

      const updates: BulkUpdateWidgetsDto['updates'] = {};
      if (updateRefreshInterval) {
        updates.refreshInterval = parseInt(updateRefreshInterval, 10);
      }
      if (updateIsActive !== null) {
        updates.isActive = updateIsActive;
      }

      const result = await bulkOperationsApi.updateWidgets({
        widgetIds,
        updates,
      });

      setOperationResult(result);
      setUpdateDialogOpen(false);

      if (result.success) {
        toast.success(`Updated ${result.successCount} widgets`);
        onOperationComplete?.();
      } else {
        toast.error(`Failed to update ${result.failureCount} widgets`);
      }
    } catch (error) {
      console.error('Bulk update failed:', error);
      toast.error('Bulk update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No items selected');
      return;
    }

    setLoading(true);
    setOperationType('delete');

    try {
      const widgetIds = selectedItems
        .filter((i) => i.type === 'widget')
        .map((i) => i.id);
      const portalIds = selectedItems
        .filter((i) => i.type === 'portal')
        .map((i) => i.id);
      const alertIds = selectedItems
        .filter((i) => i.type === 'alert')
        .map((i) => i.id);

      let result: BulkOperationResult | null = null;

      if (widgetIds.length > 0) {
        result = await bulkOperationsApi.deleteWidgets(widgetIds);
      }
      if (portalIds.length > 0) {
        const portalResult = await bulkOperationsApi.deletePortals(portalIds);
        result = result
          ? { ...result, successCount: result.successCount + portalResult.successCount }
          : portalResult;
      }
      if (alertIds.length > 0) {
        const alertResult = await bulkOperationsApi.deleteAlerts(alertIds);
        result = result
          ? { ...result, successCount: result.successCount + alertResult.successCount }
          : alertResult;
      }

      if (result) {
        setOperationResult(result);
        setDeleteDialogOpen(false);
        setSelectedIds(new Set());

        if (result.success) {
          toast.success(`Deleted ${result.successCount} items`);
          onOperationComplete?.();
        } else {
          toast.error(`Failed to delete ${result.failureCount} items`);
        }
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast.error('Bulk delete failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkClone = async () => {
    const portalIds = selectedItems
      .filter((i) => i.type === 'portal')
      .map((i) => i.id);

    if (portalIds.length === 0) {
      toast.error('No portals selected');
      return;
    }

    setLoading(true);
    setOperationType('clone');

    try {
      const result = await bulkOperationsApi.clonePortals({
        portalIds,
        options: {
          includeWidgets: cloneIncludeWidgets,
          includeSettings: cloneIncludeSettings,
          nameSuffix: cloneNameSuffix,
        },
      });

      setOperationResult(result);
      setCloneDialogOpen(false);

      if (result.success) {
        toast.success(`Cloned ${result.successCount} portals`);
        onOperationComplete?.();
      } else {
        toast.error(`Failed to clone ${result.failureCount} portals`);
      }
    } catch (error) {
      console.error('Bulk clone failed:', error);
      toast.error('Bulk clone failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);
    setOperationType('import');

    try {
      const result = await bulkOperationsApi.importFromCSV(importFile, importType);
      
      setImportDialogOpen(false);
      setImportFile(null);

      if (result.success) {
        toast.success(`Imported ${result.imported} items`);
        onOperationComplete?.();
      } else {
        toast.error(`Import completed with ${result.errors.length} errors`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'portals' | 'widgets' | 'alerts') => {
    setLoading(true);
    setOperationType('export');

    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      const blob = await bulkOperationsApi.exportToCSV(type, ids);

      // Download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Exported ${type}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'portal':
        return <Layout className="h-4 w-4" />;
      case 'widget':
        return <FileSpreadsheet className="h-4 w-4" />;
      case 'alert':
        return <Bell className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Bulk Operations</h3>
            <p className="text-sm text-gray-500">
              Select items to perform bulk actions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedIds.size} of {items.length} selected
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pb-4 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={items.length === 0}
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 mr-2" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>

          <div className="h-6 w-px bg-gray-200" />

          {/* Update Dialog */}
          <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.size === 0 || loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Update
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Update</DialogTitle>
                <DialogDescription>
                  Update {selectedIds.size} selected items
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Refresh Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={updateRefreshInterval}
                    onChange={(e) => setUpdateRefreshInterval(e.target.value)}
                    placeholder="Leave empty to keep current"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active Status</Label>
                  <Select
                    value={updateIsActive === null ? 'unchanged' : updateIsActive.toString()}
                    onValueChange={(v) =>
                      setUpdateIsActive(v === 'unchanged' ? null : v === 'true')
                    }
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unchanged">Unchanged</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkUpdate} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Update {selectedIds.size} Items
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Clone Dialog */}
          <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.size === 0 || loading}
              >
                <Copy className="h-4 w-4 mr-2" />
                Clone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Clone Portals</DialogTitle>
                <DialogDescription>
                  Clone {selectedItems.filter((i) => i.type === 'portal').length} selected
                  portals
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name Suffix</Label>
                  <Input
                    value={cloneNameSuffix}
                    onChange={(e) => setCloneNameSuffix(e.target.value)}
                    placeholder="e.g., (Copy)"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Include Widgets</Label>
                  <Switch
                    checked={cloneIncludeWidgets}
                    onCheckedChange={setCloneIncludeWidgets}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Include Settings</Label>
                  <Switch
                    checked={cloneIncludeSettings}
                    onCheckedChange={setCloneIncludeSettings}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkClone} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Clone Portals
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0 || loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Bulk Delete</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {selectedIds.size} items? This action
                  cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                    >
                      {getTypeIcon(item.type)}
                      <span className="text-sm">{item.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {item.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleBulkDelete} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Delete {selectedIds.size} Items
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="h-6 w-px bg-gray-200" />

          {/* Import/Export */}
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import from CSV</DialogTitle>
                <DialogDescription>Upload a CSV file to bulk import items</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Import Type</Label>
                  <Select
                    value={importType}
                    onValueChange={(v) => setImportType(v as typeof importType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portals">Portals</SelectItem>
                      <SelectItem value="widgets">Widgets</SelectItem>
                      <SelectItem value="alerts">Alerts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CSV File</Label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!importFile || loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('portals')}>
                <Layout className="h-4 w-4 mr-2" />
                Export Portals
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('widgets')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Widgets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('alerts')}>
                <Bell className="h-4 w-4 mr-2" />
                Export Alerts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Items List */}
        <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No items to display</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors',
                  selectedIds.has(item.id) && 'bg-blue-50'
                )}
                onClick={() => handleSelectItem(item.id)}
              >
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => handleSelectItem(item.id)}
                />
                <div className="text-gray-400">{getTypeIcon(item.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.id}</div>
                </div>
                <Badge variant="secondary">{item.type}</Badge>
                {item.status && (
                  <Badge
                    variant={item.status === 'active' ? 'default' : 'secondary'}
                  >
                    {item.status}
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>

        {/* Operation Result */}
        {operationResult && (
          <Card className="p-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              {operationResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <span className="font-medium">
                {operationType?.charAt(0).toUpperCase()}
                {operationType?.slice(1)} Result
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600">
                ✓ {operationResult.successCount} succeeded
              </span>
              {operationResult.failureCount > 0 && (
                <span className="text-red-600">
                  ✗ {operationResult.failureCount} failed
                </span>
              )}
            </div>

            {operationResult.failureCount > 0 && (
              <Accordion type="single" collapsible className="mt-2">
                <AccordionItem value="errors">
                  <AccordionTrigger className="text-sm">
                    View Errors
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1">
                      {operationResult.results
                        .filter((r) => !r.success)
                        .map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 text-sm text-red-600"
                          >
                            <XCircle className="h-4 w-4" />
                            <span>{r.id}</span>
                            {r.error && (
                              <span className="text-gray-500">- {r.error}</span>
                            )}
                          </div>
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setOperationResult(null)}
            >
              Dismiss
            </Button>
          </Card>
        )}
      </div>
    </Card>
  );
}
