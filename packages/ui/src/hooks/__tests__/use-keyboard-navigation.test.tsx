import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useFilterDropdownNavigation,
  useFocusManagement,
  useKeyboardNavigation,
} from '../../hooks/use-keyboard-navigation';

describe('useKeyboardNavigation', () => {
  it('should provide keyboard event handler', () => {
    const { result } = renderHook(() => useKeyboardNavigation());

    expect(result.current.onKeyDown).toBeInstanceOf(Function);
    expect(result.current.ariaAttributes).toBeDefined();
    expect(result.current.focusUtils).toBeDefined();
  });

  it('should handle escape key', () => {
    const onEscape = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        enableEscapeKey: true,
        onEscape,
      })
    );

    act(() => {
      result.current.onKeyDown({
        key: 'Escape',
        preventDefault: vi.fn(),
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as any);
    });

    expect(onEscape).toHaveBeenCalled();
  });

  it('should handle enter key', () => {
    const onEnter = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        onEnter,
      })
    );

    act(() => {
      result.current.onKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as any);
    });

    expect(onEnter).toHaveBeenCalled();
  });

  it('should handle custom shortcuts', () => {
    const shortcutHandler = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        shortcuts: {
          'Ctrl+k': shortcutHandler,
        },
      })
    );

    act(() => {
      result.current.onKeyDown({
        key: 'k',
        preventDefault: vi.fn(),
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as any);
    });

    expect(shortcutHandler).toHaveBeenCalled();
  });

  it('should provide focus utilities', () => {
    const { result } = renderHook(() => useKeyboardNavigation());

    expect(result.current.focusUtils.focus).toBeInstanceOf(Function);
    expect(result.current.focusUtils.blur).toBeInstanceOf(Function);
    expect(result.current.focusUtils.setFocusRef).toBeInstanceOf(Function);
  });

  it('should provide ARIA attributes', () => {
    const { result } = renderHook(() => useKeyboardNavigation());

    expect(result.current.ariaAttributes).toEqual({
      'aria-label': 'Filter input',
      'aria-describedby': 'filter-help-text',
      role: 'combobox',
    });
  });

  it('should handle tab navigation', () => {
    const onTab = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        enableTabNavigation: true,
        onTab,
      })
    );

    act(() => {
      result.current.onKeyDown({
        key: 'Tab',
        preventDefault: vi.fn(),
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as any);
    });

    expect(onTab).toHaveBeenCalled();
  });

  it('should handle arrow keys', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        enableArrowKeys: true,
      })
    );

    // Should not throw error
    expect(() => {
      act(() => {
        result.current.onKeyDown({
          key: 'ArrowDown',
          preventDefault: vi.fn(),
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          shiftKey: false,
        } as any);
      });
    }).not.toThrow();
  });

  it('should disable shortcuts when enableShortcuts is false', () => {
    const shortcutHandler = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        enableShortcuts: false,
        shortcuts: {
          'Ctrl+k': shortcutHandler,
        },
      })
    );

    act(() => {
      result.current.onKeyDown({
        key: 'k',
        preventDefault: vi.fn(),
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as any);
    });

    expect(shortcutHandler).not.toHaveBeenCalled();
  });
});

describe('useFilterDropdownNavigation', () => {
  it('should handle dropdown navigation', () => {
    const onToggle = vi.fn();
    const onClose = vi.fn();
    const onSelectItem = vi.fn();

    const { result } = renderHook(() =>
      useFilterDropdownNavigation(false, onToggle, onClose, onSelectItem)
    );

    expect(result.current.handleKeyDown).toBeInstanceOf(Function);
    expect(result.current.focusedIndex).toBe(-1);
    expect(result.current.setFocusedIndex).toBeInstanceOf(Function);
  });

  it('should handle escape key to close dropdown', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useFilterDropdownNavigation(true, vi.fn(), onClose));

    act(() => {
      result.current.handleKeyDown({
        key: 'Escape',
        preventDefault: vi.fn(),
      } as any);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('should handle enter key to select item', () => {
    const onSelectItem = vi.fn();
    const { result } = renderHook(() =>
      useFilterDropdownNavigation(true, vi.fn(), vi.fn(), onSelectItem)
    );

    // Set focused index
    act(() => {
      result.current.setFocusedIndex(0);
    });

    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as any);
    });

    expect(onSelectItem).toHaveBeenCalledWith(0);
  });

  it('should handle arrow down navigation', () => {
    const { result } = renderHook(() => useFilterDropdownNavigation(true, vi.fn(), vi.fn()));

    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn(),
      } as any);
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it('should handle arrow up navigation', () => {
    const { result } = renderHook(() => useFilterDropdownNavigation(true, vi.fn(), vi.fn()));

    // Set initial focused index
    act(() => {
      result.current.setFocusedIndex(2);
    });

    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowUp',
        preventDefault: vi.fn(),
      } as any);
    });

    expect(result.current.focusedIndex).toBe(1);
  });

  it('should handle home key to go to first item', () => {
    const { result } = renderHook(() => useFilterDropdownNavigation(true, vi.fn(), vi.fn()));

    // Set focused index to middle
    act(() => {
      result.current.setFocusedIndex(5);
    });

    act(() => {
      result.current.handleKeyDown({
        key: 'Home',
        preventDefault: vi.fn(),
      } as any);
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it('should handle end key to go to last item', () => {
    const { result } = renderHook(() => useFilterDropdownNavigation(true, vi.fn(), vi.fn()));

    act(() => {
      result.current.handleKeyDown({
        key: 'End',
        preventDefault: vi.fn(),
      } as any);
    });

    expect(result.current.focusedIndex).toBe(-1);
  });

  it('should reset focused index when dropdown closes', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useFilterDropdownNavigation(isOpen, vi.fn(), vi.fn()),
      {
        initialProps: { isOpen: true },
      }
    );

    // Set focused index
    act(() => {
      result.current.setFocusedIndex(2);
    });

    expect(result.current.focusedIndex).toBe(2);

    // Close dropdown
    rerender({ isOpen: false });

    expect(result.current.focusedIndex).toBe(-1);
  });
});

describe('useFocusManagement', () => {
  it('should provide focus management utilities', () => {
    const containerRef = { current: null } as unknown as React.RefObject<HTMLElement>;
    const { result } = renderHook(() => useFocusManagement(containerRef));

    expect(result.current.focusedElement).toBeNull();
    expect(result.current.focusFirst).toBeInstanceOf(Function);
    expect(result.current.focusLast).toBeInstanceOf(Function);
    expect(result.current.focusNext).toBeInstanceOf(Function);
    expect(result.current.focusPrevious).toBeInstanceOf(Function);
  });

  it('should track focused element', () => {
    const containerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useFocusManagement(containerRef));

    expect(result.current.focusedElement).toBeNull();
  });

  it('should handle focus utilities', () => {
    const containerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useFocusManagement(containerRef));

    // These should not throw errors
    expect(() => {
      result.current.focusFirst();
      result.current.focusLast();
      result.current.focusNext();
      result.current.focusPrevious();
    }).not.toThrow();
  });
});
