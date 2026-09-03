import { ExampleShell } from '@/components/examples/example-shell';
import { AdminNavigatorClient } from '@/components/sections/admin-navigator-client';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Admin navigator example',
  description:
    'Browse every table in a schema with zero per-table code: <TableNavigator>, FK-click navigation, and a generic create/edit form.',
});

export default function AdminNavigatorPage() {
  return (
    <ExampleShell
      index="06"
      total="06"
      label="metadata-driven admin"
      title="Instant admin UI from live DB metadata"
      lede={
        <>
          One component, zero per-table code: <code>{'<TableNavigator>'}</code> lists every table
          from <code>adapter.listTables()</code>, resolves each one's columns from{' '}
          <code>describeColumns()</code>, and lets you create and edit records through the same
          per-type field editors inline cell editing uses. Click a customer or assignee id to jump
          straight to that related row.
        </>
      }
      sourcePath="src/app/(marketing)/examples/admin-navigator/page.tsx"
      facts={['listTables', 'FK-click navigation', 'RecordFormDialog', 'per-table overrides']}
    >
      <AdminNavigatorClient />
    </ExampleShell>
  );
}
