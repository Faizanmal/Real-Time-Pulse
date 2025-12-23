'use client';

/**
 * ============================================================================
 * SMART ONBOARDING & HELP SYSTEM
 * ============================================================================
 * Interactive product tour, contextual help, keyboard shortcuts panel,
 * and quick start wizard for new users.
 */

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  ReactNode 
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Lightbulb,
  Keyboard,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Play,
  Pause,
  SkipForward,
  Info,
  Book,
  Rocket,
  LayoutDashboard,
  Bell,
  Settings,
  Users,
  BarChart3,
  Zap
} from 'lucide-react';

// ==================== TYPES ====================

interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string | ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  highlight?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  skipable?: boolean;
}

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentTourStep: number;
  completedSteps: string[];
  dismissedHints: string[];
  preferences: {
    showHints: boolean;
    tourAutoPlay: boolean;
  };
}

interface OnboardingContextValue {
  state: OnboardingState;
  startTour: (tourId: string) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeOnboarding: () => void;
  showHint: (hintId: string) => boolean;
  dismissHint: (hintId: string) => void;
  toggleHints: () => void;
  isInTour: boolean;
  currentTour: string | null;
}

// ==================== TOUR DEFINITIONS ====================

const MAIN_TOUR: TourStep[] = [
  {
    id: 'welcome',
    target: '[data-tour="dashboard-header"]',
    title: 'Welcome to Real-Time Pulse! 🎉',
    content: 'This quick tour will help you get started with your new dashboard platform.',
    placement: 'bottom',
  },
  {
    id: 'portals',
    target: '[data-tour="portals-section"]',
    title: 'Your Portals',
    content: 'Portals are your client dashboards. Each portal contains widgets that display real-time data from your integrations.',
    placement: 'right',
    highlight: true,
  },
  {
    id: 'create-portal',
    target: '[data-tour="create-portal-btn"]',
    title: 'Create Your First Portal',
    content: 'Click here to create a new portal for your client. You can customize it with widgets, branding, and more.',
    placement: 'bottom',
    action: {
      label: 'Create Portal',
      onClick: () => {}, // Will be connected to actual action
    },
  },
  {
    id: 'integrations',
    target: '[data-tour="integrations"]',
    title: 'Connect Your Tools',
    content: 'Connect your favorite tools like Asana, Google Analytics, GitHub, and more to pull in real-time data.',
    placement: 'left',
    highlight: true,
  },
  {
    id: 'notifications',
    target: '[data-tour="notifications"]',
    title: 'Stay Updated',
    content: 'Real-time notifications keep you informed about important changes and alerts.',
    placement: 'bottom',
  },
  {
    id: 'settings',
    target: '[data-tour="settings"]',
    title: 'Customize Your Experience',
    content: 'Configure your workspace, team settings, billing, and security preferences here.',
    placement: 'left',
  },
  {
    id: 'complete',
    target: '[data-tour="dashboard-header"]',
    title: "You're All Set! 🚀",
    content: 'You now know the basics. Explore more features or start creating your first portal!',
    placement: 'bottom',
  },
];

const TOURS: Record<string, TourStep[]> = {
  main: MAIN_TOUR,
};

// ==================== CONTEXT ====================

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const STORAGE_KEY = 'pulse_onboarding_state';

