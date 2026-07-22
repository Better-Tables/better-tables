import { CodeBlock } from '@/components/site/code-block';
import { SectionRow } from '@/components/site/section-row';

const DEFINE_SNIPPET = `export const tickets = defineTable<Tables>()(
  'tickets',
  (t) => ({
    columns: [
      ...t.auto(), // inferred from schema
      t.text('customer.company') // joined
        .searchable()
        .editable(),
      t.number('reopenCount').filterable(),
      t.date('createdAt').sortable(),
    ],
  })
);`;

const SQL_SNIPPET = `select "tickets"."id", "tickets"."subject",
       "customers"."company"
from "tickets"
left join "customers"
  on "customers"."id"
     = "tickets"."customer_id"
where "customers"."company" like '%acme%'
order by "tickets"."created_at" desc
limit 10 offset 0`;

const INIT_SNIPPET = `$ npx @better-tables/cli@latest init
# detects your shadcn/ui setup
# installs core + the drizzle adapter
# copies table + filter source into
#   your components dir — yours to edit`;

const steps: Array<{
  key: string;
  heading: string;
  body: string;
  block: React.ReactNode;
}> = [
  {
    key: 'define',
    heading: 'Define columns',
    body: 'One builder chain per column. A dotted path like customer.company pulls in a field from a related table — and any typo in that path is a compile error, not a 2 a.m. surprise.',
    block: <CodeBlock code={DEFINE_SNIPPET} lang="tsx" title="columns.ts" />,
  },
  {
    key: 'compile',
    heading: 'State becomes SQL',
    body: 'Every filter, sort, and page turns into a real query against your database. The adapter joins only the tables that query actually needs — nothing speculative, nothing over-fetched.',
    block: <CodeBlock code={SQL_SNIPPET} lang="sql" title="what the adapter runs" />,
  },
  {
    key: 'own',
    heading: 'Own the UI',
    body: 'The CLI copies the table and filter components into your repo as source you can edit, already wired to your shadcn/ui theme. No black-box dependency to fight later.',
    block: <CodeBlock code={INIT_SNIPPET} lang="bash" title="terminal" />,
  },
];

export function Pipeline() {
  return (
    <SectionRow
      index="02"
      label="how it works"
      title="Columns in. Queries out."
      description="One column definition drives everything. When a user filters or sorts, that action becomes SQL for Postgres, MySQL, or SQLite; the results render straight back into the UI — typed all the way from the database to the cell."
    >
      <div className="grid gap-8 lg:grid-cols-3 lg:gap-6">
        {steps.map((step) => (
          <div key={step.key} className="flex flex-col gap-4">
            <div>
              <p className="row-eyebrow">
                <b>{step.key}</b>
              </p>
              <h3 className="mt-2.5 font-display text-[17px] font-semibold tracking-tight">
                {step.heading}
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
            <div className="mt-auto">{step.block}</div>
          </div>
        ))}
      </div>
    </SectionRow>
  );
}
