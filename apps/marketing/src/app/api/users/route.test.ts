import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { NextRequest } from 'next/server';
import type { FetchUsersResult } from '@/lib/demo/fetch-users';

const fetchUsersMock = mock(
  (): Promise<FetchUsersResult> =>
    Promise.resolve({
      result: {
        data: [],
        total: 0,
        pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
      },
      filters: [],
      sorting: [],
      queries: [],
      error: null,
    })
);

const deleteWhereMock = mock(() => Promise.resolve());
const deleteMock = mock(() => ({ where: deleteWhereMock }));
const updateWhereMock = mock(() => Promise.resolve());
const updateMock = mock(() => ({ set: () => ({ where: updateWhereMock }) }));
const getDatabaseMock = mock(async () => ({
  db: {
    delete: deleteMock,
    update: updateMock,
  },
}));
const resetDatabaseMock = mock(async () => {});
const resetAdapterCachesMock = mock(() => {});

mock.module('@/lib/demo/fetch-users', () => ({
  fetchUsers: fetchUsersMock,
}));

mock.module('@/lib/db', () => ({
  getDatabase: getDatabaseMock,
  resetDatabase: resetDatabaseMock,
}));

mock.module('@/lib/adapter', () => ({
  resetAdapterCaches: resetAdapterCachesMock,
}));

mock.module('@/lib/db/schema', () => ({
  schema: {
    users: { id: 'users.id', status: 'users.status' },
    profiles: { userId: 'profiles.userId' },
    posts: { userId: 'posts.userId' },
  },
}));

mock.module('drizzle-orm', () => ({
  inArray: (column: unknown, ids: unknown[]) => ({ column, ids }),
}));

// Import after mock.module so the route binds to the stubs.
const { GET, DELETE, PATCH, POST } = await import('./route');

function jsonRequest(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as NextRequest;
}

describe('GET /api/users', () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchUsersMock.mockClear();
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns 500 with a generic client message when fetchUsers fails', async () => {
    fetchUsersMock.mockImplementationOnce(() =>
      Promise.resolve({
        result: {
          data: [],
          total: 0,
          pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
        },
        filters: [],
        sorting: [],
        queries: [],
        error: 'secret sql fragment /Users/tome/.local/db',
      })
    );

    const response = await GET(jsonRequest('http://localhost/api/users'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to load demo data.' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[api/users]',
      'secret sql fragment /Users/tome/.local/db'
    );
  });

  it('returns data payload when fetchUsers succeeds', async () => {
    fetchUsersMock.mockImplementationOnce(() =>
      Promise.resolve({
        result: {
          data: [{ id: 1, name: 'Ada' }] as FetchUsersResult['result']['data'],
          total: 1,
          pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
          meta: { source: 'demo' },
        },
        filters: [],
        sorting: [],
        queries: [],
        error: null,
      })
    );

    const response = await GET(jsonRequest('http://localhost/api/users'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ id: 1, name: 'Ada' }],
      total: 1,
      pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
      meta: { source: 'demo' },
    });
  });
});

describe('DELETE /api/users', () => {
  beforeEach(() => {
    deleteMock.mockClear();
    deleteWhereMock.mockClear();
    getDatabaseMock.mockClear();
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
    expect(getDatabaseMock).not.toHaveBeenCalled();
  });

  it('deletes posts, profiles, then users for valid ids', async () => {
    const response = await DELETE(
      jsonRequest('http://localhost/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [1, 2] }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 2 });
    expect(deleteMock).toHaveBeenCalledTimes(3);
  });
});

describe('PATCH /api/users', () => {
  beforeEach(() => {
    updateMock.mockClear();
    updateWhereMock.mockClear();
    getDatabaseMock.mockClear();
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
    expect(getDatabaseMock).not.toHaveBeenCalled();
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
    expect(updateMock).toHaveBeenCalled();
  });
});

describe('POST /api/users', () => {
  beforeEach(() => {
    resetDatabaseMock.mockClear();
    resetAdapterCachesMock.mockClear();
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
    expect(resetDatabaseMock).not.toHaveBeenCalled();
    expect(resetAdapterCachesMock).not.toHaveBeenCalled();
  });

  it('resets the database and clears adapter caches', async () => {
    const response = await POST(
      jsonRequest('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reset: true });
    expect(resetDatabaseMock).toHaveBeenCalledTimes(1);
    expect(resetAdapterCachesMock).toHaveBeenCalledTimes(1);
  });
});
