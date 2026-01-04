"use client";

import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Lightbulb, X, ChevronRight, ChevronLeft, CheckCircle2, Sparkles,
    Target, Rocket, Star, Play, SkipForward, HelpCircle, MousePointer2,
    Hand, Info, AlertCircle, ArrowRight, Gift, Zap,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    target?: string; // CSS selector for highlighting
    position?: "top" | "bottom" | "left" | "right" | "center";
    action?: "click" | "type" | "scroll" | "hover" | "none";
    completionCheck?: () => boolean;
    image?: string;
    video?: string;
    tips?: string[];
    nextLabel?: string;
    skipLabel?: string;
}

interface OnboardingTour {
    id: string;
    name: string;
    description: string;
    steps: OnboardingStep[];
    estimatedTime?: string;
    icon?: React.ReactNode;
}

// ============================================================================
// SPOTLIGHT HIGHLIGHT
// ============================================================================

interface SpotlightHighlightProps {
    target: string;
    active: boolean;
    padding?: number;
    className?: string;
}

export function SpotlightHighlight({
    target,
    active,
    padding = 8,
    className,
}: SpotlightHighlightProps) {
    const [rect, setRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!active) return;

        const updateRect = () => {
            const element = document.querySelector(target);
            if (element) {
                setRect(element.getBoundingClientRect());
            }
        };

        updateRect();
        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect);

        return () => {
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect);
        };
    }, [target, active]);

    if (!active || !rect) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("fixed inset-0 z-[9998] pointer-events-none", className)}
        >
            {/* Overlay with cutout */}
            <svg className="h-full w-full">
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        <rect
                            x={rect.left - padding}
                            y={rect.top - padding}
                            width={rect.width + padding * 2}
                            height={rect.height + padding * 2}
                            rx="8"
                            fill="black"
                        />
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(0,0,0,0.7)"
                    mask="url(#spotlight-mask)"
                />
            </svg>

            {/* Highlight border */}
            <motion.div
                className="absolute rounded-lg border-2 border-purple-500 shadow-[0_0_20px_rgba(139,92,246,0.5)]"
                style={{
                    left: rect.left - padding,
                    top: rect.top - padding,
                    width: rect.width + padding * 2,
                    height: rect.height + padding * 2,
                }}
                animate={{
                    boxShadow: [
                        "0 0 20px rgba(139,92,246,0.5)",
                        "0 0 40px rgba(139,92,246,0.7)",
                        "0 0 20px rgba(139,92,246,0.5)",
                    ],
                }}
                transition={{ repeat: Infinity, duration: 2 }}
            />
        </motion.div>
    );
}

// ============================================================================
// TOOLTIP GUIDE
// ============================================================================

interface TooltipGuideProps {
    step: OnboardingStep;
    currentStep: number;
    totalSteps: number;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
    onComplete: () => void;
    className?: string;
}

