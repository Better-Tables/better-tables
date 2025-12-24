import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type * as readline from 'node:readline';
import { confirm, input, resolveFileConflict, select } from '../src/lib/prompts';

// Mock readline module
const mockQuestion = mock((_query: string, callback: (answer: string) => void) => {
  // Store callback for later invocation
  (mockQuestion as unknown as { callback?: (answer: string) => void }).callback = callback;
});

const mockClose = mock(() => {});

const mockInterface = {
  question: mockQuestion,
  close: mockClose,
} as unknown as readline.Interface;

mock.module('readline', () => ({
  createInterface: () => mockInterface,
}));

describe('prompts', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    mockQuestion.mockClear();
    mockClose.mockClear();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('confirm', () => {
    it('should return true for "y" input', async () => {
      const promise = confirm('Test question', true);
      // Simulate user input
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('y');
      const result = await promise;
      expect(result).toBe(true);
      expect(mockClose).toHaveBeenCalled();
    });

    it('should return true for "yes" input', async () => {
      const promise = confirm('Test question', true);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('yes');
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should return false for "n" input', async () => {
      const promise = confirm('Test question', true);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('n');
      const result = await promise;
      expect(result).toBe(false);
    });

    it('should return false for "no" input', async () => {
      const promise = confirm('Test question', true);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('no');
      const result = await promise;
      expect(result).toBe(false);
    });

    it('should return default value for empty input', async () => {
      const promise = confirm('Test question', true);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('');
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should return default value (false) for empty input when default is false', async () => {
      const promise = confirm('Test question', false);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('');
      const result = await promise;
      expect(result).toBe(false);
    });

    it('should handle case-insensitive input', async () => {
      const promise = confirm('Test question', true);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('Y');
      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('input', () => {
    it('should return user input', async () => {
      const promise = input('Enter value');
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('test value');
      const result = await promise;
      expect(result).toBe('test value');
      expect(mockClose).toHaveBeenCalled();
    });

    it('should return default value when input is empty', async () => {
      const promise = input('Enter value', 'default');
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('');
      const result = await promise;
      expect(result).toBe('default');
    });

    it('should return empty string when no default and input is empty', async () => {
      const promise = input('Enter value');
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('');
      const result = await promise;
      expect(result).toBe('');
    });

    it('should trim whitespace from input', async () => {
      const promise = input('Enter value');
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('  test value  ');
      const result = await promise;
      expect(result).toBe('test value');
    });
  });

  describe('select', () => {
    it('should throw error when options array is empty', async () => {
      await expect(select('Choose option', [])).rejects.toThrow(
        'select() requires at least one option'
      );
    });

    it('should return selected option value', async () => {
      const options = [
        { label: 'Option 1', value: 'opt1' as const },
        { label: 'Option 2', value: 'opt2' as const },
      ];
      const promise = select('Choose option', options);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('1');
      const result = await promise;
      expect(result).toBe('opt1');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nChoose option');
      expect(consoleLogSpy).toHaveBeenCalledWith('  1. Option 1');
      expect(consoleLogSpy).toHaveBeenCalledWith('  2. Option 2');
    });

    it('should return second option when index is 2', async () => {
      const options = [
        { label: 'Option 1', value: 'opt1' as const },
        { label: 'Option 2', value: 'opt2' as const },
      ];
      const promise = select('Choose option', options);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('2');
      const result = await promise;
      expect(result).toBe('opt2');
    });

    it('should default to first option for invalid input', async () => {
      const options = [
        { label: 'Option 1', value: 'opt1' as const },
        { label: 'Option 2', value: 'opt2' as const },
      ];
      const promise = select('Choose option', options);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('99'); // Invalid index
      const result = await promise;
      expect(result).toBe('opt1');
    });

    it('should default to first option for non-numeric input', async () => {
      const options = [
        { label: 'Option 1', value: 'opt1' as const },
        { label: 'Option 2', value: 'opt2' as const },
      ];
      const promise = select('Choose option', options);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('invalid');
      const result = await promise;
      expect(result).toBe('opt1');
    });

    it('should handle single option', async () => {
      const options = [{ label: 'Only option', value: 'only' as const }];
      const promise = select('Choose option', options);
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('1');
      const result = await promise;
      expect(result).toBe('only');
    });
  });

  describe('resolveFileConflict', () => {
    it('should return ConflictResolution type', async () => {
      const promise = resolveFileConflict('/path/to/file.ts');
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('1'); // Select "overwrite"
      const result = await promise;
      expect(result).toBe('overwrite');
      expect(['overwrite', 'skip', 'overwrite-all', 'skip-all']).toContain(result);
    });

    it('should show file path in message', async () => {
      const promise = resolveFileConflict('/path/to/file.ts');
      const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
        .callback;
      if (callback) callback('1');
      await promise;
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('/path/to/file.ts'));
    });

    it('should return all conflict resolution options', async () => {
      const options = ['overwrite', 'skip', 'overwrite-all', 'skip-all'] as const;
      for (let i = 0; i < options.length; i++) {
        const promise = resolveFileConflict('/path/to/file.ts');
        const callback = (mockQuestion as unknown as { callback?: (answer: string) => void })
          .callback;
        if (callback) callback(String(i + 1));
        const result = await promise;
        expect(result).toBe(options[i]);
      }
    });
  });
});
