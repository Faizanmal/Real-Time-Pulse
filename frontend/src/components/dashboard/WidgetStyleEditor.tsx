'use client';

import { useState, useEffect } from 'react';
import {
  Palette,
  Type,
  Square,
  Droplet,
  Sun,
  Moon,
  Save,
  Eye,
  RotateCcw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Code2,
  Loader2,
  Copy,
  BookTemplate,
} from 'lucide-react';
import {
  widgetCustomizationApi,
  WidgetStyling,
  ConditionalFormat,
  WidgetTheme,
} from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Slider } from '@/src/components/ui/slider';
import { Switch } from '@/src/components/ui/switch';
import { Textarea } from '@/src/components/ui/textarea';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface WidgetStyleEditorProps {
  widgetId: string;
  className?: string;
  onSave?: (styling: WidgetStyling) => void;
}

const PRESET_COLORS = [
  '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#FFFFFF',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
];

const FONT_FAMILIES = [
  { value: 'inherit', label: 'Default' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", monospace', label: 'Courier New' },
];

const CONDITIONAL_OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not Equals' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'between', label: 'Between' },
];

const DEFAULT_STYLING: WidgetStyling = {
  backgroundColor: '#FFFFFF',
  textColor: '#000000',
  borderColor: '#E5E7EB',
  borderWidth: 1,
  borderRadius: 8,
  padding: { top: 16, right: 16, bottom: 16, left: 16 },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  shadow: {
    enabled: false,
    color: '#000000',
    blur: 10,
    spread: 0,
    x: 0,
    y: 4,
  },
  font: {
    family: 'inherit',
    size: 14,
    weight: 400,
    lineHeight: 1.5,
  },
  customCSS: '',
};

