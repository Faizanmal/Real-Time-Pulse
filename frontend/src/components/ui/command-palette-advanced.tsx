'use client';

/**
 * ============================================================================
 * ADVANCED COMMAND PALETTE (SPOTLIGHT SEARCH)
 * ============================================================================
 * Spotlight-style command palette with fuzzy search, keyboard navigation,
 * recent items, quick actions, and contextual suggestions.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Search,
  Command as CommandIcon,
  Clock,
  Star,
  Hash,
  Users,
  Settings,
  Bell,
  LayoutDashboard,
  Zap,
  LogOut,
  Plus,
  BarChart3,
  Shield,
  HelpCircle,
  Keyboard,
  Moon,
  ChevronRight,
  X,
  Sparkles,
  Folder,
  ExternalLink,
} from 'lucide-react';

// ==================== TYPES ====================

type CommandType = 'navigation' | 'action' | 'search' | 'recent' | 'favorite';

interface CommandItem {
  id: string;
  type: CommandType;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  shortcut?: string;
  keywords?: string[];
  category?: string;
  action?: () => void | Promise<void>;
  href?: string;
  isNew?: boolean;
  isPinned?: boolean;
}

interface CommandGroup {
  id: string;
  title: string;
  items: CommandItem[];
}

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  activeCategory: string | null;
  recentSearches: string[];
  recentCommands: string[];
  favoriteCommands: string[];
}

// ==================== FUZZY SEARCH ====================

function fuzzyMatch(pattern: string, str: string): { match: boolean; score: number; indices: number[] } {
  pattern = pattern.toLowerCase();
  str = str.toLowerCase();
  
  let patternIdx = 0;
  let strIdx = 0;
  let score = 0;
  const indices: number[] = [];
  let consecutiveMatches = 0;
  
  while (patternIdx < pattern.length && strIdx < str.length) {
    if (pattern[patternIdx] === str[strIdx]) {
      indices.push(strIdx);
      score += 1 + consecutiveMatches * 2; // Bonus for consecutive matches
      consecutiveMatches++;
      patternIdx++;
      
      // Bonus for word boundary match
      if (strIdx === 0 || str[strIdx - 1] === ' ' || str[strIdx - 1] === '/') {
        score += 5;
      }
    } else {
      consecutiveMatches = 0;
    }
    strIdx++;
  }
  
  if (patternIdx < pattern.length) {
    return { match: false, score: 0, indices: [] };
  }
  
  // Penalize long strings
  score -= (str.length - pattern.length) * 0.1;
  
  return { match: true, score, indices };
}

function highlightMatch(text: string, indices: number[]): ReactNode {
  if (indices.length === 0) return text;
  
  const result: ReactNode[] = [];
  let lastIndex = 0;
  
  indices.forEach((index, i) => {
    if (index > lastIndex) {
      result.push(text.slice(lastIndex, index));
    }
    result.push(
      <span key={i} className="text-purple-500 font-medium">
        {text[index]}
      </span>
    );
    lastIndex = index + 1;
  });
  
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  
  return <>{result}</>;
}

// ==================== DEFAULT COMMANDS ====================

const DEFAULT_COMMANDS: CommandItem[] = [
  // Navigation
  { id: 'nav-dashboard', type: 'navigation', title: 'Dashboard', subtitle: 'Go to main dashboard', icon: <LayoutDashboard />, href: '/dashboard', shortcut: 'G D', category: 'Navigation', keywords: ['home', 'main'] },
  { id: 'nav-portals', type: 'navigation', title: 'Portals', subtitle: 'View all portals', icon: <Folder />, href: '/dashboard/portals', shortcut: 'G P', category: 'Navigation', keywords: ['clients', 'dashboards'] },
  { id: 'nav-integrations', type: 'navigation', title: 'Integrations', subtitle: 'Manage integrations', icon: <Zap />, href: '/dashboard/integrations', shortcut: 'G I', category: 'Navigation', keywords: ['connect', 'api'] },
  { id: 'nav-analytics', type: 'navigation', title: 'Analytics', subtitle: 'View analytics', icon: <BarChart3 />, href: '/dashboard/enterprise/analytics', category: 'Navigation', keywords: ['stats', 'metrics', 'reports'] },
  { id: 'nav-settings', type: 'navigation', title: 'Settings', subtitle: 'Workspace settings', icon: <Settings />, href: '/dashboard/settings', shortcut: 'G S', category: 'Navigation', keywords: ['config', 'preferences'] },
  { id: 'nav-security', type: 'navigation', title: 'Security', subtitle: 'Security settings', icon: <Shield />, href: '/dashboard/settings/security', category: 'Navigation', keywords: ['2fa', 'password'] },
  { id: 'nav-team', type: 'navigation', title: 'Team', subtitle: 'Manage team members', icon: <Users />, href: '/dashboard/settings/team', category: 'Navigation', keywords: ['members', 'invite'] },
  
  // Actions
  { id: 'action-new-portal', type: 'action', title: 'Create New Portal', subtitle: 'Start a new client portal', icon: <Plus />, shortcut: '⌘N', category: 'Actions', keywords: ['add', 'new', 'create'] },
  { id: 'action-export', type: 'action', title: 'Export Data', subtitle: 'Download your data', icon: <ExternalLink />, shortcut: '⌘⇧E', category: 'Actions', keywords: ['download', 'csv', 'pdf'] },
  { id: 'action-notifications', type: 'action', title: 'View Notifications', subtitle: 'See all notifications', icon: <Bell />, shortcut: '⌘⇧N', category: 'Actions', keywords: ['alerts', 'messages'] },
  { id: 'action-toggle-theme', type: 'action', title: 'Toggle Theme', subtitle: 'Switch dark/light mode', icon: <Moon />, shortcut: '⌘⇧T', category: 'Actions', keywords: ['dark', 'light', 'mode'] },
  { id: 'action-shortcuts', type: 'action', title: 'Keyboard Shortcuts', subtitle: 'View all shortcuts', icon: <Keyboard />, shortcut: '?', category: 'Actions', keywords: ['keys', 'hotkeys'] },
  { id: 'action-help', type: 'action', title: 'Help & Support', subtitle: 'Get help with Real-Time Pulse', icon: <HelpCircle />, category: 'Actions', keywords: ['docs', 'support', 'guide'] },
  { id: 'action-logout', type: 'action', title: 'Sign Out', subtitle: 'Log out of your account', icon: <LogOut />, category: 'Actions', keywords: ['logout', 'exit'] },
];

// ==================== COMMAND PALETTE COMPONENT ====================

interface CommandPaletteProps {
  commands?: CommandItem[];
  onCommand?: (command: CommandItem) => void;
  placeholder?: string;
}

export function CommandPalette({
  commands = DEFAULT_COMMANDS,
  onCommand,
  placeholder = 'Search commands, pages, or actions...',
}: CommandPaletteProps) {
  const [state, setState] = useState<CommandPaletteState>(() => {
    if (typeof window === 'undefined') return {
      isOpen: false,
      query: '',
      selectedIndex: 0,
      activeCategory: null,
      recentSearches: [],
      recentCommands: [],
      favoriteCommands: [],
    };
    
    try {
      const saved = localStorage.getItem('pulse_command_palette');
      if (saved) {
        const data = JSON.parse(saved);
        return {
          isOpen: false,
          query: '',
          selectedIndex: 0,
          activeCategory: null,
          recentSearches: data.recentSearches || [],
          recentCommands: data.recentCommands || [],
          favoriteCommands: data.favoriteCommands || [],
        };
      }
    } catch {
      // Ignore
    }
    return {
      isOpen: false,
      query: '',
      selectedIndex: 0,
      activeCategory: null,
      recentSearches: [],
      recentCommands: [],
      favoriteCommands: [],
    };
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Save state
  const saveState = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('pulse_command_palette', JSON.stringify({
        recentSearches: state.recentSearches.slice(0, 10),
        recentCommands: state.recentCommands.slice(0, 10),
        favoriteCommands: state.favoriteCommands,
      }));
    } catch {
      // Ignore
    }
  }, [state.recentSearches, state.recentCommands, state.favoriteCommands]);

  // Open/close with keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setState(prev => ({ ...prev, isOpen: true, query: '', selectedIndex: 0 }));
      }
      
      // Close with Escape
      if (e.key === 'Escape' && state.isOpen) {
        e.preventDefault();
        setState(prev => ({ ...prev, isOpen: false, query: '' }));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (state.isOpen) {
      inputRef.current?.focus();
    }
  }, [state.isOpen]);

  // Filter and group commands
  const filteredGroups = useMemo((): CommandGroup[] => {
    const query = state.query.trim();
    
    if (!query) {
      // Show recent and favorites when no query
      const groups: CommandGroup[] = [];
      
      if (state.recentCommands.length > 0) {
        const recentItems = state.recentCommands
          .map(id => commands.find(c => c.id === id))
          .filter(Boolean) as CommandItem[];
        
        if (recentItems.length > 0) {
          groups.push({
            id: 'recent',
            title: 'Recent',
            items: recentItems.slice(0, 5).map(item => ({
              ...item,
              type: 'recent' as CommandType,
            })),
          });
        }
      }
      
      if (state.favoriteCommands.length > 0) {
        const favoriteItems = state.favoriteCommands
          .map(id => commands.find(c => c.id === id))
          .filter(Boolean) as CommandItem[];
        
        if (favoriteItems.length > 0) {
          groups.push({
            id: 'favorites',
            title: 'Favorites',
            items: favoriteItems.map(item => ({
              ...item,
              type: 'favorite' as CommandType,
              isPinned: true,
            })),
          });
        }
      }
      
      // Group by category
      const categories = [...new Set(commands.map(c => c.category))].filter(Boolean);
      categories.forEach(category => {
        const items = commands.filter(c => c.category === category);
        if (items.length > 0) {
          groups.push({
            id: category!.toLowerCase(),
            title: category!,
            items: items.slice(0, 5),
          });
        }
      });
      
      return groups;
    }
    
    // Search with fuzzy matching
    const results = commands
      .map(command => {
        const titleMatch = fuzzyMatch(query, command.title);
        const subtitleMatch = command.subtitle ? fuzzyMatch(query, command.subtitle) : { match: false, score: 0, indices: [] };
        const keywordMatch = command.keywords?.some(k => fuzzyMatch(query, k).match);
        
        const score = Math.max(titleMatch.score, subtitleMatch.score) + (keywordMatch ? 10 : 0);
        
        return {
          command,
          match: titleMatch.match || subtitleMatch.match || keywordMatch,
          score,
          titleIndices: titleMatch.indices,
          subtitleIndices: subtitleMatch.indices,
        };
      })
      .filter(r => r.match)
      .sort((a, b) => b.score - a.score);
    
    if (results.length === 0) {
      return [];
    }
    
    return [{
      id: 'search-results',
      title: 'Search Results',
      items: results.slice(0, 10).map(r => ({
        ...r.command,
        _titleIndices: r.titleIndices,
        _subtitleIndices: r.subtitleIndices,
      } as CommandItem & { _titleIndices?: number[]; _subtitleIndices?: number[] })),
    }];
  }, [commands, state.query, state.recentCommands, state.favoriteCommands]);

  // Flat list for navigation
  const flatItems = useMemo(() => 
    filteredGroups.flatMap(g => g.items),
    [filteredGroups]
  );

  // Execute command
  const executeCommand = useCallback((command: CommandItem) => {
    // Add to recent
    setState(prev => ({
      ...prev,
      recentCommands: [command.id, ...prev.recentCommands.filter(id => id !== command.id)].slice(0, 10),
      isOpen: false,
      query: '',
    }));
    
    saveState();
    
    // Execute action
    if (command.action) {
      command.action();
    } else if (command.href) {
      window.location.href = command.href;
    }
    
    onCommand?.(command);
  }, [onCommand, saveState]);

  // Navigate with keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, flatItems.length - 1),
        }));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatItems[state.selectedIndex]) {
          executeCommand(flatItems[state.selectedIndex]);
        }
        break;
      case 'Tab':
        e.preventDefault();
        // Cycle through categories
        break;
    }
  }, [flatItems, state.selectedIndex, executeCommand]);

  // Toggle favorite
  const toggleFavorite = useCallback((commandId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setState(prev => ({
      ...prev,
      favoriteCommands: prev.favoriteCommands.includes(commandId)
        ? prev.favoriteCommands.filter(id => id !== commandId)
        : [...prev.favoriteCommands, commandId],
    }));
    saveState();
  }, [saveState]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector('[data-selected="true"]');
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [state.selectedIndex]);

  return (
    <>
      {/* Trigger button (can be hidden if using keyboard only) */}
      <button
        onClick={() => setState(prev => ({ ...prev, isOpen: true }))}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-sm text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-xs font-mono">
          <CommandIcon className="h-3 w-3" />K
        </kbd>
      </button>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {state.isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setState(prev => ({ ...prev, isOpen: false, query: '' }))}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed left-1/2 top-[15%] -translate-x-1/2 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden z-50"
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b dark:border-slate-700">
                <Search className="h-5 w-5 text-gray-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={state.query}
                  onChange={(e) => setState(prev => ({ ...prev, query: e.target.value, selectedIndex: 0 }))}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-lg outline-none placeholder:text-gray-400"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {state.query && (
                  <button
                    onClick={() => setState(prev => ({ ...prev, query: '', selectedIndex: 0 }))}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded text-xs text-gray-400">
                  esc
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-96 overflow-auto p-2">
                {filteredGroups.length === 0 ? (
                  <div className="py-12 text-center">
                    <Sparkles className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500">No results found for &quot;{state.query}&quot;</p>
                    <p className="text-sm text-gray-400 mt-1">Try searching for something else</p>
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.id} className="mb-4 last:mb-0">
                      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
                        {group.id === 'recent' && <Clock className="h-3 w-3" />}
                        {group.id === 'favorites' && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                        {group.title}
                      </div>
                      
                      {group.items.map((item, index) => {
                        const globalIndex = filteredGroups
                          .slice(0, filteredGroups.indexOf(group))
                          .reduce((acc, g) => acc + g.items.length, 0) + index;
                        const isSelected = globalIndex === state.selectedIndex;
                        const isFavorite = state.favoriteCommands.includes(item.id);
                        const itemWithIndices = item as CommandItem & { _titleIndices?: number[]; _subtitleIndices?: number[] };
                        
                        return (
                          <motion.button
                            key={item.id}
                            data-selected={isSelected}
                            onClick={() => executeCommand(item)}
                            onMouseEnter={() => setState(prev => ({ ...prev, selectedIndex: globalIndex }))}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                              isSelected
                                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                            )}
                          >
                            {/* Icon */}
                            <div className={cn(
                              'flex items-center justify-center w-9 h-9 rounded-lg shrink-0',
                              isSelected
                                ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600'
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                            )}>
                              {item.icon || <Hash className="h-4 w-4" />}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {itemWithIndices._titleIndices 
                                  ? highlightMatch(item.title, itemWithIndices._titleIndices)
                                  : item.title}
                                {item.isNew && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-600 text-xs rounded">
                                    New
                                  </span>
                                )}
                              </div>
                              {item.subtitle && (
                                <div className="text-xs text-gray-500 truncate">
                                  {itemWithIndices._subtitleIndices
                                    ? highlightMatch(item.subtitle, itemWithIndices._subtitleIndices)
                                    : item.subtitle}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={(e) => toggleFavorite(item.id, e)}
                                className={cn(
                                  'p-1 rounded transition-colors',
                                  isFavorite
                                    ? 'text-yellow-400'
                                    : 'text-gray-300 hover:text-yellow-400 opacity-0 group-hover:opacity-100'
                                )}
                                style={{ opacity: isFavorite ? 1 : undefined }}
                              >
                                <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
                              </button>
                              
                              {item.shortcut && (
                                <kbd className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded text-xs text-gray-400 font-mono">
                                  {item.shortcut}
                                </kbd>
                              )}
                              
                              {isSelected && (
                                <ChevronRight className="h-4 w-4 text-purple-500" />
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-xs text-gray-400">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded">↓</kbd>
                    <span className="ml-1">Navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded">↵</kbd>
                    <span className="ml-1">Select</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded">tab</kbd>
                    <span className="ml-1">Switch category</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Powered by Real-Time Pulse</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ==================== HOOK FOR PROGRAMMATIC ACCESS ====================

export function useCommandPalette() {
  const open = useCallback(() => {
    // Dispatch keyboard event to open palette
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  }, []);

  const registerCommand = useCallback((command: CommandItem) => {
    // This would need a context to properly register
    console.log('Register command:', command);
  }, []);

  return { open, registerCommand };
}

export default CommandPalette;
