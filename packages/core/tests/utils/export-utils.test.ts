/**
 * @fileoverview Tests for export utility functions.
 */

import { describe, expect, it } from 'bun:test';
import type { ColumnDefinition } from '../../src/types/column';
import {
  CsvStreamGenerator,
  estimateExportSize,
  formatDuration,
  formatFileSize,
  generateExportFilename,
  isDownloadSupported,
  processBatches,
  sanitizeFilename,
  validateExportConfig,
} from '../../src/utils/export-utils';

interface TestUser {
  id: string;
  name: string;
  email: string;
}

const createTestColumns = (): ColumnDefinition<TestUser>[] => [
  {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: (user) => user.name,
    filterable: true,
  },
  {
    id: 'email',
    displayName: 'Email',
    type: 'text',
    accessor: (user) => user.email,
    filterable: true,
  },
];

describe('CsvStreamGenerator', () => {
  it('should generate header line', () => {
    const columns = createTestColumns();
    const generator = new CsvStreamGenerator(columns);
    const data: TestUser[] = [{ id: '1', name: 'John', email: 'john@example.com' }];

    const lines = [...generator.generateLines(data)];
    expect(lines[0]).toBe('Name,Email');
  });

  it('should generate data lines', () => {
    const columns = createTestColumns();
    const generator = new CsvStreamGenerator(columns);
    const data: TestUser[] = [{ id: '1', name: 'John', email: 'john@example.com' }];

    const lines = [...generator.generateLines(data)];
    expect(lines[1]).toBe('John,john@example.com');
  });

  it('should escape values with delimiters', () => {
    const columns = createTestColumns();
    const generator = new CsvStreamGenerator(columns);
    const data: TestUser[] = [{ id: '1', name: 'John, Jr.', email: 'john@example.com' }];

    const lines = [...generator.generateLines(data)];
    expect(lines[1]).toBe('"John, Jr.",john@example.com');
  });

  it('should escape values with quotes', () => {
    const columns = createTestColumns();
    const generator = new CsvStreamGenerator(columns);
    const data: TestUser[] = [{ id: '1', name: 'John "The Best"', email: 'john@example.com' }];

    const lines = [...generator.generateLines(data)];
    expect(lines[1]).toContain('""The Best""');
  });

  it('should generate batch without header', () => {
    const columns = createTestColumns();
    const generator = new CsvStreamGenerator(columns, { includeHeaders: false });
    const data: TestUser[] = [{ id: '1', name: 'John', email: 'john@example.com' }];

    const csv = generator.generateBatch(data, false);
    expect(csv).toBe('John,john@example.com');
  });

  it('should use custom delimiter', () => {
    const columns = createTestColumns();
    const generator = new CsvStreamGenerator(columns, { delimiter: ';' });
    const data: TestUser[] = [{ id: '1', name: 'John', email: 'john@example.com' }];

    const lines = [...generator.generateLines(data)];
    expect(lines[0]).toBe('Name;Email');
    expect(lines[1]).toBe('John;john@example.com');
  });

  it('should reset state', () => {
    const columns = createTestColumns();
    const generator = new CsvStreamGenerator(columns);
    const data: TestUser[] = [{ id: '1', name: 'John', email: 'john@example.com' }];

    // First generation includes header
    const lines1 = [...generator.generateLines(data)];
    expect(lines1).toHaveLength(2);

    // Second generation without reset doesn't include header
    const lines2 = [...generator.generateLines(data)];
    expect(lines2).toHaveLength(1);

    // After reset, header is included again
    generator.reset();
    const lines3 = [...generator.generateLines(data)];
    expect(lines3).toHaveLength(2);
  });

  it('should return BOM string when enabled', () => {
    const columns = createTestColumns();
    const generator = new CsvStreamGenerator(columns, { includeBom: true });
    expect(generator.getBom()).toBe('\uFEFF');
  });

  it('should return empty string when BOM disabled', () => {
    const columns = createTestColumns();
    const generator = new CsvStreamGenerator(columns, { includeBom: false });
    expect(generator.getBom()).toBe('');
  });
});

