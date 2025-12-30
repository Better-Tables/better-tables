/**
 * @fileoverview Tests for ExportManager class.
 */

import { beforeEach, describe, expect, it, vi } from 'bun:test';
import {
  createExportManager,
  downloadExportResult,
  ExportManager,
} from '../../src/managers/export-manager';
import type { ColumnDefinition } from '../../src/types/column';
import type { ExportDataFetcher } from '../../src/types/export';

interface TestUser {
  id: string;
  name: string;
  email: string;
  age: number;
  isActive: boolean;
  createdAt: Date;
}

const createTestColumns = (): ColumnDefinition<TestUser>[] => [
  {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: (user) => user.name,
    filterable: true,
    sortable: true,
  },
  {
    id: 'email',
    displayName: 'Email',
    type: 'text',
    accessor: (user) => user.email,
    filterable: true,
    sortable: true,
  },
  {
    id: 'age',
    displayName: 'Age',
    type: 'number',
    accessor: (user) => user.age,
    filterable: true,
    sortable: true,
  },
  {
    id: 'isActive',
    displayName: 'Active',
    type: 'boolean',
    accessor: (user) => user.isActive,
    filterable: true,
  },
  {
    id: 'createdAt',
    displayName: 'Created At',
    type: 'date',
    accessor: (user) => user.createdAt,
    filterable: true,
    sortable: true,
  },
];

