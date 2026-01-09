"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  Globe,
  BarChart3,
  Settings,
  Users,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  HelpCircle,
  CreditCard,
  Shield,
  Webhook,
  Zap,
  Sparkles,
  Building2,
  FolderOpen,
  PanelLeft,
} from "lucide-react";

// ============================================================================
// NAVIGATION LAYOUT - Enterprise Dashboard Shell
// ============================================================================

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  children?: NavigationItem[];
}

interface NavigationLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  };
  workspaces?: Array<{ id: string; name: string; logo?: string }>;
  currentWorkspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
  onLogout?: () => void;
  onOpenCommandPalette?: () => void;
}

const MAIN_NAV: NavigationItem[] = [
  { label: "Home", href: "/", icon: <Home className="h-5 w-5" /> },
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  {
    label: "Portals",
    href: "/portals",
    icon: <Globe className="h-5 w-5" />,
    children: [
      { label: "All Portals", href: "/portals", icon: <FolderOpen className="h-4 w-4" /> },
      { label: "Templates", href: "/portals/templates", icon: <Zap className="h-4 w-4" /> },
    ],
  },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "AI Insights", href: "/ai-insights", icon: <Sparkles className="h-5 w-5" />, badge: "New" },
  { label: "Team", href: "/team", icon: <Users className="h-5 w-5" /> },
];

const SETTINGS_NAV: NavigationItem[] = [
  { label: "General", href: "/settings", icon: <Settings className="h-4 w-4" /> },
  { label: "Billing", href: "/settings/billing", icon: <CreditCard className="h-4 w-4" /> },
  { label: "Security", href: "/settings/security", icon: <Shield className="h-4 w-4" /> },
  { label: "Integrations", href: "/settings/integrations", icon: <Webhook className="h-4 w-4" /> },
];

export const NavigationLayout: React.FC<NavigationLayoutProps> = ({
  children,
  user,
  workspaces = [],
  currentWorkspaceId,
  onWorkspaceChange,
  onLogout,
  onOpenCommandPalette,
}) => {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = React.useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-40">
        <div className="flex items-center justify-between h-full px-4">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-linear-to-br from-primary to-secondary flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg hidden sm:inline">Real-Time Pulse</span>
            </Link>

            {/* Workspace Selector */}
            {workspaces.length > 0 && (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {currentWorkspace?.name || "Select Workspace"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>

                <AnimatePresence>
                  {workspaceDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-2 w-56 rounded-lg border border-border bg-popover shadow-lg z-50"
                    >
                      <div className="p-2">
                        {workspaces.map((workspace) => (
                          <button
                            key={workspace.id}
                            onClick={() => {
                              onWorkspaceChange?.(workspace.id);
                              setWorkspaceDropdownOpen(false);
                            }}
                            className={cn(
                              "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors",
                              workspace.id === currentWorkspaceId
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted"
                            )}
                          >
                            <Building2 className="h-4 w-4" />
                            {workspace.name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Center Section - Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-3 w-full px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Search...</span>
              <kbd className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
            </button>

            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-5 w-5 text-yellow-400" />
                ) : (
                  <Moon className="h-5 w-5 text-slate-600" />
                )}
              </button>
            )}

            {/* User Menu */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    {user.avatar ? (
                      <Image
                        src={user.avatar}
                        alt={user.name}
                        width={32}
                        height={32}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full right-0 mt-2 w-64 rounded-lg border border-border bg-popover shadow-lg z-50"
                    >
                      <div className="p-4 border-b border-border">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {user.role && (
                          <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                            {user.role}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <Link
                          href="/settings"
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                        >
                          <Settings className="h-4 w-4" />
                          Settings
                        </Link>
                        <Link
                          href="/help"
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                        >
                          <HelpCircle className="h-4 w-4" />
                          Help & Support
                        </Link>
                        <button
                          onClick={onLogout}
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Log Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 bottom-0 bg-card border-r border-border z-30 transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64",
          "hidden lg:block"
        )}
      >
        <nav className="flex flex-col h-full p-3">
          {/* Main Navigation */}
          <div className="flex-1 space-y-1">
            {MAIN_NAV.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={sidebarCollapsed}
              />
            ))}
          </div>

          {/* Settings Section */}
          <div className="border-t border-border pt-3 mt-3">
            <p
              className={cn(
                "text-xs font-medium text-muted-foreground mb-2 px-3",
                sidebarCollapsed && "hidden"
              )}
            >
              Settings
            </p>
            {SETTINGS_NAV.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={sidebarCollapsed}
              />
            ))}
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="mt-3 p-2 rounded-lg hover:bg-muted transition-colors self-end"
          >
            <PanelLeft
              className={cn(
                "h-5 w-5 transition-transform",
                sidebarCollapsed && "rotate-180"
              )}
            />
          </button>
        </nav>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-card border-r border-border z-50 lg:hidden"
            >
              <nav className="flex flex-col h-full p-3 pt-20">
                {MAIN_NAV.map((item) => (
                  <NavItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={false}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main
        className={cn(
          "pt-16 min-h-screen transition-all duration-300",
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        {children}
      </main>
    </div>
  );
};

// Navigation Item Component
const NavItem: React.FC<{
  item: NavigationItem;
  pathname: string;
  collapsed: boolean;
  onClick?: () => void;
}> = ({ item, pathname, collapsed, onClick }) => {
  const [expanded, setExpanded] = React.useState(false);
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div>
      <Link
        href={hasChildren ? "#" : item.href}
        onClick={(e) => {
          if (hasChildren) {
            e.preventDefault();
            setExpanded(!expanded);
          } else {
            onClick?.();
          }
        }}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {item.icon}
        {!collapsed && (
          <>
            <span className="flex-1 text-sm font-medium">{item.label}</span>
            {item.badge && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                {item.badge}
              </span>
            )}
            {hasChildren && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expanded && "rotate-180"
                )}
              />
            )}
          </>
        )}
        {collapsed && isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
        )}
      </Link>

      {/* Children */}
      {hasChildren && !collapsed && (
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="ml-6 mt-1 space-y-1 overflow-hidden"
            >
              {item.children!.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onClick}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    pathname === child.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {child.icon}
                  {child.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default NavigationLayout;
