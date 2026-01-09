'use client';

/**
 * Dashboard Layout with Navigation Sidebar
 * Provides navigation to all dashboard features
 */

import { useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Settings,
  BarChart3,
  AlertTriangle,
  Calendar,
  Webhook,
  Code2,
  Cpu,
  Brain,
  Shield,
  Link2,
  Download,
  MessageSquare,
  Mic,
  GitBranch,
  Building2,
  CreditCard,
  History,
  Database,
  ChevronDown,
  LogOut,
  User,
  Moon,
  Sun,
  Search,
  HelpCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth';

// Sidebar Context
const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}>({
  collapsed: false,
  setCollapsed: () => {},
});

// Navigation Groups
const NAV_GROUPS = [
  {
    title: 'Main',
    items: [
      { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
      { name: 'Alerts', href: '/dashboard/alerts', icon: AlertTriangle },
      { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },
  {
    title: 'Automation',
    items: [
      { name: 'Workflows', href: '/dashboard/workflows', icon: GitBranch },
      { name: 'Scheduled Reports', href: '/dashboard/scheduled-reports', icon: Calendar },
      { name: 'Webhooks', href: '/dashboard/webhooks', icon: Webhook },
      { name: 'Scripts', href: '/dashboard/scripts', icon: Code2 },
    ],
  },
  {
    title: 'AI & ML',
    items: [
      { name: 'ML Models', href: '/dashboard/ml', icon: Brain },
      { name: 'Voice Control', href: '/dashboard/voice', icon: Mic },
    ],
  },
  {
    title: 'IoT & Devices',
    items: [
      { name: 'Devices', href: '/dashboard/iot', icon: Cpu },
    ],
  },
  {
    title: 'Data',
    items: [
      { name: 'Exports', href: '/dashboard/exports', icon: Download },
      { name: 'Backups', href: '/dashboard/backup', icon: Database },
      { name: 'Comments', href: '/dashboard/comments', icon: MessageSquare },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { name: 'GDPR', href: '/dashboard/gdpr', icon: Shield },
      { name: 'Blockchain Audit', href: '/dashboard/blockchain', icon: Link2 },
      { name: 'Audit Logs', href: '/dashboard/audit', icon: History },
    ],
  },
  {
    title: 'Settings',
    items: [
      { name: 'Workspace', href: '/dashboard/workspaces', icon: Building2 },
      { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
      { name: 'Integrations', href: '/dashboard/integrations', icon: Link2 },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

// Navigation Item Component
interface NavItemProps {
  item: { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
  collapsed: boolean;
}

function NavItem({ item, collapsed }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href || 
    (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : ''}`} />
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
function NavSection({ title, items, collapsed }: { title: string; items: NavItemProps['item'][]; collapsed: boolean }) {
  return (
    <div className="space-y-1">
      <AnimatePresence>
        {!collapsed && (
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
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
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 256 }}
      className="fixed left-0 top-0 h-screen bg-card border-r z-40 flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">Pulse</span>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={collapsed ? 'mx-auto' : ''}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {NAV_GROUPS.map((group) => (
          <NavSection
            key={group.title}
            title={group.title}
            items={group.items}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </motion.aside>
  );
}

// Header Component
function Header() {
  const { collapsed } = useContext(SidebarContext);
  const { user, logout } = useAuthStore();
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header
      className="fixed top-0 right-0 h-16 bg-card border-b z-30 flex items-center justify-between px-6"
      style={{ left: collapsed ? 64 : 256, transition: 'left 0.2s' }}
    >
      {/* Search */}
      <div className="relative w-96 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search..." className="pl-10" />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <HelpCircle className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/notifications">
            <Bell className="w-5 h-5" />
          </Link>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <AnimatePresence>
                <motion.span className="text-sm font-medium hidden md:block">
                  {user?.name || 'User'}
                </motion.span>
              </AnimatePresence>
              <ChevronDown className="w-4 h-4 hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <Header />
        <main
          className="pt-16 transition-all duration-200"
          style={{ marginLeft: collapsed ? 64 : 256 }}
        >
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
