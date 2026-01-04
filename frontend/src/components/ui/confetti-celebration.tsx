"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Trophy, Star, Sparkles, PartyPopper, Medal, Crown, Zap, Target, Flame, Award } from "lucide-react";

// ============================================================================
// CONFETTI SYSTEM
// ============================================================================

interface ConfettiPiece {
    id: number;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    color: string;
    shape: "circle" | "square" | "triangle" | "star";
    velocityX: number;
    velocityY: number;
}

interface ConfettiCanvasProps {
    active: boolean;
    duration?: number;
    particleCount?: number;
    colors?: string[];
    spread?: number;
    origin?: { x: number; y: number };
}

const defaultColors = [
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#06b6d4", // cyan
    "#f97316", // orange
];

export function ConfettiCanvas({
    active,
    duration = 3000,
    particleCount = 100,
    colors = defaultColors,
    spread = 360,
    origin = { x: 0.5, y: 0.5 },
}: ConfettiCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const particlesRef = useRef<ConfettiPiece[]>([]);

    const createParticle = useCallback(
        (id: number): ConfettiPiece => {
            const angle = (Math.random() * spread * Math.PI) / 180;
            const velocity = 5 + Math.random() * 10;
            return {
                id,
                x: origin.x * (typeof window !== "undefined" ? window.innerWidth : 800),
                y: origin.y * (typeof window !== "undefined" ? window.innerHeight : 600),
                rotation: Math.random() * 360,
                scale: 0.5 + Math.random() * 0.5,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: (["circle", "square", "triangle", "star"] as const)[
                    Math.floor(Math.random() * 4)
                ],
                velocityX: Math.cos(angle) * velocity * (Math.random() > 0.5 ? 1 : -1),
                velocityY: -Math.abs(Math.sin(angle) * velocity) - 5,
            };
        },
        [colors, origin, spread]
    );

    useEffect(() => {
        if (!active || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set canvas size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Create particles
        particlesRef.current = Array.from({ length: particleCount }, (_, i) =>
            createParticle(i)
        );

        const gravity = 0.3;
        const friction = 0.99;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > duration) {
                cancelAnimationFrame(animationRef.current);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particlesRef.current.forEach((particle) => {
                // Update physics
                particle.velocityY += gravity;
                particle.velocityX *= friction;
                particle.x += particle.velocityX;
                particle.y += particle.velocityY;
                particle.rotation += particle.velocityX * 2;

                // Draw particle
                ctx.save();
                ctx.translate(particle.x, particle.y);
                ctx.rotate((particle.rotation * Math.PI) / 180);
                ctx.scale(particle.scale, particle.scale);
                ctx.fillStyle = particle.color;

                const size = 10;
                switch (particle.shape) {
                    case "circle":
                        ctx.beginPath();
                        ctx.arc(0, 0, size, 0, Math.PI * 2);
                        ctx.fill();
                        break;
                    case "square":
                        ctx.fillRect(-size / 2, -size / 2, size, size);
                        break;
                    case "triangle":
                        ctx.beginPath();
                        ctx.moveTo(0, -size);
                        ctx.lineTo(size, size);
                        ctx.lineTo(-size, size);
                        ctx.closePath();
                        ctx.fill();
                        break;
                    case "star":
                        ctx.beginPath();
                        for (let i = 0; i < 5; i++) {
                            const angle = ((i * 72 - 90) * Math.PI) / 180;
                            const innerAngle = (((i * 72 + 36) - 90) * Math.PI) / 180;
                            if (i === 0) {
                                ctx.moveTo(Math.cos(angle) * size, Math.sin(angle) * size);
                            } else {
                                ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
                            }
                            ctx.lineTo(
                                Math.cos(innerAngle) * (size / 2),
                                Math.sin(innerAngle) * (size / 2)
                            );
                        }
                        ctx.closePath();
                        ctx.fill();
                        break;
                }
                ctx.restore();
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [active, createParticle, duration, particleCount]);

    if (!active) return null;

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none fixed inset-0 z-[9999]"
            style={{ width: "100vw", height: "100vh" }}
        />
    );
}

// ============================================================================
// ACHIEVEMENT TOAST
// ============================================================================

type AchievementType =
    | "milestone"
    | "streak"
    | "goal"
    | "level-up"
    | "badge"
    | "record"
    | "challenge"
    | "bonus";

interface Achievement {
    id: string;
    type: AchievementType;
    title: string;
    description: string;
    value?: string | number;
    icon?: React.ReactNode;
    rarity?: "common" | "rare" | "epic" | "legendary";
}

const achievementIcons: Record<AchievementType, React.ReactNode> = {
    milestone: <Target className="h-6 w-6" />,
    streak: <Flame className="h-6 w-6" />,
    goal: <Trophy className="h-6 w-6" />,
    "level-up": <Zap className="h-6 w-6" />,
    badge: <Medal className="h-6 w-6" />,
    record: <Crown className="h-6 w-6" />,
    challenge: <Star className="h-6 w-6" />,
    bonus: <Sparkles className="h-6 w-6" />,
};

const rarityColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    common: {
        bg: "from-gray-500/20 to-gray-600/20",
        border: "border-gray-400/50",
        text: "text-gray-300",
        glow: "shadow-gray-500/30",
    },
    rare: {
        bg: "from-blue-500/20 to-cyan-500/20",
        border: "border-blue-400/50",
        text: "text-blue-300",
        glow: "shadow-blue-500/30",
    },
    epic: {
        bg: "from-purple-500/20 to-pink-500/20",
        border: "border-purple-400/50",
        text: "text-purple-300",
        glow: "shadow-purple-500/30",
    },
    legendary: {
        bg: "from-amber-500/20 to-orange-500/20",
        border: "border-amber-400/50",
        text: "text-amber-300",
        glow: "shadow-amber-500/30",
    },
};

interface AchievementToastProps {
    achievement: Achievement | null;
    onClose: () => void;
    showConfetti?: boolean;
}

export function AchievementToast({
    achievement,
    onClose,
    showConfetti = true,
}: AchievementToastProps) {
    const [isVisible, setIsVisible] = useState(false);
    const rarity = achievement?.rarity || "common";
    const colors = rarityColors[rarity];

    useEffect(() => {
        if (achievement) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [achievement, onClose]);

    return (
        <>
            {showConfetti && achievement && (
                <ConfettiCanvas
                    active={isVisible}
                    duration={3000}
                    particleCount={rarity === "legendary" ? 150 : rarity === "epic" ? 100 : 60}
                />
            )}
            <AnimatePresence>
                {isVisible && achievement && (
                    <motion.div
                        initial={{ opacity: 0, y: -100, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -50, scale: 0.9 }}
                        transition={{ type: "spring", damping: 15, stiffness: 300 }}
                        className="fixed top-6 left-1/2 z-[9998] -translate-x-1/2"
                    >
                        <div
                            className={cn(
                                "relative overflow-hidden rounded-2xl border-2 bg-gradient-to-r backdrop-blur-xl",
                                "px-6 py-4 shadow-2xl",
                                colors.bg,
                                colors.border,
                                colors.glow
                            )}
                        >
                            {/* Animated background glow */}
                            <motion.div
                                className="absolute inset-0 opacity-50"
                                animate={{
                                    background: [
                                        "radial-gradient(circle at 0% 50%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)",
                                        "radial-gradient(circle at 100% 50%, rgba(236, 72, 153, 0.3) 0%, transparent 50%)",
                                        "radial-gradient(circle at 0% 50%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)",
                                    ],
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />

                            <div className="relative flex items-center gap-4">
                                {/* Icon with animation */}
                                <motion.div
                                    initial={{ rotate: -180, scale: 0 }}
                                    animate={{ rotate: 0, scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring" }}
                                    className={cn(
                                        "flex h-14 w-14 items-center justify-center rounded-xl",
                                        "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg"
                                    )}
                                >
                                    {achievement.icon || achievementIcons[achievement.type]}
                                </motion.div>

                                <div className="flex-1">
                                    {/* Rarity label */}
                                    <motion.span
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className={cn(
                                            "text-xs font-bold uppercase tracking-wider",
                                            colors.text
                                        )}
                                    >
                                        {rarity} Achievement
                                    </motion.span>

                                    {/* Title */}
                                    <motion.h3
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.4 }}
                                        className="text-lg font-bold text-white"
                                    >
                                        {achievement.title}
                                    </motion.h3>

                                    {/* Description */}
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.5 }}
                                        className="text-sm text-gray-300"
                                    >
                                        {achievement.description}
                                    </motion.p>
                                </div>

                                {/* Value badge */}
                                {achievement.value && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.6, type: "spring" }}
                                        className="flex flex-col items-center justify-center rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm"
                                    >
                                        <span className="text-2xl font-bold text-white">
                                            {achievement.value}
                                        </span>
                                        <span className="text-xs text-gray-300">Points</span>
                                    </motion.div>
                                )}

                                {/* Close button */}
                                <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.7 }}
                                    onClick={() => {
                                        setIsVisible(false);
                                        setTimeout(onClose, 300);
                                    }}
                                    className="absolute right-2 top-2 rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </motion.button>
                            </div>

                            {/* Sparkle particles */}
                            {rarity !== "common" && (
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                    {[...Array(6)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute h-1 w-1 rounded-full bg-white"
                                            initial={{ opacity: 0, scale: 0 }}
                                            animate={{
                                                opacity: [0, 1, 0],
                                                scale: [0, 1, 0],
                                                x: [0, (Math.random() - 0.5) * 100],
                                                y: [0, (Math.random() - 0.5) * 50],
                                            }}
                                            transition={{
                                                duration: 2,
                                                delay: i * 0.3,
                                                repeat: Infinity,
                                            }}
                                            style={{
                                                left: `${20 + Math.random() * 60}%`,
                                                top: `${20 + Math.random() * 60}%`,
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// ============================================================================
// CELEBRATION PROVIDER & HOOK
// ============================================================================

import { createContext, useContext } from "react";

interface CelebrationContextType {
    celebrate: (achievement: Achievement) => void;
    showConfetti: (options?: Partial<ConfettiCanvasProps>) => void;
}

const CelebrationContext = createContext<CelebrationContextType | null>(null);

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
    const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
    const [confettiConfig, setConfettiConfig] = useState<ConfettiCanvasProps | null>(null);

    const celebrate = useCallback((achievement: Achievement) => {
        setCurrentAchievement(achievement);
    }, []);

    const showConfetti = useCallback((options?: Partial<ConfettiCanvasProps>) => {
        setConfettiConfig({
            active: true,
            duration: 3000,
            particleCount: 100,
            ...options,
        });
        setTimeout(() => setConfettiConfig(null), options?.duration || 3000);
    }, []);

    return (
        <CelebrationContext.Provider value={{ celebrate, showConfetti }}>
            {children}
            <AchievementToast
                achievement={currentAchievement}
                onClose={() => setCurrentAchievement(null)}
            />
            {confettiConfig && <ConfettiCanvas {...confettiConfig} />}
        </CelebrationContext.Provider>
    );
}

export function useCelebration() {
    const context = useContext(CelebrationContext);
    if (!context) {
        throw new Error("useCelebration must be used within a CelebrationProvider");
    }
    return context;
}

// ============================================================================
// QUICK CELEBRATION TRIGGERS
// ============================================================================

export const celebrations = {
    milestone: (title: string, description: string, value?: number): Achievement => ({
        id: `milestone-${Date.now()}`,
        type: "milestone" as const,
        title,
        description,
        value,
        rarity: "rare" as const,
    }),

    streak: (days: number): Achievement => ({
        id: `streak-${Date.now()}`,
        type: "streak" as const,
        title: `${days} Day Streak! 🔥`,
        description: `You've maintained a ${days}-day streak. Keep it up!`,
        value: days * 10,
        rarity: (days >= 30 ? "legendary" : days >= 14 ? "epic" : days >= 7 ? "rare" : "common") as "common" | "rare" | "epic" | "legendary",
    }),

    goal: (goalName: string, progress: number): Achievement => ({
        id: `goal-${Date.now()}`,
        type: "goal" as const,
        title: `Goal Achieved: ${goalName}`,
        description: `Congratulations! You've reached ${progress}% completion.`,
        value: progress,
        rarity: (progress >= 100 ? "epic" : "rare") as "common" | "rare" | "epic" | "legendary",
    }),

    levelUp: (level: number): Achievement => ({
        id: `level-${Date.now()}`,
        type: "level-up" as const,
        title: `Level ${level} Unlocked!`,
        description: "You've unlocked new features and rewards.",
        value: level * 100,
        rarity: (level >= 10 ? "legendary" : level >= 5 ? "epic" : "rare") as "common" | "rare" | "epic" | "legendary",
    }),

    badge: (badgeName: string, rarity: "common" | "rare" | "epic" | "legendary" = "rare"): Achievement => ({
        id: `badge-${Date.now()}`,
        type: "badge" as const,
        title: `Badge Earned: ${badgeName}`,
        description: "A new badge has been added to your collection!",
        rarity,
    }),

    record: (recordName: string, value: string | number): Achievement => ({
        id: `record-${Date.now()}`,
        type: "record" as const,
        title: `New Record: ${recordName}`,
        description: "You've set a new personal best!",
        value,
        rarity: "legendary" as const,
    }),
};

// ============================================================================
// MINI CELEBRATION BURST (Subtle celebrations)
// ============================================================================

interface MiniCelebrationProps {
    trigger: boolean;
    type?: "sparkle" | "pop" | "glow" | "bounce";
    children: React.ReactNode;
}

export function MiniCelebration({
    trigger,
    type = "sparkle",
    children,
}: MiniCelebrationProps) {
    const [showEffect, setShowEffect] = useState(false);

    useEffect(() => {
        if (trigger) {
            setShowEffect(true);
            const timer = setTimeout(() => setShowEffect(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [trigger]);

    const effectVariants = {
        sparkle: {
            scale: [1, 1.1, 1],
            boxShadow: [
                "0 0 0px rgba(139, 92, 246, 0)",
                "0 0 20px rgba(139, 92, 246, 0.6)",
                "0 0 0px rgba(139, 92, 246, 0)",
            ],
        },
        pop: {
            scale: [1, 1.2, 0.9, 1],
        },
        glow: {
            opacity: [1, 0.8, 1],
            filter: [
                "brightness(1)",
                "brightness(1.5)",
                "brightness(1)",
            ],
        },
        bounce: {
            y: [0, -10, 0],
        },
    };

    return (
        <motion.div
            animate={showEffect ? effectVariants[type] : {}}
            transition={{ duration: 0.5 }}
            className="relative inline-block"
        >
            {children}
            {showEffect && type === "sparkle" && (
                <div className="absolute inset-0 pointer-events-none">
                    {[...Array(4)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute"
                            initial={{ opacity: 1, scale: 0 }}
                            animate={{
                                opacity: 0,
                                scale: 1,
                                x: (i % 2 === 0 ? -1 : 1) * 20,
                                y: (i < 2 ? -1 : 1) * 20,
                            }}
                            transition={{ duration: 0.5 }}
                            style={{
                                left: "50%",
                                top: "50%",
                            }}
                        >
                            <Sparkles className="h-4 w-4 text-amber-400" />
                        </motion.div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

// Export PartyPopper icon for external use
export { PartyPopper, Trophy, Star, Medal, Crown, Award, Sparkles };
