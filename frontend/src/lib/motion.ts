/**
 * Framer Motion Performance Optimizations
 * 
 * This file contains reusable animation variants and configurations
 * optimized for performance to prevent layout shifts and repaints.
 */

// Common easing functions
export const easing = {
  ease: [0.6, 0.01, 0.05, 0.95],
  easeOut: [0.19, 1, 0.22, 1],
  easeInOut: [0.77, 0, 0.175, 1],
};

// Fade in animation (opacity only - GPU accelerated)
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: easing.easeOut },
};

// Fade in with slide up (transform + opacity - GPU accelerated)
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
  transition: { duration: 0.3, ease: easing.easeOut },
};

// Fade in with scale (transform + opacity - GPU accelerated)
export const fadeInScale = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: easing.easeOut },
};

// Stagger children animation
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// Card hover animation (scale + translate Y)
export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { 
    scale: 1.03, 
    y: -8,
    transition: { duration: 0.2, ease: easing.easeOut }
  },
};

// Button hover animation (scale only)
export const buttonHover = {
  rest: { scale: 1 },
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
  transition: { duration: 0.1 },
};

// Smooth scale animation for icons
export const iconHover = {
  rest: { scale: 1 },
  hover: { scale: 1.1 },
  tap: { scale: 0.9 },
  transition: { duration: 0.1 },
};

// Rotation animation for refresh icons
export const rotateHover = {
  rest: { scale: 1, rotate: 0 },
  hover: { scale: 1.1, rotate: 180 },
  tap: { scale: 0.9 },
  transition: { duration: 0.2 },
};

// List item animation for staggered lists
export const listItem = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2, ease: easing.easeOut },
};

// Modal/Dialog animation
export const modalVariants = {
  initial: { opacity: 0, scale: 0.9, y: 20 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: 0.2, ease: easing.easeOut }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9, 
    y: 20,
    transition: { duration: 0.15, ease: easing.easeOut }
  },
};

// Slide in from side
export const slideInLeft = {
  initial: { opacity: 0, x: -50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
  transition: { duration: 0.3, ease: easing.easeOut },
};

export const slideInRight = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 50 },
  transition: { duration: 0.3, ease: easing.easeOut },
};

// Performance-optimized motion config for reduced motion preference
export const motionConfig = {
  // Use GPU-accelerated properties only
  useGPU: true,
  // Respect user's reduced motion preference
  respectReducedMotion: true,
};

// Transition presets
export const transitions = {
  fast: { duration: 0.15, ease: easing.easeOut },
  normal: { duration: 0.2, ease: easing.easeOut },
  slow: { duration: 0.3, ease: easing.easeOut },
  spring: { type: "spring", stiffness: 300, damping: 30 },
  springBouncy: { type: "spring", stiffness: 400, damping: 25 },
};

// Common style for better performance (GPU acceleration)
export const gpuAcceleration = {
  willChange: 'transform',
  transform: 'translateZ(0)',
};
