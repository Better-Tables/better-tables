import {
  ArrowRight,
  Code,
  Database,
  Filter,
  Github,
  Link as LinkIcon,
  Palette,
  Server,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";
import { InstallBlock } from "@/components/install-block";
import { Logo } from "@/components/logo";
import { ThemeImage } from "@/components/theme-image";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-background to-muted/20 py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 flex justify-center">
              <Logo size="xl" className="h-16 w-auto" />
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Type-safe tables for React.
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Zero boilerplate.
              </span>
            </h1>
            <p className="mb-8 text-xl text-muted-foreground md:text-2xl">
              Stop writing boilerplate. Start shipping features. Better Tables
              gives you powerful filtering, sorting, and pagination—all with
              automatic relationship handling and end-to-end type safety.
            </p>
            <div className="mb-8">
              <InstallBlock />
            </div>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/docs/installation"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="https://github.com/Better-Tables/better-tables"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </Link>
            </div>
          </div>
        </div>
        {/* Demo Image */}
        <div className="container mx-auto px-4 mt-12 md:mt-16">
          <div className="mx-auto max-w-6xl">
            <div className="relative rounded-lg border bg-card/50 p-4 shadow-lg overflow-hidden">
              <ThemeImage
                lightSrc="/demo/demo.webp"
                darkSrc="/demo/demo-dark.webp"
                alt="Better Tables Demo"
                width={1200}
                height={800}
                className="w-full h-auto rounded-md"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section className="border-b bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Why Better Tables?
            </h2>
            <p className="text-lg text-muted-foreground">
              The React table library that handles the complexity so you don't
              have to
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                Automatic Relationships
              </h3>
              <p className="text-muted-foreground">
                Filter across joined tables without writing JOIN queries. The
                adapter automatically detects relationships, builds queries, and
                maintains type safety.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Code className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                Type-Safe End-to-End
              </h3>
              <p className="text-muted-foreground">
                Full TypeScript inference from your database schema to your UI
                components. Catch errors at compile time, not runtime.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Zero Boilerplate</h3>
              <p className="text-muted-foreground">
                Declarative column definitions give you filtering, sorting, and
                pagination automatically. No useState hooks, no prop drilling,
                no headaches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="border-b py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Everything You Need
            </h2>
            <p className="text-lg text-muted-foreground">
              Powerful features out of the box, no configuration required
            </p>
          </div>
          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-background p-6">
              <Filter className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">Advanced Filtering</h3>
              <p className="text-sm text-muted-foreground">
                Six filter types with 20+ operators. Text, number, date, option,
                multi-option, and boolean filters with intuitive UI.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-6">
              <Database className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">Database Adapters</h3>
              <p className="text-sm text-muted-foreground">
                Connect to any backend with a consistent API. Currently supports
                Drizzle ORM with more adapters coming soon.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-6">
              <Zap className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">Virtual Scrolling</h3>
              <p className="text-sm text-muted-foreground">
                Render millions of rows efficiently with built-in
                virtualization. Smooth performance even with large datasets.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-6">
              <LinkIcon className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">
                URL State Persistence
              </h3>
              <p className="text-sm text-muted-foreground">
                Every filter, sort, and pagination state syncs to the URL. Users
                can bookmark and share filtered views.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-6">
              <Palette className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">
                Beautiful UI Components
              </h3>
              <p className="text-sm text-muted-foreground">
                Production-ready React components built with shadcn/ui. Fully
                accessible, customizable, and themeable.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-6">
              <Server className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">
                Server-Side Rendering
              </h3>
              <p className="text-sm text-muted-foreground">
                Full Next.js support with server-side rendering. Works
                seamlessly with App Router and Pages Router.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example Section */}
      <section className="border-b bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Simple by Design
            </h2>
            <p className="text-lg text-muted-foreground">
              Define your columns once. Get filtering, sorting, and pagination
              automatically.
            </p>
          </div>
          <div className="mx-auto max-w-4xl">
            <CodeBlock
              filename="Example: Creating a table with automatic relationship filtering"
              code={`import { BetterTable } from '@better-tables/ui';
import { createColumnBuilder } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

const cb = createColumnBuilder<User>();

const columns = [
  cb.text().id('name').accessor(u => u.name).build(),
  // Filter across relationships automatically!
  cb.text().id('profile.location')
    .accessor(u => u.profile?.location).build(),
  cb.number().id('posts.count')
    .accessor(u => u.posts?.length || 0).build(),
];

function UserTable() {
  return (
    <BetterTable
      columns={columns}
      adapter={drizzleAdapter(db)}
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
      }}
    />
  );
}`}
              language="typescript"
              showLineNumbers={true}
            />
            <p className="mt-6 text-center text-sm text-muted-foreground">
              That's it. No JOIN queries to write. No filter logic to wire up.
              Just define your columns and you're done.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-gradient-to-b from-muted/30 to-background py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Ready to Build Better Tables?
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Join developers who are building powerful data tables without the
              boilerplate
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/docs/installation"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="https://github.com/Better-Tables/better-tables"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
              >
                <Github className="h-4 w-4" />
                Star on GitHub
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
