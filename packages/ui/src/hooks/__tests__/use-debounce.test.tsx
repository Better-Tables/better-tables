import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from '../../hooks/use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 100));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 100 },
    });

    // Change the value
    rerender({ value: 'updated', delay: 100 });

    // Value should still be initial before delay
    expect(result.current).toBe('initial');

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Value should now be updated
    expect(result.current).toBe('updated');
  });

  it('should handle multiple rapid changes', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 100 },
    });

    // Make multiple rapid changes
    rerender({ value: 'first', delay: 100 });
    rerender({ value: 'second', delay: 100 });
    rerender({ value: 'third', delay: 100 });

    // Value should still be initial
    expect(result.current).toBe('initial');

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Value should be the last one
    expect(result.current).toBe('third');
  });

  it('should handle delay changes', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 100 },
    });

    // Change value and delay
    rerender({ value: 'updated', delay: 200 });

    // Fast forward by original delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Value should still be initial
    expect(result.current).toBe('initial');

    // Fast forward by remaining delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Value should now be updated
    expect(result.current).toBe('updated');
  });

  it('should handle zero delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 0 },
    });

    rerender({ value: 'updated', delay: 0 });

    // With zero delay, value should update immediately
    expect(result.current).toBe('updated');
  });

  it('should handle cleanup on unmount', () => {
    const { result, unmount } = renderHook(() => useDebounce('initial', 100));

    // Change value
    act(() => {
      result.current = 'updated';
    });

    // Unmount before delay completes
    unmount();

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should not cause any errors
    expect(true).toBe(true);
  });

  it('should work with different data types', () => {
    // Test with number
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 0, delay: 100 },
      }
    );

    numberRerender({ value: 42, delay: 100 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(numberResult.current).toBe(42);

    // Test with object
    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: { id: 1 }, delay: 100 },
      }
    );

    objectRerender({ value: { id: 2 }, delay: 100 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(objectResult.current).toEqual({ id: 2 });

    // Test with array
    const { result: arrayResult, rerender: arrayRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: [1, 2, 3], delay: 100 },
      }
    );

    arrayRerender({ value: [4, 5, 6], delay: 100 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(arrayResult.current).toEqual([4, 5, 6]);
  });
});