export function WidgetStyleEditor({
  widgetId,
  className,
  onSave,
}: WidgetStyleEditorProps) {
  const [styling, setStyling] = useState<WidgetStyling>(DEFAULT_STYLING);
  const [originalStyling, setOriginalStyling] = useState<WidgetStyling>(DEFAULT_STYLING);
  const [conditionalFormats, setConditionalFormats] = useState<ConditionalFormat[]>([]);
  const [themes, setThemes] = useState<WidgetTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saveThemeOpen, setSaveThemeOpen] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeDescription, setNewThemeDescription] = useState('');
  const [newThemePublic, setNewThemePublic] = useState(false);

  // New conditional format form state
  const [newFormatField, setNewFormatField] = useState('');
  const [newFormatOperator, setNewFormatOperator] = useState('gt');
  const [newFormatValue, setNewFormatValue] = useState('');
  const [newFormatColor, setNewFormatColor] = useState('#EF4444');

  useEffect(() => {
    loadStyling();
    loadThemes();
  }, [widgetId]);

  const loadStyling = async () => {
    try {
      const [stylingData, formatsData] = await Promise.all([
        widgetCustomizationApi.getStyling(widgetId),
        widgetCustomizationApi.getConditionalFormats(widgetId),
      ]);

      const mergedStyling = { ...DEFAULT_STYLING, ...stylingData };
      setStyling(mergedStyling);
      setOriginalStyling(mergedStyling);
      setConditionalFormats(formatsData);
    } catch (error) {
      console.error('Failed to load styling:', error);
      // Use defaults if no custom styling exists
    } finally {
      setLoading(false);
    }
  };

  const loadThemes = async () => {
    try {
      const themesData = await widgetCustomizationApi.getThemes();
      setThemes(themesData);
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedStyling = await widgetCustomizationApi.updateStyling(widgetId, styling);
      setOriginalStyling(updatedStyling);
      toast.success('Styling saved successfully');
      onSave?.(updatedStyling);
    } catch (error) {
      console.error('Failed to save styling:', error);
      toast.error('Failed to save styling');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStyling(originalStyling);
    toast.info('Changes reverted');
  };

  const handlePreview = async () => {
    try {
      const result = await widgetCustomizationApi.preview(widgetId, styling);
      setPreviewHtml(result.html);
      setPreviewMode(true);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      toast.error('Failed to generate preview');
    }
  };

  const handleApplyTheme = async (themeId: string) => {
    try {
      const updatedStyling = await widgetCustomizationApi.applyTheme(widgetId, themeId);
      setStyling({ ...DEFAULT_STYLING, ...updatedStyling });
      toast.success('Theme applied');
    } catch (error) {
      console.error('Failed to apply theme:', error);
      toast.error('Failed to apply theme');
    }
  };

  const handleSaveAsTheme = async () => {
    if (!newThemeName.trim()) {
      toast.error('Please enter a theme name');
      return;
    }

    try {
      const newTheme = await widgetCustomizationApi.saveAsTheme(widgetId, {
        name: newThemeName,
        description: newThemeDescription,
        isPublic: newThemePublic,
      });

      setThemes((prev) => [...prev, newTheme]);
      setNewThemeName('');
      setNewThemeDescription('');
      setNewThemePublic(false);
      setSaveThemeOpen(false);
      toast.success('Theme saved');
    } catch (error) {
      console.error('Failed to save theme:', error);
      toast.error('Failed to save theme');
    }
  };

  const handleAddConditionalFormat = async () => {
    if (!newFormatField.trim()) {
      toast.error('Please enter a field name');
      return;
    }

    try {
      const newFormat = await widgetCustomizationApi.addConditionalFormat(widgetId, {
        field: newFormatField,
        conditions: [
          {
            operator: newFormatOperator as any,
            value: isNaN(Number(newFormatValue))
              ? newFormatValue
              : Number(newFormatValue),
            style: { backgroundColor: newFormatColor },
          },
        ],
        priority: conditionalFormats.length,
      });

      setConditionalFormats((prev) => [...prev, newFormat]);
      setNewFormatField('');
      setNewFormatValue('');
      toast.success('Conditional format added');
    } catch (error) {
      console.error('Failed to add conditional format:', error);
      toast.error('Failed to add conditional format');
    }
  };

  const handleDeleteConditionalFormat = async (formatId: string) => {
    try {
      await widgetCustomizationApi.deleteConditionalFormat(widgetId, formatId);
      setConditionalFormats((prev) => prev.filter((f) => f.id !== formatId));
      toast.success('Conditional format removed');
    } catch (error) {
      console.error('Failed to delete conditional format:', error);
      toast.error('Failed to delete conditional format');
    }
  };

  const updateStyling = (updates: Partial<WidgetStyling>) => {
    setStyling((prev) => ({ ...prev, ...updates }));
  };

  const updatePadding = (side: keyof NonNullable<WidgetStyling['padding']>, value: number) => {
    setStyling((prev) => ({
      ...prev,
      padding: { ...prev.padding!, [side]: value },
    }));
  };

  const updateShadow = (key: keyof NonNullable<WidgetStyling['shadow']>, value: any) => {
    setStyling((prev) => ({
      ...prev,
      shadow: { ...prev.shadow!, [key]: value },
    }));
  };

  const updateFont = (key: keyof NonNullable<WidgetStyling['font']>, value: any) => {
    setStyling((prev) => ({
      ...prev,
      font: { ...prev.font!, [key]: value },
    }));
  };

  const hasChanges = JSON.stringify(styling) !== JSON.stringify(originalStyling);

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold">Widget Customization</h3>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="secondary" className="animate-pulse">
                Unsaved changes
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handlePreview}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>

        <Tabs defaultValue="colors">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="typography">Typography</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="conditional">Conditional</TabsTrigger>
            <TabsTrigger value="themes">Themes</TabsTrigger>
          </TabsList>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Background Color */}
              <div className="space-y-2">
                <Label>Background Color</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-10 h-10 p-0 rounded"
                        style={{ backgroundColor: styling.backgroundColor }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <div className="grid grid-cols-6 gap-1">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            className="w-8 h-8 rounded border border-gray-200 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => updateStyling({ backgroundColor: color })}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    value={styling.backgroundColor}
                    onChange={(e) => updateStyling({ backgroundColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Text Color */}
              <div className="space-y-2">
                <Label>Text Color</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-10 h-10 p-0 rounded"
                        style={{ backgroundColor: styling.textColor }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <div className="grid grid-cols-6 gap-1">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            className="w-8 h-8 rounded border border-gray-200 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => updateStyling({ textColor: color })}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    value={styling.textColor}
                    onChange={(e) => updateStyling({ textColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Border Color */}
              <div className="space-y-2">
                <Label>Border Color</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-10 h-10 p-0 rounded"
                        style={{ backgroundColor: styling.borderColor }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <div className="grid grid-cols-6 gap-1">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            className="w-8 h-8 rounded border border-gray-200 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => updateStyling({ borderColor: color })}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    value={styling.borderColor}
                    onChange={(e) => updateStyling({ borderColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Border Width */}
              <div className="space-y-2">
                <Label>Border Width: {styling.borderWidth}px</Label>
                <Slider
                  value={[styling.borderWidth || 0]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={([value]) => updateStyling({ borderWidth: value })}
                />
              </div>
            </div>

            {/* Shadow Settings */}
            <Accordion type="single" collapsible>
              <AccordionItem value="shadow">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Droplet className="h-4 w-4" />
                    Shadow Settings
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <Label>Enable Shadow</Label>
                      <Switch
                        checked={styling.shadow?.enabled}
                        onCheckedChange={(checked) => updateShadow('enabled', checked)}
                      />
                    </div>
                    {styling.shadow?.enabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Blur: {styling.shadow?.blur}px</Label>
                          <Slider
                            value={[styling.shadow?.blur || 0]}
                            min={0}
                            max={50}
                            onValueChange={([value]) => updateShadow('blur', value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Spread: {styling.shadow?.spread}px</Label>
                          <Slider
                            value={[styling.shadow?.spread || 0]}
                            min={0}
                            max={20}
                            onValueChange={([value]) => updateShadow('spread', value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>X Offset: {styling.shadow?.x}px</Label>
                          <Slider
                            value={[styling.shadow?.x || 0]}
                            min={-20}
                            max={20}
                            onValueChange={([value]) => updateShadow('x', value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Y Offset: {styling.shadow?.y}px</Label>
                          <Slider
                            value={[styling.shadow?.y || 0]}
                            min={-20}
                            max={20}
                            onValueChange={([value]) => updateShadow('y', value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* Typography Tab */}
          <TabsContent value="typography" className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select
                  value={styling.font?.family}
                  onValueChange={(value) => updateFont('family', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Font Size: {styling.font?.size}px</Label>
                <Slider
                  value={[styling.font?.size || 14]}
                  min={10}
                  max={32}
                  onValueChange={([value]) => updateFont('size', value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Font Weight: {styling.font?.weight}</Label>
                <Slider
                  value={[styling.font?.weight || 400]}
                  min={100}
                  max={900}
                  step={100}
                  onValueChange={([value]) => updateFont('weight', value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Line Height: {styling.font?.lineHeight}</Label>
                <Slider
                  value={[(styling.font?.lineHeight || 1.5) * 10]}
                  min={10}
                  max={30}
                  onValueChange={([value]) => updateFont('lineHeight', value / 10)}
                />
              </div>
            </div>

            {/* Font Preview */}
            <div
              className="p-4 border rounded-lg"
              style={{
                fontFamily: styling.font?.family,
                fontSize: styling.font?.size,
                fontWeight: styling.font?.weight,
                lineHeight: styling.font?.lineHeight,
                color: styling.textColor,
                backgroundColor: styling.backgroundColor,
              }}
            >
              <p>The quick brown fox jumps over the lazy dog.</p>
              <p className="mt-2">0123456789</p>
            </div>
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label>Border Radius: {styling.borderRadius}px</Label>
              <Slider
                value={[styling.borderRadius || 0]}
                min={0}
                max={32}
                onValueChange={([value]) => updateStyling({ borderRadius: value })}
              />
            </div>

            <div className="space-y-4">
              <Label>Padding</Label>
              <div className="grid grid-cols-4 gap-4">
                {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                  <div key={side} className="space-y-2">
                    <Label className="text-xs capitalize">{side}</Label>
                    <Input
                      type="number"
                      value={styling.padding?.[side] || 0}
                      onChange={(e) => updatePadding(side, parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Custom CSS */}
            <Accordion type="single" collapsible>
              <AccordionItem value="custom-css">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4" />
                    Custom CSS
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-4">
                    <Label>Additional CSS rules</Label>
                    <Textarea
                      value={styling.customCSS}
                      onChange={(e) => updateStyling({ customCSS: e.target.value })}
                      placeholder=".widget { /* your styles */ }"
                      className="font-mono text-sm h-40"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* Conditional Formatting Tab */}
          <TabsContent value="conditional" className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Conditional Formats</h4>
                  <p className="text-sm text-gray-500">
                    Apply styles based on data values
                  </p>
                </div>
              </div>

              {/* Add New Format */}
              <Card className="p-4 bg-gray-50">
                <h5 className="text-sm font-medium mb-3">Add Conditional Format</h5>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Field</Label>
                    <Input
                      placeholder="e.g., value"
                      value={newFormatField}
                      onChange={(e) => setNewFormatField(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Operator</Label>
                    <Select value={newFormatOperator} onValueChange={setNewFormatOperator}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONAL_OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input
                      placeholder="e.g., 100"
                      value={newFormatValue}
                      onChange={(e) => setNewFormatValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Color</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-10 h-10 p-0 rounded"
                            style={{ backgroundColor: newFormatColor }}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <div className="grid grid-cols-6 gap-1">
                            {PRESET_COLORS.map((color) => (
                              <button
                                key={color}
                                className="w-8 h-8 rounded border border-gray-200 hover:scale-110 transition-transform"
                                style={{ backgroundColor: color }}
                                onClick={() => setNewFormatColor(color)}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button onClick={handleAddConditionalFormat}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Existing Formats */}
              <div className="space-y-2">
                {conditionalFormats.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No conditional formats defined</p>
                  </div>
                ) : (
                  conditionalFormats.map((format) => (
                    <Card key={format.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded"
                          style={{
                            backgroundColor:
                              format.conditions[0]?.style?.backgroundColor || '#ccc',
                          }}
                        />
                        <div>
                          <span className="font-medium">{format.field}</span>
                          <span className="text-gray-500 mx-2">
                            {CONDITIONAL_OPERATORS.find(
                              (op) => op.value === format.conditions[0]?.operator
                            )?.label || format.conditions[0]?.operator}
                          </span>
                          <span>{String(format.conditions[0]?.value)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteConditionalFormat(format.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Themes Tab */}
          <TabsContent value="themes" className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Widget Themes</h4>
                <p className="text-sm text-gray-500">Apply or save styling presets</p>
              </div>
              <Dialog open={saveThemeOpen} onOpenChange={setSaveThemeOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save as Theme
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save as Theme</DialogTitle>
                    <DialogDescription>
                      Save the current styling as a reusable theme
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Theme Name</Label>
                      <Input
                        value={newThemeName}
                        onChange={(e) => setNewThemeName(e.target.value)}
                        placeholder="My Custom Theme"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (optional)</Label>
                      <Textarea
                        value={newThemeDescription}
                        onChange={(e) => setNewThemeDescription(e.target.value)}
                        placeholder="Describe this theme..."
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Make Public</Label>
                      <Switch
                        checked={newThemePublic}
                        onCheckedChange={setNewThemePublic}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSaveThemeOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveAsTheme}>Save Theme</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {themes.map((theme) => (
                <Card
                  key={theme.id}
                  className="p-4 cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => handleApplyTheme(theme.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded border"
                      style={{
                        backgroundColor: theme.styling.backgroundColor,
                        borderColor: theme.styling.borderColor,
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{theme.name}</span>
                        {theme.isDefault && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                        {theme.isPublic && (
                          <Badge variant="outline">Public</Badge>
                        )}
                      </div>
                      {theme.description && (
                        <p className="text-sm text-gray-500 mt-1">
                          {theme.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {themes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <BookTemplate className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No themes available</p>
                <p className="text-sm">Save your first theme above</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={previewMode} onOpenChange={setPreviewMode}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Widget Preview</DialogTitle>
            </DialogHeader>
            <div
              className="border rounded-lg overflow-hidden"
              style={{
                backgroundColor: styling.backgroundColor,
                color: styling.textColor,
                borderColor: styling.borderColor,
                borderWidth: styling.borderWidth,
                borderRadius: styling.borderRadius,
                padding: `${styling.padding?.top}px ${styling.padding?.right}px ${styling.padding?.bottom}px ${styling.padding?.left}px`,
                fontFamily: styling.font?.family,
                fontSize: styling.font?.size,
                fontWeight: styling.font?.weight,
                lineHeight: styling.font?.lineHeight,
                boxShadow: styling.shadow?.enabled
                  ? `${styling.shadow.x}px ${styling.shadow.y}px ${styling.shadow.blur}px ${styling.shadow.spread}px ${styling.shadow.color}`
                  : 'none',
              }}
              dangerouslySetInnerHTML={{
                __html:
                  previewHtml ||
                  '<div class="p-4"><h3>Widget Preview</h3><p>Sample content with your custom styles applied.</p></div>',
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
