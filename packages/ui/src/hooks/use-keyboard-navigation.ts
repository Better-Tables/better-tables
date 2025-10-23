'use client';

import * as React from 'react';

export interface KeyboardNavigationConfig {
  /** Whether to enable keyboard shortcuts */
  enableShortcuts?: boolean;
  /** Whether to enable escape key handling */
  enableEscapeKey?: boolean;
  /** Whether to enable arrow key navigation */
  enableArrowKeys?: boolean;
  /** Whether to enable tab navigation */
  enableTabNavigation?: boolean;
  /** Custom keyboard shortcuts */
  shortcuts?: Record<string, () => void>;
  /** Handler for escape key */
  onEscape?: () => void;
  /** Handler for enter key */
  onEnter?: () => void;
  /** Handler for tab key */
  onTab?: (event: KeyboardEvent) => void;
}

export interface KeyboardNavigationResult {
  /** Keyboard event handler */
  onKeyDown: (event: React.KeyboardEvent) => void;
  /** ARIA attributes for accessibility */
  ariaAttributes: {
    'aria-label'?: string;
    'aria-describedby'?: string;
    'aria-expanded'?: boolean;
    'aria-haspopup'?: boolean;
    role?: string;
  };
  /** Focus management utilities */
  focusUtils: {
    focus: () => void;
    blur: () => void;
    setFocusRef: (ref: HTMLElement | null) => void;
  };
}

export function useKeyboardNavigation(
  config: KeyboardNavigationConfig = {}
): KeyboardNavigationResult {
  const {
    enableShortcuts = true,
    enableEscapeKey = true,
    enableArrowKeys = true,
    enableTabNavigation = true,
    shortcuts = {},
    onEscape,
    onEnter,
    onTab,
  } = config;

  const focusRef = React.useRef<HTMLElement | null>(null);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const key = event.key;
      const isCtrl = event.ctrlKey || event.metaKey;
      const isAlt = event.altKey;
      const isShift = event.shiftKey;

      // Handle escape key
      if (enableEscapeKey && key === 'Escape') {
        event.preventDefault();
        onEscape?.();
        return;
      }

      // Handle enter key
      if (key === 'Enter' && !isCtrl && !isAlt && !isShift) {
        event.preventDefault();
        onEnter?.();
        return;
      }

      // Handle tab key
      if (enableTabNavigation && key === 'Tab') {
        onTab?.(event.nativeEvent);
        return;
      }

      // Handle custom shortcuts
      if (enableShortcuts) {
        const shortcutKey = [isCtrl && 'Ctrl', isAlt && 'Alt', isShift && 'Shift', key]
          .filter(Boolean)
          .join('+');

        const shortcutHandler = shortcuts[shortcutKey];
        if (shortcutHandler) {
          event.preventDefault();
          shortcutHandler();
          return;
        }
      }

      // Handle arrow keys for navigation
      if (enableArrowKeys && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        // Let the component handle arrow key navigation
        // This is mainly for Command components and other navigatable lists
        return;
      }
    },
    [
      enableShortcuts,
      enableEscapeKey,
      enableArrowKeys,
      enableTabNavigation,
      shortcuts,
      onEscape,
      onEnter,
      onTab,
    ]
  );

  const focusUtils = React.useMemo(
    () => ({
      focus: () => {
        focusRef.current?.focus();
      },
      blur: () => {
        focusRef.current?.blur();
      },
      setFocusRef: (ref: HTMLElement | null) => {
        focusRef.current = ref;
      },
    }),
    []
  );

  const ariaAttributes = React.useMemo(
    () => ({
      'aria-label': 'Filter input',
      'aria-describedby': 'filter-help-text',
      role: 'combobox',
    }),
    []
  );

  return {
    onKeyDown: handleKeyDown,
    ariaAttributes,
    focusUtils,
  };
}

// Common keyboard shortcuts for filter components
export const FILTER_SHORTCUTS = {
  clear: 'Escape',
  apply: 'Enter',
  focusSearch: 'Ctrl+k',
  closeDropdown: 'Escape',
  nextItem: 'ArrowDown',
  prevItem: 'ArrowUp',
  selectItem: 'Enter',
  toggleDropdown: 'Space',
} as const;

// Hook for filter dropdown navigation
export function useFilterDropdownNavigation(
  isOpen: boolean,
  onToggle: () => void,
  onClose: () => void,
  onSelectItem?: (index: number) => void
) {
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const key = event.key;

      switch (key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'Enter':
        case ' ':
          if (!isOpen) {
            event.preventDefault();
            onToggle();
          } else if (focusedIndex >= 0) {
            event.preventDefault();
            onSelectItem?.(focusedIndex);
          }
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            onToggle();
          } else {
            setFocusedIndex((prev) => prev + 1);
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (!isOpen) {
            onToggle();
          } else {
            setFocusedIndex((prev) => Math.max(0, prev - 1));
          }
          break;
        case 'Home':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(0);
          }
          break;
        case 'End':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(-1); // Will be handled by the component
          }
          break;
      }
    },
    [isOpen, onToggle, onClose, onSelectItem, focusedIndex]
  );

  React.useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  return {
    handleKeyDown,
    focusedIndex,
    setFocusedIndex,
  };
}

// Helper hook for managing focus within filter components
export function useFocusManagement(containerRef: React.RefObject<HTMLElement>) {
  const [focusedElement, setFocusedElement] = React.useState<HTMLElement | null>(null);

  const focusFirst = React.useCallback(() => {
    if (!containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    if (firstElement) {
      firstElement.focus();
      setFocusedElement(firstElement);
    }
  }, [containerRef]);

  const focusLast = React.useCallback(() => {
    if (!containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const lastElement = focusableElements[focusableElements.length - 1];
    if (lastElement) {
      lastElement.focus();
      setFocusedElement(lastElement);
    }
  }, [containerRef]);

  const focusNext = React.useCallback(() => {
    if (!containerRef.current || !focusedElement) return;

    const focusableElements = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );

    const currentIndex = focusableElements.indexOf(focusedElement);
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    const nextElement = focusableElements[nextIndex];

    if (nextElement) {
      nextElement.focus();
      setFocusedElement(nextElement);
    }
  }, [containerRef, focusedElement]);

  const focusPrevious = React.useCallback(() => {
    if (!containerRef.current || !focusedElement) return;

    const focusableElements = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );

    const currentIndex = focusableElements.indexOf(focusedElement);
    const prevIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
    const prevElement = focusableElements[prevIndex];

    if (prevElement) {
      prevElement.focus();
      setFocusedElement(prevElement);
    }
  }, [containerRef, focusedElement]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) {
        setFocusedElement(event.target);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      // Only clear focused element if focus is leaving the container
      if (!container.contains(event.relatedTarget as Node)) {
        setFocusedElement(null);
      }
    };

    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);

    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [containerRef]);

  return {
    focusedElement,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
  };
}
