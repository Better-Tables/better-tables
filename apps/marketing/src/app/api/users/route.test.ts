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
      error: null,
    })
);

mock.module('@/lib/demo/fetch-users', () => ({
  fetchUsers: fetchUsersMock,
}));

// Import after mock.module so the route binds to the stub.
const { GET } = await import('./route');

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
        error: 'secret sql fragment /Users/tome/.local/db',
      })
    );

    const response = await GET(new Request('http://localhost/api/users') as NextRequest);

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
        error: null,
      })
    );

    const response = await GET(new Request('http://localhost/api/users') as NextRequest);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ id: 1, name: 'Ada' }],
      total: 1,
      pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
      meta: { source: 'demo' },
    });
  });
});
