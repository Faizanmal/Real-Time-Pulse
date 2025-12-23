'use client';

/**
 * ============================================================================
 * ENHANCED DASHBOARD LAYOUT SYSTEM
 * ============================================================================
 * Customizable dashboard with drag-and-drop widget arrangement,
 * persistent layouts, quick actions, and personalization.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  GripVertical,
  Maximize2,
  Minimize2,
  X,
  Settings,
  LayoutGrid,
  Columns,
  Rows,
  Plus,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Palette,
  ChevronDown,
  Check,
} from 'lucide-react';

// ==================== TYPES ====================

type LayoutMode = 'grid' | 'columns' | 'rows' | 'masonry';
type WidgetSize = 'small' | 'medium' | 'large' | 'full';

interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  size: WidgetSize;
  visible: boolean;
  locked: boolean;
  order: number;
  settings?: Record<string, unknown>;
}

interface DashboardLayout {
  id: string;
  name: string;
  mode: LayoutMode;
  widgets: WidgetConfig[];
  columns?: number;
  gap?: number;
  isDefault?: boolean;
}

interface DashboardContextValue {
  layout: DashboardLayout;
  layouts: DashboardLayout[];
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  updateWidget: (widgetId: string, updates: Partial<WidgetConfig>) => void;
  removeWidget: (widgetId: string) => void;
  addWidget: (widget: Omit<WidgetConfig, 'id' | 'order'>) => void;
  reorderWidgets: (widgets: WidgetConfig[]) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  saveLayout: () => void;
  resetLayout: () => void;
  switchLayout: (layoutId: string) => void;
  createLayout: (name: string) => void;
  deleteLayout: (layoutId: string) => void;
}

// ==================== DEFAULT LAYOUTS ====================

const DEFAULT_LAYOUTS: DashboardLayout[] = [
  {
    id: 'default',
    name: 'Default',
    mode: 'grid',
    columns: 3,
    gap: 16,
    isDefault: true,
    widgets: [
      { id: 'stats', type: 'stats', title: 'Statistics', size: 'full', visible: true, locked: false, order: 0 },
      { id: 'chart', type: 'chart', title: 'Analytics Chart', size: 'large', visible: true, locked: false, order: 1 },
      { id: 'activity', type: 'activity', title: 'Recent Activity', size: 'medium', visible: true, locked: false, order: 2 },
      { id: 'portals', type: 'portals', title: 'Active Portals', size: 'medium', visible: true, locked: false, order: 3 },
      { id: 'alerts', type: 'alerts', title: 'Alerts', size: 'small', visible: true, locked: false, order: 4 },
      { id: 'integrations', type: 'integrations', title: 'Integrations', size: 'small', visible: true, locked: false, order: 5 },
    ],
  },
  {
    id: 'compact',
    name: 'Compact',
    mode: 'columns',
    columns: 4,
    gap: 12,
    widgets: [
      { id: 'stats', type: 'stats', title: 'Statistics', size: 'medium', visible: true, locked: false, order: 0 },
      { id: 'portals', type: 'portals', title: 'Active Portals', size: 'medium', visible: true, locked: false, order: 1 },
      { id: 'alerts', type: 'alerts', title: 'Alerts', size: 'small', visible: true, locked: false, order: 2 },
      { id: 'activity', type: 'activity', title: 'Recent Activity', size: 'small', visible: true, locked: false, order: 3 },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics Focus',
    mode: 'grid',
    columns: 2,
    gap: 20,
    widgets: [
      { id: 'chart', type: 'chart', title: 'Analytics Chart', size: 'full', visible: true, locked: true, order: 0 },
      { id: 'metrics', type: 'metrics', title: 'Key Metrics', size: 'large', visible: true, locked: false, order: 1 },
      { id: 'trends', type: 'trends', title: 'Trends', size: 'large', visible: true, locked: false, order: 2 },
    ],
  },
];

// ==================== CONTEXT ====================

const DashboardContext = createContext<DashboardContextValue | null>(null);
const STORAGE_KEY = 'pulse_dashboard_layouts';

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [layouts, setLayouts] = useState<DashboardLayout[]>(DEFAULT_LAYOUTS);
  const [currentLayoutId, setCurrentLayoutId] = useState('default');
  const [isEditing, setIsEditing] = useState(false);

  const layout = layouts.find(l => l.id === currentLayoutId) || layouts[0];

  // Load from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setLayouts(data.layouts || DEFAULT_LAYOUTS);
        setCurrentLayoutId(data.currentLayoutId || 'default');
      }
    } catch {
      // Use defaults
    }
  }, []);

  // Save to localStorage
  const saveToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        layouts,
        currentLayoutId,
      }));
    } catch {
      // Ignore
    }
  }, [layouts, currentLayoutId]);

  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetConfig>) => {
    setLayouts(prev => prev.map(l => {
      if (l.id !== currentLayoutId) return l;
      return {
        ...l,
        widgets: l.widgets.map(w => w.id === widgetId ? { ...w, ...updates } : w),
      };
    }));
  }, [currentLayoutId]);

  const removeWidget = useCallback((widgetId: string) => {
    setLayouts(prev => prev.map(l => {
      if (l.id !== currentLayoutId) return l;
      return {
        ...l,
        widgets: l.widgets.filter(w => w.id !== widgetId),
      };
    }));
  }, [currentLayoutId]);

  const addWidget = useCallback((widget: Omit<WidgetConfig, 'id' | 'order'>) => {
    const id = `widget-${Date.now()}`;
    const order = layout.widgets.length;
    
    setLayouts(prev => prev.map(l => {
      if (l.id !== currentLayoutId) return l;
      return {
        ...l,
        widgets: [...l.widgets, { ...widget, id, order }],
      };
    }));
  }, [currentLayoutId, layout.widgets.length]);

  const reorderWidgets = useCallback((widgets: WidgetConfig[]) => {
    setLayouts(prev => prev.map(l => {
      if (l.id !== currentLayoutId) return l;
      return {
        ...l,
        widgets: widgets.map((w, i) => ({ ...w, order: i })),
      };
    }));
  }, [currentLayoutId]);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayouts(prev => prev.map(l => {
      if (l.id !== currentLayoutId) return l;
      return { ...l, mode };
    }));
  }, [currentLayoutId]);

  const saveLayout = useCallback(() => {
    saveToStorage();
    setIsEditing(false);
  }, [saveToStorage]);

  const resetLayout = useCallback(() => {
    const defaultLayout = DEFAULT_LAYOUTS.find(l => l.id === currentLayoutId);
    if (defaultLayout) {
      setLayouts(prev => prev.map(l => l.id === currentLayoutId ? defaultLayout : l));
    }
  }, [currentLayoutId]);

  const switchLayout = useCallback((layoutId: string) => {
    setCurrentLayoutId(layoutId);
  }, []);

  const createLayout = useCallback((name: string) => {
    const newLayout: DashboardLayout = {
      ...layout,
      id: `layout-${Date.now()}`,
      name,
      isDefault: false,
    };
    setLayouts(prev => [...prev, newLayout]);
    setCurrentLayoutId(newLayout.id);
  }, [layout]);

  const deleteLayout = useCallback((layoutId: string) => {
    if (layouts.length <= 1) return;
    setLayouts(prev => prev.filter(l => l.id !== layoutId));
    if (currentLayoutId === layoutId) {
      setCurrentLayoutId(layouts[0].id);
    }
  }, [layouts, currentLayoutId]);

  return (
    <DashboardContext.Provider
      value={{
        layout,
        layouts,
        isEditing,
        setIsEditing,
        updateWidget,
        removeWidget,
        addWidget,
        reorderWidgets,
        setLayoutMode,
        saveLayout,
        resetLayout,
        switchLayout,
        createLayout,
        deleteLayout,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardLayout() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardLayout must be used within DashboardLayoutProvider');
  }
  return context;
}

// ==================== WIDGET CONTAINER ====================

interface DraggableWidgetProps {
  config: WidgetConfig;
  children: ReactNode;
  className?: string;
}

export function DraggableWidget({ config, children, className }: DraggableWidgetProps) {
  const { isEditing, updateWidget, removeWidget } = useDashboardLayout();
  const dragControls = useDragControls();
  const [isExpanded, setIsExpanded] = useState(false);

  const sizeClasses: Record<WidgetSize, string> = {
    small: 'col-span-1',
    medium: 'col-span-1 md:col-span-2',
    large: 'col-span-1 md:col-span-2 lg:col-span-3',
    full: 'col-span-full',
  };

  if (!config.visible && !isEditing) {
    return null;
  }

  return (
    <motion.div
      layout
      className={cn(
        'relative group',
        sizeClasses[config.size],
        !config.visible && 'opacity-50',
        isExpanded && 'col-span-full row-span-2',
        className
      )}
    >
      {/* Edit overlay */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 bg-purple-500/10 border-2 border-dashed border-purple-500/50 rounded-xl pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Widget toolbar */}
      <AnimatePresence>
        {(isEditing || isExpanded) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-10 left-0 right-0 z-20 flex items-center justify-between px-2"
          >
            <div className="flex items-center gap-1">
              {isEditing && !config.locked && (
                <button
                  onPointerDown={(e) => dragControls.start(e)}
                  className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4 text-gray-400" />
                </button>
              )}
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 px-2">
                {config.title}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {isEditing && (
                <>
                  <button
                    onClick={() => updateWidget(config.id, { visible: !config.visible })}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-slate-600"
                    title={config.visible ? 'Hide' : 'Show'}
                  >
                    {config.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => updateWidget(config.id, { locked: !config.locked })}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-slate-600"
                    title={config.locked ? 'Unlock' : 'Lock'}
                  >
                    {config.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => removeWidget(config.id)}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500"
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-slate-600"
                title={isExpanded ? 'Minimize' : 'Maximize'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget content */}
      <motion.div
        drag={isEditing && !config.locked}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        className={cn(
          'h-full bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden',
          isEditing && !config.locked && 'cursor-move',
          isEditing && 'ring-2 ring-purple-500/20'
        )}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ==================== DASHBOARD GRID ====================

interface DashboardGridProps {
  children: ReactNode;
  className?: string;
}

export function DashboardGrid({ children, className }: DashboardGridProps) {
  const { layout, reorderWidgets } = useDashboardLayout();

  const gridClasses: Record<LayoutMode, string> = {
    grid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    columns: `grid grid-cols-${layout.columns || 3}`,
    rows: 'flex flex-col',
    masonry: 'columns-1 md:columns-2 lg:columns-3',
  };

  return (
    <div
      className={cn(
        gridClasses[layout.mode],
        layout.mode !== 'masonry' && `gap-${layout.gap || 4}`,
        className
      )}
      style={{ gap: layout.gap ? `${layout.gap}px` : undefined }}
    >
      {children}
    </div>
  );
}

// ==================== LAYOUT TOOLBAR ====================

export function LayoutToolbar() {
  const {
    layout,
    layouts,
    isEditing,
    setIsEditing,
    setLayoutMode,
    saveLayout,
    resetLayout,
    switchLayout,
    createLayout,
  } = useDashboardLayout();

  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showNewLayoutInput, setShowNewLayoutInput] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');

  const layoutModes: { mode: LayoutMode; icon: ReactNode; label: string }[] = [
    { mode: 'grid', icon: <LayoutGrid className="h-4 w-4" />, label: 'Grid' },
    { mode: 'columns', icon: <Columns className="h-4 w-4" />, label: 'Columns' },
    { mode: 'rows', icon: <Rows className="h-4 w-4" />, label: 'Rows' },
  ];

  const handleCreateLayout = () => {
    if (newLayoutName.trim()) {
      createLayout(newLayoutName.trim());
      setNewLayoutName('');
      setShowNewLayoutInput(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Layout selector */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLayoutMenu(!showLayoutMenu)}
          className="gap-2"
        >
          <LayoutGrid className="h-4 w-4" />
          {layout.name}
          <ChevronDown className="h-3 w-3" />
        </Button>

        <AnimatePresence>
          {showLayoutMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setShowLayoutMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl z-50 overflow-hidden"
              >
                <div className="p-2">
                  {layouts.map(l => (
                    <button
                      key={l.id}
                      onClick={() => {
                        switchLayout(l.id);
                        setShowLayoutMenu(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                        l.id === layout.id
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                      )}
                    >
                      <span>{l.name}</span>
                      {l.id === layout.id && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                  
                  <div className="border-t dark:border-slate-700 my-2" />
                  
                  {showNewLayoutInput ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLayoutName}
                        onChange={(e) => setNewLayoutName(e.target.value)}
                        placeholder="Layout name"
                        className="flex-1 px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateLayout();
                          if (e.key === 'Escape') setShowNewLayoutInput(false);
                        }}
                      />
                      <Button size="sm" onClick={handleCreateLayout}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewLayoutInput(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    >
                      <Plus className="h-4 w-4" />
                      New Layout
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Layout mode toggle (when editing) */}
      {isEditing && (
        <div className="flex items-center rounded-lg border dark:border-slate-700 overflow-hidden">
          {layoutModes.map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => setLayoutMode(mode)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-sm transition-colors',
                layout.mode === mode
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700'
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700'
              )}
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      {/* Edit toggle & actions */}
      <div className="flex items-center gap-2 ml-auto">
        {isEditing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetLayout}
              className="text-gray-500"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={saveLayout}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              <Save className="h-4 w-4 mr-1" />
              Save Layout
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Settings className="h-4 w-4 mr-1" />
            Customize
          </Button>
        )}
      </div>
    </div>
  );
}

// ==================== WIDGET PALETTE ====================

interface WidgetType {
  type: string;
  title: string;
  description: string;
  icon: ReactNode;
  defaultSize: WidgetSize;
}

const AVAILABLE_WIDGETS: WidgetType[] = [
  { type: 'stats', title: 'Statistics', description: 'Key metrics overview', icon: <LayoutGrid />, defaultSize: 'medium' },
  { type: 'chart', title: 'Chart', description: 'Data visualization', icon: <LayoutGrid />, defaultSize: 'large' },
  { type: 'activity', title: 'Activity', description: 'Recent activity feed', icon: <LayoutGrid />, defaultSize: 'medium' },
  { type: 'portals', title: 'Portals', description: 'Portal list', icon: <LayoutGrid />, defaultSize: 'medium' },
  { type: 'alerts', title: 'Alerts', description: 'Active alerts', icon: <LayoutGrid />, defaultSize: 'small' },
  { type: 'integrations', title: 'Integrations', description: 'Connected services', icon: <LayoutGrid />, defaultSize: 'small' },
];

interface WidgetPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WidgetPalette({ isOpen, onClose }: WidgetPaletteProps) {
  const { addWidget, layout } = useDashboardLayout();

  const existingWidgetTypes = layout.widgets.map(w => w.type);

  const handleAddWidget = (widget: WidgetType) => {
    addWidget({
      type: widget.type,
      title: widget.title,
      size: widget.defaultSize,
      visible: true,
      locked: false,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed right-4 top-20 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Add Widget</h3>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-4 max-h-96 overflow-auto">
              <div className="space-y-2">
                {AVAILABLE_WIDGETS.map(widget => {
                  const exists = existingWidgetTypes.includes(widget.type);
                  
                  return (
                    <button
                      key={widget.type}
                      onClick={() => handleAddWidget(widget)}
                      disabled={exists}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
                        exists
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                      )}
                    >
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg text-purple-600">
                        {widget.icon}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{widget.title}</div>
                        <div className="text-xs text-gray-500">{widget.description}</div>
                        {exists && (
                          <span className="text-xs text-purple-500">Already added</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ==================== QUICK ACTIONS ====================

interface QuickAction {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
}

interface QuickActionsBarProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActionsBar({ actions, className }: QuickActionsBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-lg',
        className
      )}
    >
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          {index > 0 && <div className="w-px h-6 bg-gray-200 dark:bg-slate-700" />}
          <Button
            variant={action.variant === 'primary' ? 'default' : 'ghost'}
            size="sm"
            onClick={action.onClick}
            className={cn(
              'gap-2',
              action.variant === 'primary' && 'bg-gradient-to-r from-purple-500 to-pink-500',
              action.variant === 'danger' && 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
            )}
          >
            {action.icon}
            <span>{action.label}</span>
            {action.shortcut && (
              <kbd className="ml-1 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">
                {action.shortcut}
              </kbd>
            )}
          </Button>
        </React.Fragment>
      ))}
    </motion.div>
  );
}

export default {
  DashboardLayoutProvider,
  useDashboardLayout,
  DashboardGrid,
  DraggableWidget,
  LayoutToolbar,
  WidgetPalette,
  QuickActionsBar,
};
