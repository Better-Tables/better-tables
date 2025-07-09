# @better-tables/ui

Beautiful, accessible table UI components for Better Tables built with [shadcn/ui](https://ui.shadcn.com/).

## Requirements

This package is built on top of shadcn/ui components and requires:

1. **Tailwind CSS** configured in your project
2. **shadcn/ui global styles** with CSS variables for theming

## Installation

```bash
npm install @better-tables/ui @better-tables/core
# or
yarn add @better-tables/ui @better-tables/core
# or
pnpm add @better-tables/ui @better-tables/core
```

## Setup

### 1. Configure Tailwind CSS

Add the Better Tables UI package to your `tailwind.config.js` content array:

```js
module.exports = {
  content: [
    // ... your existing content paths
    "./node_modules/@better-tables/ui/**/*.{js,ts,jsx,tsx}",
  ],
  // ... rest of your config
}
```

### 2. Ensure shadcn/ui Globals

This package uses shadcn/ui components which require CSS variables for theming. Make sure your global CSS includes the shadcn/ui variables:

```css
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
    /* ... dark mode variables */
  }
}
```

If you're already using shadcn/ui in your project, you likely have these set up. If not, see the [shadcn/ui theming docs](https://ui.shadcn.com/docs/theming).

## Usage

```tsx
import { FilterBar, Table } from '@better-tables/ui';
import { useTable } from '@better-tables/core';

export function MyTable() {
  const { filterManager, columns, data } = useTable(config);
  
  return (
    <>
      <FilterBar 
        columns={columns}
        filters={filterManager.getFilters()}
        onFiltersChange={filterManager.setFilters}
      />
      <Table data={data} columns={columns} />
    </>
  );
}
```

## Components

- **FilterBar**: Complete filter UI with dropdown, active filters, and search
- **FilterInput**: Individual filter input components for each data type
- **Table**: Full-featured table with sorting, pagination, and selection
- **ActiveFilters**: Display and manage active filters

## Customization

### Styling

All components accept a `className` prop for styling:

```tsx
<FilterBar 
  className="my-custom-filter-bar"
  filters={filters}
/>
```

### Theming

The components use your existing Tailwind theme and shadcn/ui CSS variables. To customize colors, update your CSS variables:

```css
:root {
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  /* ... other variables */
}
```

## Using Without This Package

Better Tables is designed to work with any UI. See the [custom UI integration guide](../../examples/custom-ui-integration.md) for examples using Material-UI, Ant Design, or vanilla JavaScript.

## License

MIT 