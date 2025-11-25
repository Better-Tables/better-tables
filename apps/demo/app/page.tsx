import { parseTableSearchParams } from '@better-tables/ui/server';
import { UsersTableClient } from '@/components/users-table-client';
import { getAdapter } from '@/lib/adapter';
import { defaultVisibleColumns } from '@/lib/columns/user-columns';
import type { UserWithRelations } from '@/lib/db/schema';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
    columnVisibility?: string;
    columnOrder?: string;
  }>;
}

export default async function DemoPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Parse URL params for SSR initial data fetch
  // parseTableSearchParams automatically handles decompression
  const tableParams = parseTableSearchParams(params, {
    page: 1,
    limit: 10,
  });

  const { page, limit, filters, sorting } = tableParams;

  // Fetch data using adapter
  const adapter = await getAdapter();
  const result = await adapter.fetchData({
    columns: defaultVisibleColumns,
    pagination: { page, limit },
    filters,
    sorting,
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
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
          <div className="bg-white rounded-lg shadow-xs border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xs border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Filters Applied</p>
                <p className="text-2xl font-bold text-gray-900">{filters.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xs border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Page</p>
                <p className="text-2xl font-bold text-gray-900">
                  {result.pagination?.page || page} / {result.pagination?.totalPages || 1}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xs border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Page Size</p>
                <p className="text-2xl font-bold text-gray-900">{limit}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white p-4 rounded-lg shadow-xs">
          <UsersTableClient
            data={result.data as UserWithRelations[]}
            totalCount={result.total}
            initialPagination={
              result.pagination || {
                page: 1,
                limit: 10,
                totalPages: 1,
                hasNext: false,
                hasPrev: false,
              }
            }
            initialSorting={sorting}
            initialFilters={filters}
          />
        </div>

        {/* Features Info */}
        <div className="mt-8 bg-white rounded-lg shadow-xs border p-6">
          <h2 className="text-2xl font-bold mb-4">Features Demonstrated</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Column Types</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Text columns (name, email, bio)</li>
                <li>• Number columns (age)</li>
                <li>• Date columns (joined date)</li>
                <li>• Option columns (role, status)</li>
                <li>• Relationship columns (profile data)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Relationships</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• One-to-one (user → profile)</li>
                <li>• One-to-many (user → posts)</li>
                <li>• Cross-table filtering</li>
                <li>• Nested data access</li>
                <li>• Relationship-based columns</li>
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