export function TooltipGuide({
    step,
    currentStep,
    totalSteps,
    onNext,
    onPrev,
    onSkip,
    onComplete,
    className,
}: TooltipGuideProps) {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const tooltipRef = useRef<HTMLDivElement>(null);

    const isLastStep = currentStep === totalSteps - 1;

    useEffect(() => {
        if (!step.target) {
            // Center position for non-targeted steps
            setPosition({
                x: window.innerWidth / 2 - 175,
                y: window.innerHeight / 2 - 100,
            });
            return;
        }

        const element = document.querySelector(step.target);
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const tooltipWidth = 350;
        const tooltipHeight = 200;
        const padding = 16;

        let x = 0;
        let y = 0;

        switch (step.position || "bottom") {
            case "top":
                x = rect.left + rect.width / 2 - tooltipWidth / 2;
                y = rect.top - tooltipHeight - padding;
                break;
            case "bottom":
                x = rect.left + rect.width / 2 - tooltipWidth / 2;
                y = rect.bottom + padding;
                break;
            case "left":
                x = rect.left - tooltipWidth - padding;
                y = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
            case "right":
                x = rect.right + padding;
                y = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
            case "center":
                x = window.innerWidth / 2 - tooltipWidth / 2;
                y = window.innerHeight / 2 - tooltipHeight / 2;
                break;
        }

        // Keep within viewport
        x = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, x));
        y = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, y));

        setPosition({ x, y });
    }, [step]);

    return (
        <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className={cn(
                "fixed z-[9999] w-[350px] rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-800",
                className
            )}
            style={{ left: position.x, top: position.y }}
        >
            {/* Progress */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium text-gray-500">
                        Step {currentStep + 1} of {totalSteps}
                    </span>
                </div>
                <button
                    onClick={onSkip}
                    className="text-gray-400 hover:text-gray-600"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Progress bar */}
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                />
            </div>

            {/* Content */}
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                {step.title}
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {step.description}
            </p>

            {/* Tips */}
            {step.tips && step.tips.length > 0 && (
                <div className="mb-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                    <div className="flex items-start gap-2">
                        <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                        <div className="space-y-1">
                            {step.tips.map((tip, i) => (
                                <p key={i} className="text-sm text-amber-800 dark:text-amber-400">
                                    {tip}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Action hint */}
            {step.action && step.action !== "none" && (
                <div className="mb-4 flex items-center gap-2 text-sm text-purple-600">
                    {step.action === "click" && <MousePointer2 className="h-4 w-4" />}
                    {step.action === "hover" && <Hand className="h-4 w-4" />}
                    <span>
                        {step.action === "click" && "Click the highlighted element"}
                        {step.action === "hover" && "Hover over the highlighted area"}
                        {step.action === "type" && "Type in the highlighted field"}
                        {step.action === "scroll" && "Scroll to see more"}
                    </span>
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onPrev}
                    disabled={currentStep === 0}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                </button>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onSkip}
                        className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        {step.skipLabel || "Skip tour"}
                    </button>
                    <button
                        onClick={isLastStep ? onComplete : onNext}
                        className="flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600"
                    >
                        {step.nextLabel || (isLastStep ? "Complete" : "Next")}
                        {isLastStep ? <CheckCircle2 className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ============================================================================
// ONBOARDING TOUR CONTEXT
// ============================================================================

interface OnboardingContextType {
    activeTour: OnboardingTour | null;
    currentStep: number;
    startTour: (tour: OnboardingTour) => void;
    endTour: () => void;
    nextStep: () => void;
    prevStep: () => void;
    skipTour: () => void;
    completeTour: () => void;
    completedTours: string[];
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
    const [activeTour, setActiveTour] = useState<OnboardingTour | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [completedTours, setCompletedTours] = useState<string[]>([]);

    const startTour = useCallback((tour: OnboardingTour) => {
        setActiveTour(tour);
        setCurrentStep(0);
    }, []);

    const endTour = useCallback(() => {
        setActiveTour(null);
        setCurrentStep(0);
    }, []);

    const nextStep = useCallback(() => {
        if (activeTour && currentStep < activeTour.steps.length - 1) {
            setCurrentStep((s) => s + 1);
        }
    }, [activeTour, currentStep]);

    const prevStep = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep((s) => s - 1);
        }
    }, [currentStep]);

    const skipTour = useCallback(() => {
        endTour();
    }, [endTour]);

    const completeTour = useCallback(() => {
        if (activeTour) {
            setCompletedTours((prev) => [...prev, activeTour.id]);
        }
        endTour();
    }, [activeTour, endTour]);

    return (
        <OnboardingContext.Provider
            value={{
                activeTour,
                currentStep,
                startTour,
                endTour,
                nextStep,
                prevStep,
                skipTour,
                completeTour,
                completedTours,
            }}
        >
            {children}
            <AnimatePresence>
                {activeTour && (
                    <>
                        <SpotlightHighlight
                            target={activeTour.steps[currentStep]?.target || ""}
                            active={!!activeTour.steps[currentStep]?.target}
                        />
                        <TooltipGuide
                            step={activeTour.steps[currentStep]}
                            currentStep={currentStep}
                            totalSteps={activeTour.steps.length}
                            onNext={nextStep}
                            onPrev={prevStep}
                            onSkip={skipTour}
                            onComplete={completeTour}
                        />
                    </>
                )}
            </AnimatePresence>
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error("useOnboarding must be used within an OnboardingProvider");
    }
    return context;
}

// ============================================================================
// TOUR LAUNCHER
// ============================================================================

interface TourLauncherProps {
    tours: OnboardingTour[];
    className?: string;
}

export function TourLauncher({ tours, className }: TourLauncherProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { startTour, completedTours } = useOnboarding();

    return (
        <div className={cn("relative", className)}>
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
            >
                <HelpCircle className="h-6 w-6" />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-2 w-80 rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800"
                    >
                        <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
                            <Rocket className="h-5 w-5 text-purple-500" />
                            Interactive Tours
                        </h3>

                        <div className="space-y-2">
                            {tours.map((tour) => {
                                const isCompleted = completedTours.includes(tour.id);
                                return (
                                    <button
                                        key={tour.id}
                                        onClick={() => {
                                            startTour(tour);
                                            setIsOpen(false);
                                        }}
                                        className={cn(
                                            "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors",
                                            isCompleted
                                                ? "bg-green-50 dark:bg-green-900/20"
                                                : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex h-10 w-10 items-center justify-center rounded-xl",
                                            isCompleted ? "bg-green-500 text-white" : "bg-purple-100 text-purple-600 dark:bg-purple-900/30"
                                        )}>
                                            {isCompleted ? (
                                                <CheckCircle2 className="h-5 w-5" />
                                            ) : (
                                                tour.icon || <Play className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900 dark:text-gray-100">
                                                {tour.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {tour.steps.length} steps • {tour.estimatedTime || "~2 min"}
                                            </p>
                                        </div>
                                        {isCompleted && (
                                            <span className="text-xs font-medium text-green-600">Completed</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// FEATURE ANNOUNCEMENT
// ============================================================================

interface FeatureAnnouncementProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    onDismiss?: () => void;
    variant?: "default" | "celebration" | "important";
    className?: string;
}

export function FeatureAnnouncement({
    title,
    description,
    icon,
    actionLabel = "Try it now",
    onAction,
    onDismiss,
    variant = "default",
    className,
}: FeatureAnnouncementProps) {
    const variants = {
        default: "from-blue-500/10 via-purple-500/10 to-pink-500/10 border-purple-500/30",
        celebration: "from-amber-500/10 via-orange-500/10 to-red-500/10 border-amber-500/30",
        important: "from-red-500/10 via-pink-500/10 to-purple-500/10 border-red-500/30",
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
                "relative overflow-hidden rounded-2xl border bg-gradient-to-r p-4",
                variants[variant],
                className
            )}
        >
            {/* Animated background sparkles */}
            {variant === "celebration" && (
                <div className="absolute inset-0 pointer-events-none">
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute h-2 w-2 rounded-full bg-amber-400"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{
                                opacity: [0, 1, 0],
                                scale: [0, 1, 0],
                                x: [0, (Math.random() - 0.5) * 100],
                                y: [0, (Math.random() - 0.5) * 50],
                            }}
                            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                        />
                    ))}
                </div>
            )}

            <div className="flex items-start gap-4">
                <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl",
                    variant === "celebration" && "bg-amber-500 text-white",
                    variant === "important" && "bg-red-500 text-white",
                    variant === "default" && "bg-purple-500 text-white"
                )}>
                    {icon || (variant === "celebration" ? <Gift className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />)}
                </div>

                <div className="flex-1">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{title}</h4>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>

                    <div className="mt-3 flex items-center gap-3">
                        {onAction && (
                            <button
                                onClick={onAction}
                                className={cn(
                                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white",
                                    variant === "celebration" && "bg-amber-500 hover:bg-amber-600",
                                    variant === "important" && "bg-red-500 hover:bg-red-600",
                                    variant === "default" && "bg-purple-500 hover:bg-purple-600"
                                )}
                            >
                                {actionLabel}
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        )}
                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Dismiss
                            </button>
                        )}
                    </div>
                </div>

                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { OnboardingStep, OnboardingTour };