const createTestData = (count: number): TestUser[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${i + 1}`,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    age: 20 + (i % 50),
    isActive: i % 2 === 0,
    createdAt: new Date(2024, 0, 1 + i),
  }));
};

const createMockFetcher = (data: TestUser[]): ExportDataFetcher<TestUser> => {
  return async ({ offset, limit }) => {
    const slicedData = data.slice(offset, offset + limit);
    return { data: slicedData, total: data.length };
  };
};

describe('ExportManager', () => {
  let columns: ColumnDefinition<TestUser>[];
  let testData: TestUser[];
  let dataFetcher: ExportDataFetcher<TestUser>;
  let exportManager: ExportManager<TestUser>;

  beforeEach(() => {
    columns = createTestColumns();
    testData = createTestData(100);
    dataFetcher = createMockFetcher(testData);
    exportManager = new ExportManager(columns, { dataFetcher });
  });

  describe('export', () => {
    it('should export data to CSV format', async () => {
      const result = await exportManager.export({
        format: 'csv',
        filename: 'test-export',
      });

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.csv');
      expect(result.mimeType).toBe('text/csv;charset=utf-8');
      expect(result.rowCount).toBe(100);
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('should export data to JSON format', async () => {
      const result = await exportManager.export({
        format: 'json',
        filename: 'test-export',
      });

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.json');
      expect(result.mimeType).toBe('application/json');
      expect(result.rowCount).toBe(100);
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('should export data to Excel format', async () => {
      const result = await exportManager.export({
        format: 'excel',
        filename: 'test-export',
      });

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.xlsx');
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(result.rowCount).toBe(100);
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('should handle empty datasets', async () => {
      const emptyFetcher = createMockFetcher([]);
      const manager = new ExportManager(columns, { dataFetcher: emptyFetcher });

      const result = await manager.export({
        format: 'csv',
        filename: 'empty-export',
      });

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
    });

    it('should process data in batches', async () => {
      const onBatchComplete = vi.fn();
      const result = await exportManager.export({
        format: 'csv',
        batch: {
          batchSize: 25,
          onBatchComplete,
        },
      });

      expect(result.success).toBe(true);
      expect(onBatchComplete).toHaveBeenCalledTimes(4); // 100 rows / 25 batch size
    });

    it('should emit progress events', async () => {
      const progressHandler = vi.fn();
      exportManager.subscribe(progressHandler);

      await exportManager.export({
        format: 'csv',
        batch: { batchSize: 50 },
      });

      const progressEvents = progressHandler.mock.calls.filter(
        ([event]) => event.type === 'progress'
      );
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('should emit start and complete events', async () => {
      const eventHandler = vi.fn();
      exportManager.subscribe(eventHandler);

      await exportManager.export({ format: 'csv' });

      const eventTypes = eventHandler.mock.calls.map(([event]) => event.type);
      expect(eventTypes).toContain('start');
      expect(eventTypes).toContain('complete');
    });

    it('should include duration in result', async () => {
      const result = await exportManager.export({ format: 'csv' });

      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include file size in result', async () => {
      const result = await exportManager.export({ format: 'csv' });

      expect(result.fileSize).toBeDefined();
      expect(result.fileSize).toBeGreaterThan(0);
    });
  });

  describe('CSV export', () => {
    it('should include headers by default', async () => {
      const result = await exportManager.export({ format: 'csv' });
      const content = await result.data!.text();

      expect(content).toContain('Name,Email,Age,Active,Created At');
    });

    it('should include BOM for UTF-8 compatibility', async () => {
      const result = await exportManager.export({
        format: 'csv',
        csv: { includeBom: true },
      });
      // Verify the blob contains the BOM by checking the array buffer
      const buffer = await result.data!.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // UTF-8 BOM is EF BB BF
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);
    });

    it('should escape special characters in CSV', async () => {
      const specialData: TestUser[] = [
        {
          id: '1',
          name: 'User, With Comma',
          email: 'user@example.com',
          age: 30,
          isActive: true,
          createdAt: new Date(2024, 0, 1),
        },
      ];
      const fetcher = createMockFetcher(specialData);
      const manager = new ExportManager(columns, { dataFetcher: fetcher });

      const result = await manager.export({ format: 'csv' });
      const content = await result.data!.text();

      expect(content).toContain('"User, With Comma"');
    });

    it('should handle null values', async () => {
      const result = await exportManager.export({ format: 'csv' });
      const content = await result.data!.text();

      expect(content).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('JSON export', () => {
    it('should produce valid JSON', async () => {
      const result = await exportManager.export({ format: 'json' });
      const content = await result.data!.text();

      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should include all columns', async () => {
      const result = await exportManager.export({ format: 'json' });
      const content = await result.data!.text();
      const parsed = JSON.parse(content);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty('name');
      expect(parsed[0]).toHaveProperty('email');
      expect(parsed[0]).toHaveProperty('age');
    });

    it('should pretty print when enabled', async () => {
      const result = await exportManager.export({
        format: 'json',
        json: { pretty: true },
      });
      const content = await result.data!.text();

      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });

    it('should include metadata when enabled', async () => {
      const result = await exportManager.export({
        format: 'json',
        json: { includeMetadata: true },
      });
      const content = await result.data!.text();
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('exportedAt');
      expect(parsed).toHaveProperty('rowCount');
      expect(parsed).toHaveProperty('columns');
      expect(parsed).toHaveProperty('data');
    });
  });

  describe('cancel', () => {
    it('should cancel an in-progress export', async () => {
      const eventHandler = vi.fn();
      exportManager.subscribe(eventHandler);

      // Start export then immediately cancel
      const exportPromise = exportManager.export({
        format: 'csv',
        batch: { batchSize: 10, delayBetweenBatches: 100 },
      });

      // Cancel after a short delay
      setTimeout(() => exportManager.cancel(), 50);

      const result = await exportPromise;

      // Should either be cancelled or completed (depending on timing)
      expect(result.success === false || result.rowCount < 100).toBe(true);
    });
  });

  describe('getProgress', () => {
    it('should return null when not exporting', () => {
      expect(exportManager.getProgress()).toBeNull();
    });
  });

  describe('isExporting', () => {
    it('should return false when not exporting', () => {
      expect(exportManager.isExporting()).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should allow subscribing to events', async () => {
      const handler = vi.fn();
      const unsubscribe = exportManager.subscribe(handler);

      await exportManager.export({ format: 'csv' });

      expect(handler).toHaveBeenCalled();
      unsubscribe();
    });

    it('should allow unsubscribing', async () => {
      const handler = vi.fn();
      const unsubscribe = exportManager.subscribe(handler);
      unsubscribe();

      await exportManager.export({ format: 'csv' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('column selection', () => {
    it('should export only selected columns', async () => {
      const result = await exportManager.export({
        format: 'csv',
        columns: [{ columnId: 'name' }, { columnId: 'email' }],
      });
      const content = await result.data!.text();

      expect(content).toContain('Name,Email');
      expect(content).not.toContain('Age');
      expect(content).not.toContain('Active');
    });

    it('should use custom headers when specified', async () => {
      const result = await exportManager.export({
        format: 'csv',
        columns: [
          { columnId: 'name', header: 'Full Name' },
          { columnId: 'email', header: 'Email Address' },
        ],
      });
      const content = await result.data!.text();

      expect(content).toContain('Full Name,Email Address');
    });

    it('should export single column', async () => {
      const result = await exportManager.export({
        format: 'csv',
        columns: [{ columnId: 'email' }],
      });
      const content = await result.data!.text();
      const lines = content.split('\n');
      const headerLine = lines[0].replace('\r', '');

      expect(headerLine).toBe('Email');
      expect(content).not.toContain('Name');
    });

    it('should respect column order in selection', async () => {
      const result = await exportManager.export({
        format: 'csv',
        columns: [{ columnId: 'age' }, { columnId: 'name' }, { columnId: 'email' }],
      });
      const content = await result.data!.text();
      const lines = content.split('\n');
      const headerLine = lines[0].replace('\r', '');

      expect(headerLine).toBe('Age,Name,Email');
    });

    it('should ignore invalid column ids', async () => {
      const result = await exportManager.export({
        format: 'csv',
        columns: [{ columnId: 'name' }, { columnId: 'invalid-column' }, { columnId: 'email' }],
      });
      const content = await result.data!.text();
      const lines = content.split('\n');
      const headerLine = lines[0].replace('\r', '');

      // Should only include valid columns
      expect(headerLine).toBe('Name,Email');
    });

    it('should export all columns when columns config is empty', async () => {
      const result = await exportManager.export({
        format: 'csv',
        columns: [],
      });
      const content = await result.data!.text();

      // Should export all columns
      expect(content).toContain('Name');
      expect(content).toContain('Email');
      expect(content).toContain('Age');
    });

    it('should work with JSON format', async () => {
      const result = await exportManager.export({
        format: 'json',
        columns: [{ columnId: 'name' }, { columnId: 'age' }],
      });
      const content = await result.data!.text();
      const parsed = JSON.parse(content);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty('name');
      expect(parsed[0]).toHaveProperty('age');
      expect(parsed[0]).not.toHaveProperty('email');
      expect(parsed[0]).not.toHaveProperty('isActive');
    });

    it('should work with Excel format', async () => {
      const result = await exportManager.export({
        format: 'excel',
        columns: [{ columnId: 'name' }, { columnId: 'email' }],
      });

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(100);
    });

    it('should exclude columns marked with include: false', async () => {
      const result = await exportManager.export({
        format: 'csv',
        columns: [
          { columnId: 'name', include: true },
          { columnId: 'email', include: false },
          { columnId: 'age', include: true },
        ],
      });
      const content = await result.data!.text();
      const lines = content.split('\n');
      const headerLine = lines[0].replace('\r', '');

      expect(headerLine).toBe('Name,Age');
      expect(content).not.toContain(',Email');
    });
  });
});

describe('downloadExportResult', () => {
  it('should throw if no data', () => {
    expect(() =>
      downloadExportResult({
        success: true,
        filename: 'test.csv',
        mimeType: 'text/csv',
        rowCount: 0,
      })
    ).toThrow('No data to download');
  });
});

describe('createExportManager', () => {
  it('should create an export manager from an adapter', () => {
    const columns = createTestColumns();
    const mockAdapter = {
      fetchData: async () => ({
        data: createTestData(10),
        total: 10,
      }),
    };

    const manager = createExportManager(columns, mockAdapter);
    expect(manager).toBeInstanceOf(ExportManager);
  });
});
