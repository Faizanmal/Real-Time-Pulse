'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'type' | 'navigate' | 'custom';
  actionTarget?: string;
  skipable?: boolean;
  nextOnAction?: boolean; // Auto advance when action is completed
}

interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  requiredRole?: string;
  estimatedMinutes?: number;
}

interface TutorialContextType {
  activeTutorial: Tutorial | null;
  currentStepIndex: number;
  isActive: boolean;
  completedTutorials: string[];
  startTutorial: (tutorialId: string) => void;
  endTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  markAsCompleted: (tutorialId: string) => void;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

// Pre-defined tutorials
const TUTORIALS: Tutorial[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the basics of Real-Time Pulse',
    estimatedMinutes: 5,
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Real-Time Pulse!',
        content: 'Let\'s take a quick tour to help you get started with your analytics dashboard.',
        position: 'bottom',
      },
      {
        id: 'dashboard-overview',
        title: 'Your Dashboard',
        content: 'This is your main dashboard where you can view all your analytics at a glance.',
        target: '[data-tutorial="dashboard"]',
        position: 'bottom',
      },
      {
        id: 'add-widget',
        title: 'Adding Widgets',
        content: 'Click the "Add Widget" button to add new visualizations to your dashboard.',
        target: '[data-tutorial="add-widget-button"]',
        position: 'bottom',
        action: 'click',
        nextOnAction: true,
      },
      {
        id: 'widget-types',
        title: 'Choose a Widget Type',
        content: 'Select from various widget types including charts, KPIs, tables, and more.',
        target: '[data-tutorial="widget-picker"]',
        position: 'right',
      },
      {
        id: 'configure-widget',
        title: 'Configure Your Widget',
        content: 'Customize your widget by selecting data sources, metrics, and styling options.',
        target: '[data-tutorial="widget-config"]',
        position: 'left',
      },
      {
        id: 'share',
        title: 'Sharing & Collaboration',
        content: 'Share your dashboards with team members or embed them in your website.',
        target: '[data-tutorial="share-button"]',
        position: 'bottom',
      },
      {
        id: 'complete',
        title: 'You\'re All Set!',
        content: 'You now know the basics. Explore more features or check out our advanced tutorials.',
      },
    ],
  },
  {
    id: 'data-integration',
    name: 'Connecting Data Sources',
    description: 'Learn how to connect your data sources',
    estimatedMinutes: 8,
    steps: [
      {
        id: 'integrations-intro',
        title: 'Data Integrations',
        content: 'Connect to 50+ data sources including databases, APIs, and third-party services.',
        target: '[data-tutorial="integrations-menu"]',
        position: 'right',
      },
      {
        id: 'add-integration',
        title: 'Add a New Integration',
        content: 'Click here to add a new data source connection.',
        target: '[data-tutorial="add-integration"]',
        position: 'bottom',
        action: 'click',
      },
      {
        id: 'choose-source',
        title: 'Select Your Source',
        content: 'Choose from popular sources like PostgreSQL, MySQL, Google Analytics, Salesforce, and more.',
        target: '[data-tutorial="source-list"]',
        position: 'right',
      },
      {
        id: 'configure-connection',
        title: 'Configure Connection',
        content: 'Enter your credentials securely. All connections are encrypted.',
        target: '[data-tutorial="connection-form"]',
        position: 'left',
      },
      {
        id: 'test-connection',
        title: 'Test Your Connection',
        content: 'Always test your connection before saving to ensure everything works correctly.',
        target: '[data-tutorial="test-connection"]',
        position: 'top',
      },
    ],
  },
  {
    id: 'advanced-analytics',
    name: 'Advanced Analytics',
    description: 'Master advanced analytics features',
    estimatedMinutes: 10,
    steps: [
      {
        id: 'ai-insights',
        title: 'AI-Powered Insights',
        content: 'Let our AI analyze your data and surface actionable insights automatically.',
        target: '[data-tutorial="ai-insights"]',
        position: 'bottom',
      },
      {
        id: 'predictive',
        title: 'Predictive Analytics',
        content: 'Use machine learning to forecast trends and detect anomalies.',
        target: '[data-tutorial="predictive"]',
        position: 'right',
      },
      {
        id: 'natural-language',
        title: 'Ask Questions in Plain English',
        content: 'Type questions like "What were my sales last month?" and get instant answers.',
        target: '[data-tutorial="nl-query"]',
        position: 'bottom',
        action: 'type',
      },
      {
        id: 'custom-formulas',
        title: 'Custom Calculations',
        content: 'Create custom metrics and calculated fields using our formula builder.',
        target: '[data-tutorial="formula-builder"]',
        position: 'right',
      },
    ],
  },
];

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);

  // Load completed tutorials from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('completedTutorials');
    if (saved) {
      setCompletedTutorials(JSON.parse(saved));
    }
  }, []);

  // Save completed tutorials
  useEffect(() => {
    localStorage.setItem('completedTutorials', JSON.stringify(completedTutorials));
  }, [completedTutorials]);

  const startTutorial = useCallback((tutorialId: string) => {
    const tutorial = TUTORIALS.find((t) => t.id === tutorialId);
    if (tutorial) {
      setActiveTutorial(tutorial);
      setCurrentStepIndex(0);
    }
  }, []);

  const endTutorial = useCallback(() => {
    setActiveTutorial(null);
    setCurrentStepIndex(0);
  }, []);

  const nextStep = useCallback(() => {
    if (activeTutorial && currentStepIndex < activeTutorial.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Tutorial completed
      if (activeTutorial) {
        markAsCompleted(activeTutorial.id);
      }
      endTutorial();
    }
  }, [activeTutorial, currentStepIndex]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const skipTutorial = useCallback(() => {
    endTutorial();
  }, [endTutorial]);

  const markAsCompleted = useCallback((tutorialId: string) => {
    setCompletedTutorials((prev) => {
      if (!prev.includes(tutorialId)) {
        return [...prev, tutorialId];
      }
      return prev;
    });
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        activeTutorial,
        currentStepIndex,
        isActive: !!activeTutorial,
        completedTutorials,
        startTutorial,
        endTutorial,
        nextStep,
        previousStep,
        skipTutorial,
        markAsCompleted,
      }}
    >
      {children}
      {activeTutorial && (
        <TutorialOverlay
          tutorial={activeTutorial}
          currentStep={currentStepIndex}
          onNext={nextStep}
          onPrevious={previousStep}
          onSkip={skipTutorial}
        />
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}

// Tutorial overlay component
interface TutorialOverlayProps {
  tutorial: Tutorial;
  currentStep: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

function TutorialOverlay({ tutorial, currentStep, onNext, onPrevious, onSkip }: TutorialOverlayProps) {
  const step = tutorial.steps[currentStep];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (step.target) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [step.target, currentStep]);

  const getTooltipPosition = () => {
    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const position = step.position || 'bottom';

    switch (position) {
      case 'top':
        return {
          bottom: `${window.innerHeight - targetRect.top + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          right: `${window.innerWidth - targetRect.left + padding}px`,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.right + padding}px`,
          transform: 'translateY(-50%)',
        };
      default:
        return {};
    }
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay with spotlight */}
      <div className="absolute inset-0 bg-black/50">
        {targetRect && (
          <div
            className="absolute bg-transparent"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              borderRadius: '8px',
            }}
          />
        )}
      </div>

      {/* Highlight ring */}
      {targetRect && (
        <div
          className="absolute border-2 border-blue-500 rounded-lg pointer-events-none animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="absolute bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
        style={getTooltipPosition()}
      >
        {/* Progress */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-1">
            {tutorial.steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentStep + 1} of {tutorial.steps.length}
          </span>
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {step.title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {step.content}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Skip tutorial
          </button>
          <div className="flex space-x-2">
            {currentStep > 0 && (
              <button
                onClick={onPrevious}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg"
              >
                Previous
              </button>
            )}
            <button
              onClick={onNext}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg"
            >
              {currentStep === tutorial.steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tutorial launcher component
export function TutorialLauncher() {
  const { startTutorial, completedTutorials } = useTutorial();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span>Tutorials</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Interactive Tutorials</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Learn how to use Real-Time Pulse
            </p>
          </div>
          <div className="p-2 max-h-96 overflow-auto">
            {TUTORIALS.map((tutorial) => {
              const isCompleted = completedTutorials.includes(tutorial.id);
              return (
                <button
                  key={tutorial.id}
                  onClick={() => {
                    startTutorial(tutorial.id);
                    setIsOpen(false);
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {tutorial.name}
                        </span>
                        {isCompleted && (
                          <span className="text-green-500">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {tutorial.description}
                      </p>
                      {tutorial.estimatedMinutes && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          ~{tutorial.estimatedMinutes} min
                        </p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { TUTORIALS };
