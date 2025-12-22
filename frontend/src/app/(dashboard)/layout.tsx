'use client';

/**
 * =============================================================================
 * REAL-TIME PULSE - DASHBOARD LAYOUT
 * =============================================================================
 * 
 * Enterprise dashboard layout with sidebar navigation, header, and main content area.
 */

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  BarChart3,
  Bell,
  Settings,
  Users,
  FileText,
  Zap,
  Search,
  Moon,
  Sun,
  HelpCircle,
  LogOut,
  ChevronDown,
  Building,
  CreditCard,
  Shield,
  Database,
  Plug,
  Layers,
  Sparkles,
  Building2,
  GitBranch,
  Box,
} from 'lucide-react';

// Sidebar Context
const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}>({
  collapsed: false,
  setCollapsed: () => {},
});

// Navigation items
const mainNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Portals', href: '/portals', icon: Globe },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Reports', href: '/reports', icon: FileText },
];

const enterpriseNavItems = [
  { name: 'Advanced Features', href: '/advanced-features', icon: Sparkles },
  { name: 'Industry Solutions', href: '/advanced-features?tab=industry', icon: Building2 },
  { name: 'AI Assistant', href: '/advanced-features?tab=ai', icon: Sparkles },
  { name: 'Workflows', href: '/advanced-features?tab=workflows', icon: GitBranch },
  { name: 'Compliance', href: '/advanced-features?tab=compliance', icon: Shield },
  { name: 'Marketplace', href: '/advanced-features?tab=marketplace', icon: Plug },
  { name: 'AR Viewer', href: '/ar-viewer', icon: Box },
];

const workspaceNavItems = [
  { name: 'Team', href: '/team', icon: Users },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'Data Sources', href: '/datasources', icon: Database },
  { name: 'API Keys', href: '/api-keys', icon: Zap },
];

const settingsNavItems = [
  { name: 'General', href: '/settings', icon: Settings },
  { name: 'Billing', href: '/settings/billing', icon: CreditCard },
  { name: 'Security', href: '/settings/security', icon: Shield },
];

// Navigation Item Component
interface NavItemProps {
  item: { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
  collapsed: boolean;
}

function NavItem({ item, collapsed }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        isActive
          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="text-sm font-medium whitespace-nowrap overflow-hidden"
          >
            {item.name}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

// Navigation Section Component
interface NavSectionProps {
  title: string;
  items: NavItemProps['item'][];
  collapsed: boolean;
}

function NavSection({ title, items, collapsed }: NavSectionProps) {
  return (
    <div className="space-y-1">
      <AnimatePresence>
        {!collapsed && (
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
          >
            {title}
          </motion.h3>
        )}
      </AnimatePresence>
      {items.map((item) => (
        <NavItem key={item.href} item={item} collapsed={collapsed} />
      ))}
    </div>
  );
}

// Sidebar Component
function Sidebar() {
  const { collapsed, setCollapsed } = useContext(SidebarContext);

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-20 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-gray-900 dark:text-white whitespace-nowrap overflow-hidden"
              >
                Real-Time Pulse
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-gray-500" />
          ) : (
            <PanelLeftClose className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-6 overflow-y-auto h-[calc(100vh-8rem)]">
        <NavSection title="Overview" items={mainNavItems} collapsed={collapsed} />
        <NavSection title="Enterprise" items={enterpriseNavItems} collapsed={collapsed} />
        <NavSection title="Workspace" items={workspaceNavItems} collapsed={collapsed} />
        <NavSection title="Settings" items={settingsNavItems} collapsed={collapsed} />
      </nav>

      {/* User Menu */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
            JD
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  John Doe
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  john@example.com
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

// Header Component
function Header() {
  const { collapsed } = useContext(SidebarContext);
  const [isDark, setIsDark] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // Check for dark mode preference
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-10 transition-all duration-300 ${
        collapsed ? 'left-16' : 'left-64'
      }`}
    >
      <div className="h-full flex items-center justify-between px-6">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search... (⌘K)"
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-0 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:bg-white dark:focus:bg-gray-700 transition-all"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Help */}
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <HelpCircle className="w-5 h-5 text-gray-500" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-gray-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
            >
              <Bell className="w-5 h-5 text-gray-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Notifications
                    </h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <p className="text-sm text-gray-900 dark:text-white">
                          New alert triggered
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          5 minutes ago
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                    <Link
                      href="/notifications"
                      className="block text-center text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      View all notifications
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Workspace Selector */}
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-2">
            <Building className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Acme Inc
            </span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    </header>
  );
}

// Main Layout Component
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Sidebar />
        <Header />
        <main
          className={`pt-16 transition-all duration-300 ${
            collapsed ? 'pl-16' : 'pl-64'
          }`}
        >
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
