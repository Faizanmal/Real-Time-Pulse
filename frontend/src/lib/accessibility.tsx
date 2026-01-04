'use client';

/**
 * ============================================================================
 * ACCESSIBILITY (A11Y) UTILITIES & HOOKS
 * ============================================================================
 * Comprehensive accessibility utilities for WCAG 2.1 AA compliance.
 * Includes keyboard navigation, focus management, screen reader support,
 * and reduced motion preferences.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ==================== FOCUS MANAGEMENT ====================

/**
 * Focus trap hook for modal dialogs and overlays
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    const focusableElements = getFocusableElements(container);

    if (focusableElements.length > 0) {
      // Focus first focusable element
      (focusableElements[0] as HTMLElement).focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previous element
      previousActiveElement.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll(
    'button:not([disabled]), ' +
    'a[href], ' +
    'input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), ' +
    'textarea:not([disabled]), ' +
    '[tabindex]:not([tabindex="-1"]):not([disabled]), ' +
    '[contenteditable="true"]'
  );
}

/**
 * Focus first focusable element in container
 */
export function focusFirstElement(container: HTMLElement): void {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    (focusable[0] as HTMLElement).focus();
  }
}

/**
 * Roving tabindex hook for keyboard navigation in lists
 */
export function useRovingTabIndex<T extends HTMLElement>(
  items: React.RefObject<T>[],
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
    onSelect?: (index: number) => void;
  } = {}
) {
  const { orientation = 'vertical', loop = true, onSelect } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const current = document.activeElement;
      const currentIndex = items.findIndex((ref) => ref.current === current);

      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      switch (e.key) {
        case 'ArrowDown':
          if (isVertical) {
            e.preventDefault();
            nextIndex = currentIndex + 1;
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            e.preventDefault();
            nextIndex = currentIndex - 1;
          }
          break;
        case 'ArrowRight':
          if (isHorizontal) {
            e.preventDefault();
            nextIndex = currentIndex + 1;
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            e.preventDefault();
            nextIndex = currentIndex - 1;
          }
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = items.length - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect?.(currentIndex);
          return;
        default:
          return;
      }

      // Handle looping
      if (loop) {
        if (nextIndex < 0) nextIndex = items.length - 1;
        if (nextIndex >= items.length) nextIndex = 0;
      } else {
        nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex));
      }

      if (nextIndex !== currentIndex) {
        items[nextIndex].current?.focus();
        setFocusedIndex(nextIndex);
      }
    },
    [items, orientation, loop, onSelect]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    focusedIndex,
    setFocusedIndex,
    getTabIndex: (index: number) => (index === focusedIndex ? 0 : -1),
  };
}

// ==================== REDUCED MOTION ====================

/**
 * Hook to detect user's motion preference
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return reducedMotion;
}

/**
 * Get animation config based on motion preference
 */
export function getMotionProps(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.01 },
    };
  }
  return {};
}

// ==================== SCREEN READER UTILITIES ====================

/**
 * Live region hook for announcing dynamic content
 */
export function useLiveAnnounce() {
  const [announcement, setAnnouncement] = useState('');

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Clear first to ensure re-announcement of same message
    setAnnouncement('');
    requestAnimationFrame(() => {
      setAnnouncement(message);
    });

    // Clear after announcement
    setTimeout(() => setAnnouncement(''), 1000);
  }, []);

  const LiveRegion = useCallback(
    () => (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    ),
    [announcement]
  );

  return { announce, LiveRegion };
}

/**
 * Skip link component for keyboard navigation
 */
export function SkipLink({ href = '#main-content', children = 'Skip to main content' }: {
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
    >
      {children}
    </a>
  );
}

/**
 * Visually hidden component for screen readers
 */
export function VisuallyHidden({ children, as: Component = 'span' }: {
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  return <Component className="sr-only">{children}</Component>;
}

// ==================== KEYBOARD SHORTCUTS ====================

type ShortcutHandler = (e: KeyboardEvent) => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description?: string;
  handler: ShortcutHandler;
  scope?: string;
}

/**
 * Global keyboard shortcuts hook
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], deps: React.DependencyList = []) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      for (const shortcut of shortcuts) {
        // Skip input-blocking shortcuts when in input
        if (isInput && !shortcut.meta && !shortcut.ctrl) continue;

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
        const altMatch = !!shortcut.alt === e.altKey;
        const shiftMatch = !!shortcut.shift === e.shiftKey;
        const metaMatch = !!shortcut.meta === e.metaKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch && (shortcut.meta ? metaMatch : true)) {
          e.preventDefault();
          shortcut.handler(e);
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: Omit<ShortcutConfig, 'handler'>): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win');

  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
}

// ==================== HIGH CONTRAST MODE ====================

/**
 * Hook to detect high contrast mode
 */
export function useHighContrastMode(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for forced-colors media query (Windows High Contrast Mode)
    const mediaQuery = window.matchMedia('(forced-colors: active)');
    setIsHighContrast(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsHighContrast(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isHighContrast;
}

// ==================== ARIA HELPERS ====================

/**
 * Generate unique IDs for ARIA relationships
 */
export function useAriaIds(prefix: string): {
  labelId: string;
  descriptionId: string;
  errorId: string;
} {
  const [id] = useState(() => `${prefix}-${Math.random().toString(36).substr(2, 9)}`);

  return {
    labelId: `${id}-label`,
    descriptionId: `${id}-description`,
    errorId: `${id}-error`,
  };
}

/**
 * Build aria-describedby attribute
 */
export function buildDescribedBy(...ids: (string | undefined | false)[]): string | undefined {
  const validIds = ids.filter(Boolean);
  return validIds.length > 0 ? validIds.join(' ') : undefined;
}

// ==================== FOCUS VISIBLE ====================

/**
 * Track focus visibility (keyboard vs mouse)
 */
export function useFocusVisible(): boolean {
  const [isFocusVisible, setIsFocusVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsFocusVisible(true);
      }
    };

    const handleMouseDown = () => {
      setIsFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return isFocusVisible;
}

// ==================== COLOR CONTRAST ====================

/**
 * Calculate relative luminance of a color
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const parseHex = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
      : { r: 0, g: 0, b: 0 };
  };

  const c1 = parseHex(color1);
  const c2 = parseHex(color2);

  const l1 = getLuminance(c1.r, c1.g, c1.b);
  const l2 = getLuminance(c2.r, c2.g, c2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG standards
 */
export function meetsContrastRequirements(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  textSize: 'normal' | 'large' = 'normal'
): boolean {
  const ratio = getContrastRatio(foreground, background);

  if (level === 'AAA') {
    return textSize === 'large' ? ratio >= 4.5 : ratio >= 7;
  }
  return textSize === 'large' ? ratio >= 3 : ratio >= 4.5;
}

export default {
  useFocusTrap,
  useRovingTabIndex,
  useReducedMotion,
  useLiveAnnounce,
  useKeyboardShortcuts,
  useHighContrastMode,
  useFocusVisible,
  SkipLink,
  VisuallyHidden,
  getContrastRatio,
  meetsContrastRequirements,
};
