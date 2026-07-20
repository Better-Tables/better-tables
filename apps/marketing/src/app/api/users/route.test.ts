import { beforeEach, describe, expect, it, mock } from 'bun:test';

const getUsersDialectMock = mock(async (): Promise<'postgres' | 'sqlite'> => 'sqlite');
const getUsersBackendMetaMock = mock(
  async (): Promise<{
    dialect: 'postgres' | 'sqlite';
    supportsReset: boolean;
    dialectLabel: string;
    datasetLabel: string;
    title: string;
    description: string;
  }> => ({
    dialect: 'sqlite',
    supportsReset: true,
    dialectLabel: 'SQLite · in-memory',
    datasetLabel: '5,000 rows · SQLite',
    title: '5,000 rows. Zero mocks.',
    description: 'fallback',
  })
);
const deleteUsersByIdsMock = mock(async (ids: string[] | number[]) => ids.length);
const updateUsersStatusMock = mock(async (ids: string[] | number[]) => ids.length);
const resetUsersDatabaseMock = mock(async () => {});

mock.module('@/lib/demo/users/adapter', () => ({
  getUsersDialect: getUsersDialectMock,
  getUsersBackendMeta: getUsersBackendMetaMock,
  resetUsersDatabase: resetUsersDatabaseMock,
  resetAdapterCaches: mock(() => {}),
  getTables: mock(async () => ({ fetchData: mock(async () => ({})) })),
  resetUsersBackendForTests: mock(async () => {}),
}));

mock.module('@/lib/demo/users/mutations', () => ({
  deleteUsersByIds: deleteUsersByIdsMock,
  updateUsersStatus: updateUsersStatusMock,
  isUserStatus: (value: unknown) =>
    typeof value === 'string' && ['active', 'inactive', 'pending', 'suspended'].includes(value),
  USER_STATUSES: ['active', 'inactive', 'pending', 'suspended'],
}));

// Import after mock.module so the route binds to the stubs.
const { DELETE, PATCH, POST } = await import('./route');

function jsonRequest(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as import('next/server').NextRequest;
}

type NextRequest = import('next/server').NextRequest;

describe('DELETE /api/users', () => {
  beforeEach(() => {
    deleteUsersByIdsMock.mockClear();
    getUsersDialectMock.mockClear();
    getUsersDialectMock.mockImplementation(async () => 'sqlite');
  });

  it('rejects missing or invalid ids', async () => {
    const response = await DELETE(
      jsonRequest('http://localhost/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [] }),
      })
    );

    expect(response.status).toBe(400);
    expect(deleteUsersByIdsMock).not.toHaveBeenCalled();
  });

  it('deletes for valid sqlite numeric ids', async () => {
    const response = await DELETE(
      jsonRequest('http://localhost/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [1, 2] }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 2 });
    expect(deleteUsersByIdsMock).toHaveBeenCalledWith([1, 2]);
  });

  it('deletes for valid postgres UUID ids', async () => {
    getUsersDialectMock.mockImplementation(async () => 'postgres');
    const ids = ['02ca4de4-fd66-43f8-4a4d-e598711078e1', '97c3254a-ddab-479c-8c48-257fc6c62147'];

    const response = await DELETE(
      jsonRequest('http://localhost/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 2 });
    expect(deleteUsersByIdsMock).toHaveBeenCalledWith(ids);
  });
});

describe('PATCH /api/users', () => {
  beforeEach(() => {
    updateUsersStatusMock.mockClear();
    getUsersDialectMock.mockClear();
    getUsersDialectMock.mockImplementation(async () => 'sqlite');
  });

  it('rejects invalid status values', async () => {
    const response = await PATCH(
      jsonRequest('http://localhost/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [1], status: 'nope' }),
      })
    );

    expect(response.status).toBe(400);
    expect(updateUsersStatusMock).not.toHaveBeenCalled();
  });

  it('updates status for valid ids', async () => {
    const response = await PATCH(
      jsonRequest('http://localhost/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [3], status: 'suspended' }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 1 });
    expect(updateUsersStatusMock).toHaveBeenCalledWith([3], 'suspended');
  });
});

describe('POST /api/users', () => {
  beforeEach(() => {
    resetUsersDatabaseMock.mockClear();
    getUsersBackendMetaMock.mockClear();
    getUsersBackendMetaMock.mockImplementation(async () => ({
      dialect: 'sqlite',
      supportsReset: true,
      dialectLabel: 'SQLite · in-memory',
      datasetLabel: '5,000 rows · SQLite',
      title: '5,000 rows. Zero mocks.',
      description: 'fallback',
    }));
  });

  it('rejects unsupported actions', async () => {
    const response = await POST(
      jsonRequest('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wipe' }),
      })
    );

    expect(response.status).toBe(400);
    expect(resetUsersDatabaseMock).not.toHaveBeenCalled();
  });

  it('resets the sqlite fallback database', async () => {
    const response = await POST(
      jsonRequest('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reset: true });
    expect(resetUsersDatabaseMock).toHaveBeenCalledTimes(1);
  });

  it('rejects reset when the active dialect is postgres', async () => {
    getUsersBackendMetaMock.mockImplementation(async () => ({
      dialect: 'postgres',
      supportsReset: false,
      dialectLabel: 'Postgres · Neon',
      datasetLabel: '~1M users · Postgres',
      title: '~1M rows. Real Postgres.',
      description: 'neon',
    }));

    const response = await POST(
      jsonRequest('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
    );

    expect(response.status).toBe(400);
    expect(resetUsersDatabaseMock).not.toHaveBeenCalled();
  });
});
