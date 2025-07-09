# Setting up Better Tables UI with Next.js and shadcn/ui

This guide shows how to integrate Better Tables UI into a Next.js project with shadcn/ui.

## Prerequisites

- Next.js project with Tailwind CSS configured
- shadcn/ui installed (or at least the CSS variables set up)

## Installation

```bash
npm install @better-tables/ui @better-tables/core @better-tables/drizzle
```

## Configuration

### 1. Update tailwind.config.js

Add the Better Tables UI package to your content array:

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    // Add Better Tables UI components
    "./node_modules/@better-tables/ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Your theme configuration
  },
  plugins: [require("tailwindcss-animate")],
}
```

### 2. Ensure Global Styles

Make sure your `app/globals.css` includes the shadcn/ui CSS variables:

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... rest of dark mode variables */
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

## Usage Example

```tsx
// app/users/page.tsx
'use client';

import { FilterBar } from '@better-tables/ui';
import { useTable, createColumnBuilder } from '@better-tables/core';
import { createDrizzleAdapter } from '@better-tables/drizzle';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';

const cb = createColumnBuilder<User>();

const columns = [
  cb.text()
    .id('name')
    .displayName('Name')
    .accessor(user => user.name)
    .searchable()
    .build(),
    
  cb.text()
    .id('email')
    .displayName('Email')
    .accessor(user => user.email)
    .searchable()
    .build(),
    
  cb.option()
    .id('role')
    .displayName('Role')
    .accessor(user => user.role)
    .options([
      { value: 'admin', label: 'Admin' },
      { value: 'user', label: 'User' },
      { value: 'guest', label: 'Guest' }
    ])
    .build(),
    
  cb.date()
    .id('createdAt')
    .displayName('Created')
    .accessor(user => user.createdAt)
    .build(),
];

const adapter = createDrizzleAdapter({
  db,
  table: users,
});

export default function UsersPage() {
  const { 
    data, 
    loading, 
    filterManager,
    paginationManager 
  } = useTable({
    config: {
      id: 'users-table',
      name: 'Users',
      columns,
      adapter,
      features: {
        filtering: true,
        sorting: true,
        pagination: true,
      }
    }
  });

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Users</h1>
      
      {/* Better Tables Filter Bar */}
      <FilterBar
        columns={columns}
        filters={filterManager.getFilters()}
        onFiltersChange={filterManager.setFilters}
        className="mb-6"
      />
      
      {/* Your table implementation */}
      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map(column => (
                <th key={column.id} className="p-2 text-left">
                  {column.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center p-4">
                  Loading...
                </td>
              </tr>
            ) : (
              data.map(row => (
                <tr key={row.id} className="border-b">
                  {columns.map(column => (
                    <td key={column.id} className="p-2">
                      {column.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## Customizing Theme

Since Better Tables UI uses your Tailwind configuration and CSS variables, you can customize the appearance by:

### 1. Updating CSS Variables

```css
:root {
  /* Change primary color to blue */
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  
  /* Adjust border radius */
  --radius: 0.75rem;
}
```

### 2. Using Tailwind Classes

All components accept `className` props:

```tsx
<FilterBar
  className="bg-card rounded-lg shadow-sm p-4"
  filters={filters}
  onFiltersChange={setFilters}
/>
```

### 3. Dark Mode

Better Tables UI components respect your dark mode implementation:

```tsx
// Using next-themes
import { ThemeProvider } from 'next-themes';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider attribute="class" defaultTheme="system">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

## Common Issues

### Components Look Unstyled

Make sure:
1. Your `tailwind.config.js` includes the Better Tables UI path
2. Your global CSS includes the shadcn/ui CSS variables
3. Tailwind CSS is properly configured in your project

### Type Errors

Ensure all packages are installed:
```bash
npm install @better-tables/ui @better-tables/core
```

### Build Errors

If you see build errors, make sure your `tsconfig.json` includes:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "node"
  }
}
```

## Next Steps

- Explore the [component documentation](../packages/ui/README.md)
- See [custom UI examples](./custom-ui-integration.md) for using your own components
- Check out the [core documentation](../packages/core/README.md) for advanced features 