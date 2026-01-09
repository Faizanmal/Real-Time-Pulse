'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scriptingApi, type Script, type ScriptExecution, type ValidationResult } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Code, Plus, RefreshCw, Edit, Trash2, Play, CheckCircle2, 
  XCircle, Clock, FileCode, Terminal, AlertTriangle, History
} from 'lucide-react';
import { toast } from 'sonner';

const languageOptions = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'lua', label: 'Lua' },
];

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [executions, setExecutions] = useState<ScriptExecution[]>([]);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLanguage, setFormLanguage] = useState<'javascript' | 'python'>('javascript');
  const [formCode, setFormCode] = useState('');
  const [formTrigger, setFormTrigger] = useState('manual');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const loadScripts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scriptingApi.getAll();
      setScripts(data);
    } catch (error) {
      console.error('Failed to load scripts:', error);
      toast.error('Failed to load scripts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormLanguage('javascript');
    setFormCode('');
    setFormTrigger('manual');
    setEditingScript(null);
    setValidationResult(null);
  };

  const openEditDialog = (script: Script) => {
    setEditingScript(script);
    setFormName(script.name);
    setFormDescription(script.description || '');
    setFormLanguage(script.language);
    setFormCode(script.code);
    setFormTrigger(script.trigger || 'manual');
    setCreateDialogOpen(true);
  };

  const handleValidate = async () => {
    if (!formCode.trim()) {
      toast.error('Please enter some code');
      return;
    }

    setValidating(true);
    try {
      const result = await scriptingApi.validate({ code: formCode, language: formLanguage });
      setValidationResult(result);
      if (result.valid) {
        toast.success('Script is valid');
      } else {
        toast.error('Script has errors');
      }
    } catch (error) {
      console.error('Validation failed:', error);
      toast.error('Failed to validate script');
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a script name');
      return;
    }
    if (!formCode.trim()) {
      toast.error('Please enter script code');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDescription || undefined,
        language: formLanguage,
        code: formCode,
        trigger: formTrigger,
      };

      if (editingScript) {
        await scriptingApi.update(editingScript.id, payload);
        toast.success('Script updated');
      } else {
        await scriptingApi.create(payload);
        toast.success('Script created');
      }
      setCreateDialogOpen(false);
      resetForm();
      loadScripts();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save script');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this script?')) return;

    try {
      await scriptingApi.delete(id);
      toast.success('Script deleted');
      loadScripts();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete script');
    }
  };

  const handleRun = async (id: string) => {
    setRunning(id);
    try {
      const result = await scriptingApi.execute(id);
      toast.success(`Execution ${result.status}`);
      loadScripts();
    } catch (error) {
      console.error('Execution failed:', error);
      toast.error('Failed to execute script');
    } finally {
      setRunning(null);
    }
  };

  const viewExecutions = async (scriptId: string) => {
    try {
      const data = await scriptingApi.getExecutions(scriptId);
      setExecutions(data);
      setExecutionDialogOpen(true);
    } catch (error) {
      console.error('Failed to load executions:', error);
      toast.error('Failed to load execution history');
    }
  };

  const stats = {
    total: scripts.length,
    javascript: scripts.filter(s => s.language === 'javascript').length,
    python: scripts.filter(s => s.language === 'python').length,
    lastRun: scripts.find(s => s.lastExecutedAt)?.lastExecutedAt,
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
            <Code className="h-8 w-8 text-purple-500" />
            Custom Scripts
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage automation scripts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadScripts} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Script
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingScript ? 'Edit Script' : 'Create Script'}</DialogTitle>
                <DialogDescription>
                  Write custom automation scripts for your workflows
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Script Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Data Transformer"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={formLanguage} onValueChange={(value) => setFormLanguage(value as 'javascript' | 'python')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languageOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of what this script does"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <Select value={formTrigger} onValueChange={setFormTrigger}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="schedule">Scheduled</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="event">Event-based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="code" className="flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      Code
                    </Label>
                    <Button variant="outline" size="sm" onClick={handleValidate} disabled={validating}>
                      {validating ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      Validate
                    </Button>
                  </div>
                  <Textarea
                    id="code"
                    placeholder={formLanguage === 'javascript' 
                      ? '// Your JavaScript code here\nfunction process(data) {\n  return data;\n}'
                      : formLanguage === 'python'
                      ? '# Your Python code here\ndef process(data):\n    return data'
                      : '-- Your Lua code here\nfunction process(data)\n  return data\nend'
                    }
                    value={formCode}
                    onChange={(e) => { setFormCode(e.target.value); setValidationResult(null); }}
                    rows={12}
                    className="font-mono text-sm"
                  />
                  {validationResult && (
                    <div className={`p-3 rounded-lg text-sm ${validationResult.valid ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'}`}>
                      {validationResult.valid ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Script is valid and ready to run
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="h-4 w-4" />
                            Validation failed
                          </div>
                          {validationResult.errors?.map((err, i) => (
                            <p key={i} className="ml-6">• {err.message}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingScript ? 'Update' : 'Create'
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
                <p className="text-sm text-muted-foreground">Total Scripts</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Code className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">JavaScript</p>
                <p className="text-2xl font-bold">{stats.javascript}</p>
              </div>
              <FileCode className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Python</p>
                <p className="text-2xl font-bold">{stats.python}</p>
              </div>
              <Terminal className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Run</p>
                <p className="text-lg font-bold">
                  {stats.lastRun ? new Date(stats.lastRun).toLocaleDateString() : 'Never'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Script List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Scripts</CardTitle>
          <CardDescription>Manage and execute your custom scripts</CardDescription>
        </CardHeader>
        <CardContent>
          {scripts.length === 0 ? (
            <div className="text-center py-12">
              <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No scripts yet</h3>
              <p className="text-muted-foreground mb-4">Create your first automation script</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Script
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {scripts.map((script, index) => (
                  <motion.div
                    key={script.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                        <FileCode className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">{script.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{script.language}</Badge>
                          <Badge variant="secondary">{script.trigger || 'manual'}</Badge>
                          {script.lastExecutedAt && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last run: {new Date(script.lastExecutedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {script.description && (
                          <p className="text-sm text-muted-foreground mt-1">{script.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => viewExecutions(script.id)} 
                        title="Execution History"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRun(script.id)} 
                        disabled={running === script.id}
                        className="gap-1"
                      >
                        {running === script.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Run
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(script)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(script.id)} className="text-red-500 hover:text-red-600" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution History Dialog */}
      <Dialog open={executionDialogOpen} onOpenChange={setExecutionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
            <DialogDescription>
              Previous script runs and their results
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {executions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No executions yet</p>
            ) : (
              <div className="space-y-2">
                {executions.map((exec) => (
                  <div key={exec.id} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={exec.status === 'completed' ? 'default' : exec.status === 'failed' ? 'destructive' : 'secondary'}>
                        {exec.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(exec.startedAt).toLocaleString()}
                      </span>
                    </div>
                    {exec.duration && (
                      <p className="text-xs text-muted-foreground">
                        Duration: {exec.duration}ms
                      </p>
                    )}
                    {exec.error && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-800 dark:text-red-300">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        {exec.error}
                      </div>
                    )}
                    {exec.output && (
                      <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                        {typeof exec.output === 'string' ? exec.output : JSON.stringify(exec.output, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
