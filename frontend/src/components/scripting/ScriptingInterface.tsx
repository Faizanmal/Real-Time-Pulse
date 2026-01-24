'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Code, Play, Save, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Script {
  id: string;
  name: string;
  language: string;
  code: string;
  status: 'idle' | 'running' | 'success' | 'error';
  lastRun: string | null;
  output: string;
}

export default function ScriptingInterface() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const fetchScripts = useCallback(async () => {
    try {
      const response = await fetch('/api/scripting');
      const data = await response.json();
      setScripts(data);
      if (data.length > 0 && !selectedScript) {
        setSelectedScript(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch scripts:', error);
    }
  }, [selectedScript]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    if (selectedScript) {
      setCode(selectedScript.code);
      setOutput(selectedScript.output);
    }
  }, [selectedScript]);

  const createScript = async () => {
    const newScript = {
      name: 'New Script',
      language: 'javascript',
      code: '// Write your script here\nconsole.log("Hello World");'
    };
    try {
      const response = await fetch('/api/scripting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newScript)
      });
      const data = await response.json();
      setScripts([...scripts, data]);
      setSelectedScript(data);
    } catch (error) {
      console.error('Failed to create script:', error);
    }
  };

  const saveScript = async () => {
    if (!selectedScript) return;
    try {
      await fetch(`/api/scripting/${selectedScript.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      fetchScripts();
    } catch (error) {
      console.error('Failed to save script:', error);
    }
  };

  const runScript = async () => {
    if (!selectedScript) return;
    setIsRunning(true);
    setOutput('Running...\n');
    try {
      const response = await fetch(`/api/scripting/${selectedScript.id}/run`, {
        method: 'POST'
      });
      const data = await response.json();
      setOutput(data.output);
      fetchScripts();
    } catch (error) {
      setOutput(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const deleteScript = async (id: string) => {
    try {
      await fetch(`/api/scripting/${id}`, { method: 'DELETE' });
      fetchScripts();
      if (selectedScript?.id === id) {
        setSelectedScript(null);
      }
    } catch (error) {
      console.error('Failed to delete script:', error);
    }
  };

  const languages = ['javascript', 'python', 'sql', 'bash'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Code className="h-8 w-8" />
            Scripting Interface
          </h1>
          <p className="text-muted-foreground">Write and execute custom scripts</p>
        </div>
        <Button onClick={createScript}>
          <Code className="h-4 w-4 mr-2" />
          New Script
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scripts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scripts.map((script) => (
                <div
                  key={script.id}
                  className={`p-3 border rounded cursor-pointer hover:bg-secondary transition-colors ${
                    selectedScript?.id === script.id ? 'bg-secondary' : ''
                  }`}
                  onClick={() => setSelectedScript(script)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{script.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteScript(script.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{script.language}</Badge>
                    {script.status === 'success' && <CheckCircle className="h-3 w-3 text-green-600" />}
                    {script.status === 'error' && <AlertCircle className="h-3 w-3 text-red-600" />}
                    {script.status === 'running' && <Clock className="h-3 w-3 text-blue-600 animate-pulse" />}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-3">
          {selectedScript ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Input
                      value={selectedScript.name}
                      onChange={(e) => setSelectedScript({ ...selectedScript, name: e.target.value })}
                      className="font-semibold text-lg mb-2"
                    />
                    <Select value={selectedScript.language} onValueChange={(value) => setSelectedScript({ ...selectedScript, language: value })}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map(lang => (
                          <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={saveScript}>
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" onClick={runScript} disabled={isRunning}>
                      <Play className="h-3 w-3 mr-1" />
                      {isRunning ? 'Running...' : 'Run'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Code Editor</Label>
                    <Textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="font-mono text-sm min-h-[300px]"
                      placeholder="Write your code here..."
                    />
                  </div>
                  <div>
                    <Label>Output</Label>
                    <pre className="p-4 bg-secondary rounded text-sm min-h-[150px] overflow-auto">
                      {output || 'No output yet. Run the script to see results.'}
                    </pre>
                  </div>
                  {selectedScript.lastRun && (
                    <div className="text-xs text-muted-foreground">
                      Last run: {new Date(selectedScript.lastRun).toLocaleString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Code className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a script or create a new one</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
