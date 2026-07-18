import { describe, expect, it, mock } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useKeyboardNavigation } from '../../src/hooks/use-keyboard-navigation';

describe('useKeyboardNavigation (plan 042 step 3)', () => {
  it('calls onEscape and prevents default for Escape', () => {
    const onEscape = mock(() => {});
    const { result } = renderHook(() => useKeyboardNavigation({ onEscape }));

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    const preventDefault = mock(() => {});
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    result.current.onKeyDown(event as unknown as ReactKeyboardEvent);
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('calls onEnter and prevents default for Enter', () => {
    const onEnter = mock(() => {});
    const { result } = renderHook(() => useKeyboardNavigation({ onEnter }));

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    const preventDefault = mock(() => {});
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    result.current.onKeyDown(event as unknown as ReactKeyboardEvent);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('invokes configured shortcut handlers (Ctrl+k)', () => {
    const shortcut = mock(() => {});
    const { result } = renderHook(() =>
      useKeyboardNavigation({ shortcuts: { 'Ctrl+k': shortcut } })
    );

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
    const preventDefault = mock(() => {});
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    result.current.onKeyDown(event as unknown as ReactKeyboardEvent);
    expect(shortcut).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('does not treat arrow keys as escape/enter handlers', () => {
    const onEscape = mock(() => {});
    const onEnter = mock(() => {});
    const { result } = renderHook(() =>
      useKeyboardNavigation({ onEscape, onEnter, enableArrowKeys: true })
    );

    result.current.onKeyDown({
      key: 'ArrowDown',
      preventDefault: () => {},
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      nativeEvent: new KeyboardEvent('keydown', { key: 'ArrowDown' }),
    } as ReactKeyboardEvent);

    expect(onEscape).not.toHaveBeenCalled();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('exposes stable combobox aria attributes', () => {
    const { result } = renderHook(() => useKeyboardNavigation());
    expect(result.current.ariaAttributes.role).toBe('combobox');
    expect(result.current.ariaAttributes['aria-label']).toBe('Filter input');
  });
});
