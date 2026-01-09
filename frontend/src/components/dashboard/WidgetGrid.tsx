"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  Plus,
  Grip,
  Trash2,
  Copy,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  MoreVertical,
  Edit3,
} from "lucide-react";

// ============================================================================
// WIDGET GRID SYSTEM - Drag & Drop Dashboard Layout
// ============================================================================

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  width: 1 | 2 | 3 | 4; // Grid columns (out of 4)
  height: 1 | 2 | 3; // Grid rows
  locked?: boolean;
  hidden?: boolean;
  refreshInterval?: number;
  data?: Record<string, unknown>;
  style?: {
    backgroundColor?: string;
    textColor?: string;
    borderColor?: string;
    padding?: string;
  };
}

interface WidgetGridProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  columns?: number;
  gap?: number;
  editable?: boolean;
  onAddWidget?: () => void;
  onEditWidget?: (widget: WidgetConfig) => void;
  onDeleteWidget?: (widgetId: string) => void;
  onDuplicateWidget?: (widget: WidgetConfig) => void;
  className?: string;
}

export const WidgetGrid: React.FC<WidgetGridProps> = ({
  widgets,
  onWidgetsChange,
  renderWidget,
  columns = 4,
  gap = 16,
  editable = true,
  onAddWidget,
  onEditWidget,
  onDeleteWidget,
  onDuplicateWidget,
  className,
}) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const visibleWidgets = widgets.filter((w) => !w.hidden);
  const activeWidget = activeId ? widgets.find((w) => w.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      onWidgetsChange(arrayMove(widgets, oldIndex, newIndex));
    }

    setActiveId(null);
  };

  const handleToggleLock = (widgetId: string) => {
    onWidgetsChange(
      widgets.map((w) =>
        w.id === widgetId ? { ...w, locked: !w.locked } : w
      )
    );
  };

  const handleToggleVisibility = (widgetId: string) => {
    onWidgetsChange(
      widgets.map((w) =>
        w.id === widgetId ? { ...w, hidden: !w.hidden } : w
      )
    );
  };

  const handleResizeWidget = (
    widgetId: string,
    dimension: "width" | "height",
    delta: number
  ) => {
    onWidgetsChange(
      widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const current = w[dimension];
        const newValue = Math.max(1, Math.min(dimension === "width" ? 4 : 3, current + delta));
        return { ...w, [dimension]: newValue };
      })
    );
  };

  return (
    <div className={cn("relative", className)}>
      {/* Grid Header */}
      {editable && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {visibleWidgets.length} widgets
            </span>
            {widgets.length !== visibleWidgets.length && (
              <span className="text-xs text-muted-foreground">
                ({widgets.length - visibleWidgets.length} hidden)
              </span>
            )}
          </div>
          {onAddWidget && (
            <motion.button
              onClick={onAddWidget}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Add Widget</span>
            </motion.button>
          )}
        </div>
      )}

      {/* Drag and Drop Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleWidgets.map((w) => w.id)}
          strategy={rectSortingStrategy}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: `${gap}px`,
            }}
          >
            {visibleWidgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                editable={editable && !widget.locked}
                isEditing={editingId === widget.id}
                onEdit={() => onEditWidget?.(widget)}
                onDelete={() => onDeleteWidget?.(widget.id)}
                onDuplicate={() => onDuplicateWidget?.(widget)}
                onToggleLock={() => handleToggleLock(widget.id)}
                onToggleVisibility={() => handleToggleVisibility(widget.id)}
                onResize={(dimension, delta) =>
                  handleResizeWidget(widget.id, dimension, delta)
                }
                onMenuOpen={() => setEditingId(widget.id)}
                onMenuClose={() => setEditingId(null)}
              >
                {renderWidget(widget)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeWidget ? (
            <div
              className="rounded-xl border border-primary bg-card shadow-2xl opacity-80"
              style={{
                gridColumn: `span ${activeWidget.width}`,
                gridRow: `span ${activeWidget.height}`,
              }}
            >
              {renderWidget(activeWidget)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Empty State */}
      {visibleWidgets.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl"
        >
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">No widgets yet</h3>
            <p className="text-muted-foreground mb-4">
              Add widgets to start building your dashboard
            </p>
            {onAddWidget && (
              <motion.button
                onClick={onAddWidget}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="h-4 w-4" />
                Add Your First Widget
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ============================================================================
// SORTABLE WIDGET COMPONENT
// ============================================================================

interface SortableWidgetProps {
  widget: WidgetConfig;
  editable: boolean;
  isEditing: boolean;
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleLock?: () => void;
  onToggleVisibility?: () => void;
  onResize?: (dimension: "width" | "height", delta: number) => void;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

const SortableWidget: React.FC<SortableWidgetProps> = ({
  widget,
  editable,
  children,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleLock,
  onToggleVisibility,
  onResize,
  onMenuOpen,
  onMenuClose,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !editable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${widget.width}`,
    gridRow: `span ${widget.height}`,
    minHeight: `${widget.height * 200}px`,
  };

  const handleMenuToggle = () => {
    setShowMenu(!showMenu);
    if (!showMenu) {
      onMenuOpen?.();
    } else {
      onMenuClose?.();
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group rounded-xl border border-border bg-card overflow-hidden",
        isDragging && "opacity-50 ring-2 ring-primary",
        widget.locked && "ring-1 ring-yellow-500/30"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (showMenu) {
          setShowMenu(false);
          onMenuClose?.();
        }
      }}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      {/* Widget Header (visible on hover when editable) */}
      <AnimatePresence>
        {editable && isHovered && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-2 bg-linear-to-b from-black/50 to-transparent"
          >
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded hover:bg-white/20 cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
            >
              <Grip className="h-4 w-4 text-white" />
            </button>

            {/* Widget Title */}
            <span className="text-sm font-medium text-white truncate px-2">
              {widget.title}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {widget.locked && (
                <Lock className="h-3 w-3 text-yellow-400" />
              )}
              <button
                onClick={handleMenuToggle}
                className="p-1 rounded hover:bg-white/20"
              >
                <MoreVertical className="h-4 w-4 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-12 right-3 z-30 w-48 rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
          >
            <div className="py-1">
              <MenuButton icon={<Edit3 />} label="Edit Widget" onClick={onEdit} />
              <MenuButton icon={<Copy />} label="Duplicate" onClick={onDuplicate} />
              <MenuButton
                icon={widget.locked ? <Unlock /> : <Lock />}
                label={widget.locked ? "Unlock" : "Lock"}
                onClick={onToggleLock}
              />
              <MenuButton
                icon={widget.hidden ? <Eye /> : <EyeOff />}
                label={widget.hidden ? "Show" : "Hide"}
                onClick={onToggleVisibility}
              />
              <div className="border-t border-border my-1" />
              <div className="px-3 py-2">
                <p className="text-xs text-muted-foreground mb-2">Size</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Width:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onResize?.("width", -1)}
                      className="p-1 rounded hover:bg-muted"
                      disabled={widget.width <= 1}
                    >
                      -
                    </button>
                    <span className="text-xs w-4 text-center">{widget.width}</span>
                    <button
                      onClick={() => onResize?.("width", 1)}
                      className="p-1 rounded hover:bg-muted"
                      disabled={widget.width >= 4}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs">Height:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onResize?.("height", -1)}
                      className="p-1 rounded hover:bg-muted"
                      disabled={widget.height <= 1}
                    >
                      -
                    </button>
                    <span className="text-xs w-4 text-center">{widget.height}</span>
                    <button
                      onClick={() => onResize?.("height", 1)}
                      className="p-1 rounded hover:bg-muted"
                      disabled={widget.height >= 3}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="border-t border-border my-1" />
              <MenuButton
                icon={<Trash2 />}
                label="Delete"
                onClick={onDelete}
                destructive
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget Content */}
      <div className="h-full p-4">{children}</div>

      {/* Resize Handles (for future implementation) */}
      {editable && isHovered && (
        <>
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 16 16" className="w-full h-full text-muted-foreground">
              <path
                d="M14 14H10M14 14V10M14 14L10 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </>
      )}
    </motion.div>
  );
};

// Menu Button Component
const MenuButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  destructive?: boolean;
}> = ({ icon, label, onClick, destructive }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors",
      destructive && "text-red-500 hover:bg-red-500/10"
    )}
  >
    <span className="h-4 w-4">{icon}</span>
    {label}
  </button>
);

// ============================================================================
// WIDGET TEMPLATES
// ============================================================================

export const WIDGET_TEMPLATES: WidgetConfig[] = [
  {
    id: "template-metric",
    type: "metric",
    title: "Metric Card",
    width: 1,
    height: 1,
    data: { value: 0, label: "Metric" },
  },
  {
    id: "template-chart-line",
    type: "chart-line",
    title: "Line Chart",
    width: 2,
    height: 2,
    data: { series: [] },
  },
  {
    id: "template-chart-bar",
    type: "chart-bar",
    title: "Bar Chart",
    width: 2,
    height: 2,
    data: { series: [] },
  },
  {
    id: "template-table",
    type: "table",
    title: "Data Table",
    width: 3,
    height: 2,
    data: { columns: [], rows: [] },
  },
  {
    id: "template-text",
    type: "text",
    title: "Text Block",
    width: 1,
    height: 1,
    data: { content: "" },
  },
  {
    id: "template-ai-insights",
    type: "ai-insights",
    title: "AI Insights",
    width: 2,
    height: 2,
    data: {},
  },
];

export default WidgetGrid;
