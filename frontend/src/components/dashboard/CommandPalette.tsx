"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Command } from "cmdk";
import {
  Search,
  Home,
  LayoutDashboard,
  Settings,
  Users,
  FileText,
  BarChart3,
  Bell,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Laptop,
  Zap,
  Keyboard,
  ArrowRight,
  History,
  Star,
  Sparkles,
  Globe,
  Shield,
  CreditCard,
  Webhook,
  Bot,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ============================================================================
// COMMAND PALETTE - Enterprise Power User Feature
// ============================================================================

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string[];
  action: () => void;
  category: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
}) => {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [recentCommands, setRecentCommands] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load recent commands from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem("recentCommands");
    if (stored) {
      setRecentCommands(JSON.parse(stored));
    }
  }, []);

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Global keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const executeCommand = (command: CommandItem) => {
    // Add to recent commands
    const updated = [command.id, ...recentCommands.filter((c) => c !== command.id)].slice(0, 5);
    setRecentCommands(updated);
    localStorage.setItem("recentCommands", JSON.stringify(updated));

    // Execute and close
    command.action();
    onOpenChange(false);
    setSearch("");
  };

  // Command definitions
  const commands: CommandItem[] = [
    // Navigation
    {
      id: "home",
      label: "Go to Home",
      description: "Navigate to the home page",
      icon: <Home className="h-4 w-4" />,
      shortcut: ["G", "H"],
      action: () => router.push("/"),
      category: "Navigation",
      keywords: ["home", "start", "main"],
    },
    {
      id: "dashboard",
      label: "Go to Dashboard",
      description: "View your main dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
      shortcut: ["G", "D"],
      action: () => router.push("/dashboard"),
      category: "Navigation",
      keywords: ["dashboard", "overview", "main"],
    },
    {
      id: "analytics",
      label: "Go to Analytics",
      description: "View analytics and reports",
      icon: <BarChart3 className="h-4 w-4" />,
      shortcut: ["G", "A"],
      action: () => router.push("/analytics"),
      category: "Navigation",
      keywords: ["analytics", "reports", "charts", "data"],
    },
    {
      id: "settings",
      label: "Go to Settings",
      description: "Manage your account settings",
      icon: <Settings className="h-4 w-4" />,
      shortcut: ["G", "S"],
      action: () => router.push("/settings"),
      category: "Navigation",
      keywords: ["settings", "preferences", "config"],
    },
    {
      id: "users",
      label: "Manage Users",
      description: "View and manage team members",
      icon: <Users className="h-4 w-4" />,
      action: () => router.push("/settings/team"),
      category: "Navigation",
      keywords: ["users", "team", "members", "people"],
    },

    // Actions
    {
      id: "new-portal",
      label: "Create New Portal",
      description: "Set up a new client portal",
      icon: <Globe className="h-4 w-4" />,
      shortcut: ["C", "P"],
      action: () => router.push("/portals/new"),
      category: "Actions",
      keywords: ["create", "new", "portal", "client"],
    },
    {
      id: "new-widget",
      label: "Add Widget",
      description: "Add a new widget to your dashboard",
      icon: <Zap className="h-4 w-4" />,
      shortcut: ["C", "W"],
      action: () => console.log("Add widget"),
      category: "Actions",
      keywords: ["widget", "add", "create", "component"],
    },
    {
      id: "ai-insights",
      label: "Generate AI Insights",
      description: "Get AI-powered analysis of your data",
      icon: <Sparkles className="h-4 w-4" />,
      action: () => router.push("/ai-insights"),
      category: "Actions",
      keywords: ["ai", "insights", "analysis", "intelligence"],
    },
    {
      id: "export-data",
      label: "Export Data",
      description: "Export your dashboard data",
      icon: <FileText className="h-4 w-4" />,
      shortcut: ["E", "D"],
      action: () => console.log("Export data"),
      category: "Actions",
      keywords: ["export", "download", "data", "csv", "pdf"],
    },

    // Settings
    {
      id: "theme-light",
      label: "Switch to Light Mode",
      description: "Use light color scheme",
      icon: <Sun className="h-4 w-4" />,
      action: () => document.documentElement.classList.remove("dark"),
      category: "Theme",
      keywords: ["light", "theme", "mode", "bright"],
    },
    {
      id: "theme-dark",
      label: "Switch to Dark Mode",
      description: "Use dark color scheme",
      icon: <Moon className="h-4 w-4" />,
      action: () => document.documentElement.classList.add("dark"),
      category: "Theme",
      keywords: ["dark", "theme", "mode", "night"],
    },
    {
      id: "theme-system",
      label: "Use System Theme",
      description: "Follow system color scheme",
      icon: <Laptop className="h-4 w-4" />,
      action: () => console.log("System theme"),
      category: "Theme",
      keywords: ["system", "theme", "auto", "automatic"],
    },

    // Enterprise Features
    {
      id: "billing",
      label: "Billing & Subscription",
      description: "Manage your subscription and payments",
      icon: <CreditCard className="h-4 w-4" />,
      action: () => router.push("/billing"),
      category: "Enterprise",
      keywords: ["billing", "payment", "subscription", "plan"],
    },
    {
      id: "security",
      label: "Security Settings",
      description: "Configure security and 2FA",
      icon: <Shield className="h-4 w-4" />,
      action: () => router.push("/settings/security"),
      category: "Enterprise",
      keywords: ["security", "2fa", "authentication", "password"],
    },
    {
      id: "webhooks",
      label: "Manage Webhooks",
      description: "Configure webhook integrations",
      icon: <Webhook className="h-4 w-4" />,
      action: () => router.push("/settings/webhooks"),
      category: "Enterprise",
      keywords: ["webhooks", "api", "integration", "events"],
    },
    {
      id: "api",
      label: "API Documentation",
      description: "View API reference and docs",
      icon: <Bot className="h-4 w-4" />,
      action: () => window.open("/docs/api", "_blank"),
      category: "Enterprise",
      keywords: ["api", "docs", "documentation", "reference"],
    },

    // Help
    {
      id: "help",
      label: "Help & Support",
      description: "Get help and contact support",
      icon: <HelpCircle className="h-4 w-4" />,
      shortcut: ["?"],
      action: () => router.push("/help"),
      category: "Help",
      keywords: ["help", "support", "docs", "faq"],
    },
    {
      id: "shortcuts",
      label: "Keyboard Shortcuts",
      description: "View all keyboard shortcuts",
      icon: <Keyboard className="h-4 w-4" />,
      action: () => console.log("Show shortcuts"),
      category: "Help",
      keywords: ["keyboard", "shortcuts", "hotkeys"],
    },
    {
      id: "logout",
      label: "Log Out",
      description: "Sign out of your account",
      icon: <LogOut className="h-4 w-4" />,
      action: () => router.push("/auth/logout"),
      category: "Account",
      keywords: ["logout", "signout", "exit"],
    },
  ];

  // Get recent commands as CommandItems
  const recentItems = recentCommands
    .map((id) => commands.find((c) => c.id === id))
    .filter(Boolean) as CommandItem[];

  // Group commands by category
  const categories = [...new Set(commands.map((c) => c.category))];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />

          {/* Command Dialog */}
          <motion.div
            className="fixed left-1/2 top-1/4 -translate-x-1/2 w-full max-w-2xl z-50"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Command className="rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center border-b border-border px-4">
                <Search className="h-5 w-5 text-muted-foreground mr-3" />
                <Command.Input
                  ref={inputRef}
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Type a command or search..."
                  className="flex-1 h-14 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                />
                <kbd className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  ESC
                </kbd>
              </div>

              {/* Command List */}
              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                <Command.Empty className="flex items-center justify-center py-12 text-muted-foreground">
                  <div className="text-center">
                    <p>No results found</p>
                    <p className="text-sm mt-1">Try a different search term</p>
                  </div>
                </Command.Empty>

                {/* Recent Commands */}
                {recentItems.length > 0 && !search && (
                  <Command.Group heading="Recent" className="mb-2">
                    {recentItems.map((command) => (
                      <CommandItemComponent
                        key={command.id}
                        command={command}
                        onSelect={() => executeCommand(command)}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* Command Categories */}
                {categories.map((category) => {
                  const categoryCommands = commands.filter(
                    (c) => c.category === category
                  );
                  if (categoryCommands.length === 0) return null;

                  return (
                    <Command.Group key={category} heading={category} className="mb-2">
                      {categoryCommands.map((command) => (
                        <CommandItemComponent
                          key={command.id}
                          command={command}
                          onSelect={() => executeCommand(command)}
                        />
                      ))}
                    </Command.Group>
                  );
                })}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded">ESC</kbd>
                    Close
                  </span>
                </div>
                <span>Powered by Real-Time Pulse</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Command Item Component
const CommandItemComponent: React.FC<{
  command: CommandItem;
  onSelect: () => void;
}> = ({ command, onSelect }) => (
  <Command.Item
    value={`${command.label} ${command.keywords?.join(" ") || ""}`}
    onSelect={onSelect}
    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-accent transition-colors group"
  >
    <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-muted-foreground group-data-[selected=true]:bg-primary/10 group-data-[selected=true]:text-primary">
      {command.icon}
    </span>
    <div className="flex-1 min-w-0">
      <p className="font-medium truncate">{command.label}</p>
      {command.description && (
        <p className="text-xs text-muted-foreground truncate">
          {command.description}
        </p>
      )}
    </div>
    {command.shortcut && (
      <div className="hidden sm:flex items-center gap-1">
        {command.shortcut.map((key, i) => (
          <React.Fragment key={key}>
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">{key}</kbd>
            {i < command.shortcut!.length - 1 && (
              <span className="text-muted-foreground">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    )}
    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100 transition-opacity" />
  </Command.Item>
);

// Hook for using command palette
export const useCommandPalette = () => {
  const [open, setOpen] = React.useState(false);
  return { open, setOpen, CommandPalette: () => <CommandPalette open={open} onOpenChange={setOpen} /> };
};

export default CommandPalette;
