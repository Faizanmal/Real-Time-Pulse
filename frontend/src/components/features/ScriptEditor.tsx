'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useScripts } from '@/hooks/useAdvancedFeatures';
import { scriptingAPI } from '@/lib/advanced-features-api';

interface ScriptEditorProps {
  onSave?: (script: any) => void;
  initialScript?: any;
}

export function ScriptEditor({ onSave, initialScript }: ScriptEditorProps) {
  const [name, setName] = useState(initialScript?.name || '');
  const [description, setDescription] = useState(initialScript?.description || '');
  const [code, setCode] = useState(initialScript?.code || '// Write your script here\nfunction calculate(data) {\n  return data;\n}');
  const [type, setType] = useState<'calculation' | 'transformation' | 'aggregation' | 'visualization'>(
    initialScript?.type || 'calculation'
  );
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testContext, setTestContext] = useState('{\n  "value": 100,\n  "items": [1, 2, 3, 4, 5]\n}');
  const [saving, setSaving] = useState(false);
  const [libraries, setLibraries] = useState<any[]>([]);

  useEffect(() => {
    scriptingAPI.getLibraries().then(setLibraries).catch(console.error);
  }, []);

  const handleValidate = useCallback(async () => {
    try {
      const result = await scriptingAPI.validateScript(code);
      setValidation(result);
    } catch (error: any) {
      setValidation({ valid: false, errors: [error.message] });
    }
  }, [code]);

  const handleTest = useCallback(async () => {
    try {
      const context = JSON.parse(testContext);
      // For testing, we'd need to create a temporary script first
      setTestResult({ success: true, output: 'Test execution simulated', context });
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    }
  }, [code, testContext]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const scriptData = { name, description, code, type };
      if (onSave) {
        await onSave(scriptData);
      }
    } finally {
      setSaving(false);
    }
  }, [name, description, code, type, onSave]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex-1 flex items-center gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Script Name"
            className="text-lg font-medium bg-transparent border-none outline-none focus:ring-0"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="px-3 py-1 text-sm border rounded-lg bg-gray-50 dark:bg-gray-800"
          >
            <option value="calculation">Calculation</option>
            <option value="transformation">Transformation</option>
            <option value="aggregation">Aggregation</option>
            <option value="visualization">Visualization</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleValidate}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Validate
          </button>
          <button
            onClick={handleTest}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Test
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-2 border-b">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description..."
          className="w-full text-sm text-gray-500 bg-transparent border-none outline-none"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Code Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none outline-none"
              spellCheck={false}
            />
          </div>

          {/* Validation Results */}
          {validation && (
            <div
              className={`p-3 border-t ${
                validation.valid
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}
            >
              {validation.valid ? (
                <span>✓ Script is valid</span>
              ) : (
                <div>
                  <span className="font-medium">Errors:</span>
                  <ul className="mt-1 list-disc list-inside text-sm">
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l flex flex-col">
          {/* Test Context */}
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b font-medium text-sm">Test Context (JSON)</div>
            <textarea
              value={testContext}
              onChange={(e) => setTestContext(e.target.value)}
              className="flex-1 p-3 font-mono text-sm bg-gray-50 dark:bg-gray-800 resize-none outline-none"
              spellCheck={false}
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div className="p-3 border-t">
              <div className="font-medium text-sm mb-2">Result</div>
              <pre
                className={`p-2 rounded text-xs overflow-auto max-h-32 ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'bg-red-50 dark:bg-red-900/20'
                }`}
              >
                {testResult.success
                  ? JSON.stringify(testResult.output, null, 2)
                  : testResult.error}
              </pre>
            </div>
          )}

          {/* Libraries Reference */}
          <div className="p-3 border-t max-h-48 overflow-auto">
            <div className="font-medium text-sm mb-2">Available Libraries</div>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              {libraries.map((lib) => (
                <div key={lib.name} className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded">
                  <span className="font-mono text-blue-600 dark:text-blue-400">{lib.name}</span>
                  <span className="ml-2">{lib.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScriptsList() {
  const { scripts, loading, createScript, executeScript } = useScripts();
  const [showEditor, setShowEditor] = useState(false);
  const [selectedScript, setSelectedScript] = useState<any>(null);

  const handleSave = async (scriptData: any) => {
    await createScript(scriptData);
    setShowEditor(false);
  };

  if (showEditor) {
    return (
      <div className="h-full">
        <button
          onClick={() => setShowEditor(false)}
          className="mb-4 text-sm text-blue-600 hover:underline"
        >
          ← Back to Scripts
        </button>
        <ScriptEditor onSave={handleSave} initialScript={selectedScript} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Custom Scripts</h2>
        <button
          onClick={() => {
            setSelectedScript(null);
            setShowEditor(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Script
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading scripts...</div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No scripts yet. Create your first custom script!
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedScript(script);
                setShowEditor(true);
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{script.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{script.description}</p>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    script.type === 'calculation'
                      ? 'bg-blue-100 text-blue-700'
                      : script.type === 'transformation'
                      ? 'bg-green-100 text-green-700'
                      : script.type === 'aggregation'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {script.type}
                </span>
              </div>
              <div className="mt-3 text-xs text-gray-400">
                v{script.version} • Updated {new Date(script.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