const DEFAULT_STATE: OnboardingState = {
  hasCompletedOnboarding: false,
  currentTourStep: 0,
  completedSteps: [],
  dismissedHints: [],
  preferences: {
    showHints: true,
    tourAutoPlay: false,
  },
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [isInTour, setIsInTour] = useState(false);
  const [currentTour, setCurrentTour] = useState<string | null>(null);

  // Load state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setState(JSON.parse(saved));
      }
    } catch {
      // Use default state
    }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore save errors
    }
  }, [state]);

  const startTour = useCallback((tourId: string) => {
    if (!TOURS[tourId]) return;
    setCurrentTour(tourId);
    setIsInTour(true);
    setState(prev => ({ ...prev, currentTourStep: 0 }));
  }, []);

  const endTour = useCallback(() => {
    setIsInTour(false);
    setCurrentTour(null);
  }, []);

  const nextStep = useCallback(() => {
    const tour = currentTour ? TOURS[currentTour] : null;
    if (!tour) return;

    setState(prev => {
      const nextStepIndex = prev.currentTourStep + 1;
      if (nextStepIndex >= tour.length) {
        setIsInTour(false);
        setCurrentTour(null);
        return {
          ...prev,
          currentTourStep: 0,
          completedSteps: [...prev.completedSteps, currentTour!],
        };
      }
      return { ...prev, currentTourStep: nextStepIndex };
    });
  }, [currentTour]);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentTourStep: Math.max(0, prev.currentTourStep - 1),
    }));
  }, []);

  const skipTour = useCallback(() => {
    endTour();
  }, [endTour]);

  const completeOnboarding = useCallback(() => {
    setState(prev => ({ ...prev, hasCompletedOnboarding: true }));
    endTour();
  }, [endTour]);

  const showHint = useCallback((hintId: string): boolean => {
    return state.preferences.showHints && !state.dismissedHints.includes(hintId);
  }, [state.preferences.showHints, state.dismissedHints]);

  const dismissHint = useCallback((hintId: string) => {
    setState(prev => ({
      ...prev,
      dismissedHints: [...prev.dismissedHints, hintId],
    }));
  }, []);

  const toggleHints = useCallback(() => {
    setState(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        showHints: !prev.preferences.showHints,
      },
    }));
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        state,
        startTour,
        endTour,
        nextStep,
        prevStep,
        skipTour,
        completeOnboarding,
        showHint,
        dismissHint,
        toggleHints,
        isInTour,
        currentTour,
      }}
    >
      {children}
      {isInTour && currentTour && (
        <TourOverlay
          tour={TOURS[currentTour]}
          currentStep={state.currentTourStep}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
          onComplete={completeOnboarding}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}

// ==================== TOUR OVERLAY ====================

interface TourOverlayProps {
  tour: TourStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

function TourOverlay({ tour, currentStep, onNext, onPrev, onSkip, onComplete }: TourOverlayProps) {
  const step = tour[currentStep];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tour.length - 1;

  useEffect(() => {
    const target = document.querySelector(step.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);
      
      // Scroll target into view
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [step.target]);

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const padding = 16;
    const placement = step.placement || 'bottom';

    switch (placement) {
      case 'top':
        return {
          top: targetRect.top - padding,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translate(-50%, -100%)',
        };
      case 'bottom':
        return {
          top: targetRect.bottom + padding,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translate(-50%, 0)',
        };
      case 'left':
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left - padding,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + padding,
          transform: 'translate(0, -50%)',
        };
      default:
        return {
          top: targetRect.bottom + padding,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translate(-50%, 0)',
        };
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999]">
        {/* Backdrop with spotlight */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70"
          style={{
            maskImage: targetRect && step.highlight
              ? `radial-gradient(ellipse ${targetRect.width + 40}px ${targetRect.height + 40}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 50%, black 51%)`
              : undefined,
            WebkitMaskImage: targetRect && step.highlight
              ? `radial-gradient(ellipse ${targetRect.width + 40}px ${targetRect.height + 40}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 50%, black 51%)`
              : undefined,
          }}
          onClick={onSkip}
        />

        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute z-10 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden"
          style={getTooltipPosition() as React.CSSProperties}
        >
          {/* Progress bar */}
          <div className="h-1 bg-gray-200 dark:bg-slate-700">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / tour.length) * 100}%` }}
            />
          </div>

          <div className="p-5">
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Step {currentStep + 1} of {tour.length}
              </span>
              <button
                onClick={onSkip}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Skip tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {step.title}
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {step.content}
            </div>

            {/* Action button */}
            {step.action && (
              <Button
                onClick={step.action.onClick}
                className="w-full mb-4 bg-gradient-to-r from-purple-500 to-pink-500"
              >
                {step.action.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrev}
                disabled={isFirstStep}
                className="text-gray-500"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              {isLastStep ? (
                <Button
                  onClick={onComplete}
                  size="sm"
                  className="bg-gradient-to-r from-green-500 to-emerald-500"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Complete
                </Button>
              ) : (
                <Button
                  onClick={onNext}
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-pink-500"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ==================== CONTEXTUAL HINT ====================

interface HintProps {
  id: string;
  children: ReactNode;
  content: string | ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Hint({ id, children, content, placement = 'top', className }: HintProps) {
  const { showHint, dismissHint } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (showHint(id)) {
      // Delay showing hint
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [id, showHint]);

  if (!isVisible) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative inline-block', className)}>
      {children}
      
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={cn(
            'absolute z-50 w-64 p-3 bg-purple-600 text-white text-sm rounded-lg shadow-lg',
            placement === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-2',
            placement === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-2',
            placement === 'left' && 'right-full top-1/2 -translate-y-1/2 mr-2',
            placement === 'right' && 'left-full top-1/2 -translate-y-1/2 ml-2'
          )}
        >
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{content}</div>
            <button
              onClick={() => {
                dismissHint(id);
                setIsVisible(false);
              }}
              className="shrink-0 hover:bg-white/20 rounded p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          
          {/* Arrow */}
          <div
            className={cn(
              'absolute w-2 h-2 bg-purple-600 rotate-45',
              placement === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
              placement === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
              placement === 'left' && 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
              placement === 'right' && 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2'
            )}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ==================== KEYBOARD SHORTCUTS PANEL ====================

interface Shortcut {
  key: string;
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  { key: '⌘K', description: 'Open command palette', category: 'Navigation' },
  { key: '⌘/', description: 'Toggle sidebar', category: 'Navigation' },
  { key: '⌘B', description: 'Toggle sidebar', category: 'Navigation' },
  { key: 'G H', description: 'Go to home', category: 'Navigation' },
  { key: 'G P', description: 'Go to portals', category: 'Navigation' },
  { key: 'G S', description: 'Go to settings', category: 'Navigation' },
  { key: '⌘N', description: 'Create new portal', category: 'Actions' },
  { key: '⌘S', description: 'Save changes', category: 'Actions' },
  { key: '⌘⇧E', description: 'Export data', category: 'Actions' },
  { key: 'Esc', description: 'Close modal/dialog', category: 'General' },
  { key: '?', description: 'Show keyboard shortcuts', category: 'General' },
];

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  const categories = [...new Set(SHORTCUTS.map(s => s.category))];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-purple-500" />
                <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-auto">
              {categories.map(category => (
                <div key={category} className="mb-6 last:mb-0">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {SHORTCUTS.filter(s => s.category === category).map(shortcut => (
                      <div
                        key={shortcut.key}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shortcut.description}
                        </span>
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded text-xs font-mono">
                          {shortcut.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ==================== QUICK START WIZARD ====================

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  action: string;
  completed?: boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'workspace',
    title: 'Set up your workspace',
    description: 'Add your company logo and customize branding',
    icon: <LayoutDashboard className="h-6 w-6" />,
    action: '/dashboard/settings/workspace',
  },
  {
    id: 'integrations',
    title: 'Connect integrations',
    description: 'Link your tools like Asana, Google Analytics, and more',
    icon: <Zap className="h-6 w-6" />,
    action: '/dashboard/integrations',
  },
  {
    id: 'portal',
    title: 'Create your first portal',
    description: 'Build a beautiful dashboard for your clients',
    icon: <BarChart3 className="h-6 w-6" />,
    action: '/dashboard/portals/new',
  },
  {
    id: 'team',
    title: 'Invite team members',
    description: 'Collaborate with your team on client dashboards',
    icon: <Users className="h-6 w-6" />,
    action: '/dashboard/settings/team',
  },
  {
    id: 'notifications',
    title: 'Configure notifications',
    description: 'Set up alerts and stay informed about changes',
    icon: <Bell className="h-6 w-6" />,
    action: '/dashboard/settings/notifications',
  },
];

interface QuickStartWizardProps {
  isOpen: boolean;
  onClose: () => void;
  completedSteps?: string[];
}

export function QuickStartWizard({ isOpen, onClose, completedSteps = [] }: QuickStartWizardProps) {
  const progress = (completedSteps.length / WIZARD_STEPS.length) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed right-4 top-20 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-40 overflow-hidden"
        >
          <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                <h3 className="font-semibold">Quick Start</h3>
              </div>
              <button onClick={onClose} className="hover:bg-white/20 rounded p-1 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span>{completedSteps.length} of {WIZARD_STEPS.length} completed</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-4 max-h-96 overflow-auto">
            {WIZARD_STEPS.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id);
              
              return (
                <motion.a
                  key={step.id}
                  href={step.action}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg transition-colors mb-2 last:mb-0',
                    isCompleted
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                  )}
                >
                  <div
                    className={cn(
                      'p-2 rounded-lg shrink-0',
                      isCompleted
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-600'
                        : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600'
                    )}
                  >
                    {isCompleted ? <Check className="h-6 w-6" /> : step.icon}
                  </div>
                  <div>
                    <h4 className={cn(
                      'font-medium text-sm',
                      isCompleted && 'line-through text-gray-500'
                    )}>
                      {step.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                  </div>
                </motion.a>
              );
            })}
          </div>

          {progress === 100 && (
            <div className="p-4 border-t dark:border-slate-700 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-2 text-green-600">
                <Sparkles className="h-5 w-5" />
                <span className="font-medium">All done! You&apos;re ready to go.</span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ==================== HELP BUTTON ====================

export function HelpButton() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { startTour } = useOnboarding();

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="rounded-full"
        aria-label="Help"
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl z-50 overflow-hidden"
            >
              <div className="p-2">
                <button
                  onClick={() => {
                    startTour('main');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Play className="h-5 w-5 text-purple-500" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Take a Tour</div>
                    <div className="text-xs text-gray-500">Learn the basics</div>
                  </div>
                </button>
                
                <a
                  href="/docs"
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Book className="h-5 w-5 text-blue-500" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Documentation</div>
                    <div className="text-xs text-gray-500">Detailed guides</div>
                  </div>
                </a>

                <button
                  onClick={() => {
                    // Open keyboard shortcuts
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Keyboard className="h-5 w-5 text-green-500" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Keyboard Shortcuts</div>
                    <div className="text-xs text-gray-500">Press ? anytime</div>
                  </div>
                </button>

                <a
                  href="mailto:support@realtimepulse.io"
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Info className="h-5 w-5 text-orange-500" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Contact Support</div>
                    <div className="text-xs text-gray-500">We&apos;re here to help</div>
                  </div>
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default {
  OnboardingProvider,
  useOnboarding,
  Hint,
  KeyboardShortcutsPanel,
  QuickStartWizard,
  HelpButton,
};
