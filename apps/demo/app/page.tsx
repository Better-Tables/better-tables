import type { FilterState, SortingState } from '@better-tables/core';
import { UsersTableClient } from '@/components/users-table-client';
import { getAdapter } from '@/lib/adapter';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
  }>;
}

export default async function DemoPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Parse URL params
  const page = Number.parseInt(params.page || '1', 10);
  const limit = Number.parseInt(params.limit || '10', 10);

  let filters: FilterState[] = [];
  if (params.filters) {
    try {
      const parsedFilters = JSON.parse(params.filters);
      // Filter out invalid filters: date filters and filters with empty values
      filters = parsedFilters.filter(
        (f: FilterState) => f.type !== 'date' && f.values && f.values.length > 0
      );
    } catch (_e) {
      // Ignore parse errors
    }
  }

  let sorting: SortingState = [];
  if (params.sorting) {
    try {
      sorting = JSON.parse(params.sorting);
    } catch (_e) {
      // Ignore parse errors
    }
  }

  // Fetch data using adapter
  const adapter = await getAdapter();
  const result = await adapter.fetchData({
    pagination: { page, limit },
    filters,
    sorting,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Better Tables Demo</h1>
          <p className="text-lg text-gray-600">
            Comprehensive showcase of Better Tables with Drizzle adapter
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Filters Applied</p>
                <p className="text-2xl font-bold text-gray-900">{filters.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Page</p>
                <p className="text-2xl font-bold text-gray-900">
                  {result.pagination?.page || page} / {result.pagination?.totalPages || 1}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Page Size</p>
                <p className="text-2xl font-bold text-gray-900">{limit}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <UsersTableClient
            data={result.data}
            totalCount={result.total}
            pagination={result.pagination!}
            sorting={sorting}
            filters={filters}
          />
        </div>

        {/* Features Info */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-2xl font-bold mb-4">Features Demonstrated</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Column Types</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Text columns (name, email, bio)</li>
                <li>• Number columns (age, views, likes)</li>
                <li>• Date columns (joined date)</li>
                <li>• Boolean columns (has_profile, is_active)</li>
                <li>• Option columns (role, status)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Relationships</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• One-to-one (user → profile)</li>
                <li>• One-to-many (user → posts)</li>
                <li>• Cross-table filtering</li>
                <li>• Aggregate queries</li>
                <li>• Computed columns</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Operations</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Advanced filtering</li>
                <li>• Multi-column sorting</li>
                <li>• Pagination</li>
                <li>• Server-side rendering</li>
                <li>• URL-based state</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
