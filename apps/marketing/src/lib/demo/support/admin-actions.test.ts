import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { InferredColumnSpec } from '@better-tables/core';

const TICKET_SPECS: InferredColumnSpec[] = [
  {
    field: 'id',
    columnType: 'number',
    label: 'Id',
    nullable: false,
    primaryKey: true,
    foreignKey: false,
    writable: false,
  },
  {
    field: 'subject',
    columnType: 'text',
    label: 'Subject',
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
  {
    field: 'reopenCount',
    columnType: 'number',
    label: 'Reopen Count',
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
];

const createRecordMock = mock(async (data: Record<string, unknown>) => ({ id: 99, ...data }));
const updateRecordMock = mock(async (id: string, data: Record<string, unknown>) => ({
  id,
  ...data,
}));
const describeColumnsMock = mock(async () => TICKET_SPECS);

mock.module('./db', () => ({
  getSupportTables: mock(async () => ({
    database: {
      createRecord: createRecordMock,
      updateRecord: updateRecordMock,
      describeColumns: describeColumnsMock,
    },
  })),
}));

// Import after mock.module so the module binds to the stub.
const { createSupportRecord, updateSupportRecord } = await import('./admin-actions');

afterAll(() => {
  mock.restore();
});

describe('createSupportRecord / updateSupportRecord', () => {
  beforeEach(() => {
    createRecordMock.mockClear();
    updateRecordMock.mockClear();
    describeColumnsMock.mockClear();
  });

  it('rejects a table outside the allowlist without reaching the adapter', async () => {
    await expect(createSupportRecord('other', { subject: 'Hi' })).rejects.toThrow(
      'Table "other" is not allowed on this endpoint.'
    );
    expect(describeColumnsMock).not.toHaveBeenCalled();
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it('drops non-writable and unknown fields before creating', async () => {
    await createSupportRecord('tickets', {
      id: 12345, // writable: false — must be dropped
      subject: 'Help',
      reopenCount: 2,
      notAColumn: 'malicious', // not in the schema at all — must be dropped
    });

    expect(createRecordMock).toHaveBeenCalledWith(
      { subject: 'Help', reopenCount: 2 },
      { table: 'tickets' }
    );
  });

  it('rejects a value that fails type coercion for its column', async () => {
    await expect(
      createSupportRecord('tickets', { subject: 'Help', reopenCount: 'not-a-number' })
    ).rejects.toThrow(/reopenCount/);
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it('sanitizes updateSupportRecord the same way and forwards the row id', async () => {
    await updateSupportRecord('tickets', '7', {
      id: 999,
      subject: 'Updated',
      extra: 'nope',
    });

    expect(updateRecordMock).toHaveBeenCalledWith(
      '7',
      { subject: 'Updated' },
      { table: 'tickets' }
    );
  });
});