describe('processBatches', () => {
  it('should process data in batches', async () => {
    const data = Array.from({ length: 100 }, (_, i) => i);
    const batches: number[][] = [];

    await processBatches(data, 25, async (batch) => {
      batches.push(batch);
    });

    expect(batches).toHaveLength(4);
    expect(batches[0]).toHaveLength(25);
  });

  it('should provide batch index and total', async () => {
    const data = Array.from({ length: 50 }, (_, i) => i);
    const indices: number[] = [];

    await processBatches(data, 10, async (_, index, total) => {
      indices.push(index);
      expect(total).toBe(5);
    });

    expect(indices).toEqual([0, 1, 2, 3, 4]);
  });

  it('should handle uneven batches', async () => {
    const data = Array.from({ length: 33 }, (_, i) => i);
    const sizes: number[] = [];

    await processBatches(data, 10, async (batch) => {
      sizes.push(batch.length);
    });

    expect(sizes).toEqual([10, 10, 10, 3]);
  });

  it('should respect abort signal', async () => {
    const data = Array.from({ length: 100 }, (_, i) => i);
    const controller = new AbortController();
    let processed = 0;

    await processBatches(
      data,
      10,
      async () => {
        processed++;
        if (processed === 3) controller.abort();
      },
      { signal: controller.signal }
    );

    expect(processed).toBeLessThan(10);
  });
});

describe('estimateExportSize', () => {
  it('should estimate file size', () => {
    const columns = createTestColumns();
    const sampleRow: TestUser = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
    };

    const estimate = estimateExportSize(columns, sampleRow, 1000, 'csv');
    expect(estimate).toBeGreaterThan(0);
  });

  it('should apply format-specific multipliers', () => {
    const columns = createTestColumns();
    const sampleRow: TestUser = {
      id: '1',
      name: 'John',
      email: 'j@e.com',
    };

    const csvSize = estimateExportSize(columns, sampleRow, 1000, 'csv');
    const excelSize = estimateExportSize(columns, sampleRow, 1000, 'excel');
    const jsonSize = estimateExportSize(columns, sampleRow, 1000, 'json');

    expect(excelSize).toBeGreaterThan(csvSize);
    expect(jsonSize).toBeGreaterThan(csvSize);
  });
});

describe('formatFileSize', () => {
  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('should format gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('should format seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });
});

describe('generateExportFilename', () => {
  it('should generate filename with timestamp', () => {
    const filename = generateExportFilename('users', 'csv');
    expect(filename).toMatch(/^users-\d{8}T\d{6}\.csv$/);
  });

  it('should use correct extension for each format', () => {
    expect(generateExportFilename('data', 'csv')).toContain('.csv');
    expect(generateExportFilename('data', 'excel')).toContain('.xlsx');
    expect(generateExportFilename('data', 'json')).toContain('.json');
  });
});

describe('validateExportConfig', () => {
  it('should validate valid config', () => {
    const result = validateExportConfig({
      format: 'csv',
      batchSize: 1000,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid format', () => {
    const result = validateExportConfig({
      format: 'invalid',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid export format: invalid');
  });

  it('should reject invalid batch size', () => {
    const result = validateExportConfig({
      batchSize: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Batch size must be between 1 and 100,000');
  });

  it('should reject too large batch size', () => {
    const result = validateExportConfig({
      batchSize: 200000,
    });
    expect(result.valid).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('should remove invalid characters', () => {
    expect(sanitizeFilename('file:name.csv')).toBe('file_name.csv');
    expect(sanitizeFilename('file/name.csv')).toBe('file_name.csv');
    expect(sanitizeFilename('file<name>.csv')).toBe('file_name_.csv');
  });

  it('should replace spaces with underscores', () => {
    expect(sanitizeFilename('my file name.csv')).toBe('my_file_name.csv');
  });

  it('should collapse multiple underscores', () => {
    expect(sanitizeFilename('file___name.csv')).toBe('file_name.csv');
  });

  it('should truncate long filenames', () => {
    const longName = 'a'.repeat(300);
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(200);
  });
});

describe('isDownloadSupported', () => {
  it('should return boolean', () => {
    const result = isDownloadSupported();
    expect(typeof result).toBe('boolean');
  });
});
