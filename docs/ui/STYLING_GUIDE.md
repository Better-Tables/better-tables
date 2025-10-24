# @better-tables/ui - Styling Guide

## Overview

The Better Tables UI package is built on top of Tailwind CSS and shadcn/ui, providing a comprehensive styling system that's both powerful and flexible. This guide covers theming, customization, and styling best practices.

## Table of Contents

- [Theme System](#theme-system)
- [CSS Variables](#css-variables)
- [Component Styling](#component-styling)
- [Customization](#customization)
- [Dark Mode](#dark-mode)
- [Responsive Design](#responsive-design)
- [Accessibility](#accessibility)
- [Performance](#performance)

## Theme System

### CSS Variables

Better Tables UI uses CSS custom properties for theming, following the shadcn/ui design system:

```css
:root {
  /* Base colors */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  
  /* Primary colors */
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  
  /* Secondary colors */
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  
  /* Muted colors */
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  
  /* Accent colors */
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  
  /* Destructive colors */
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  
  /* Border and input */
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  
  /* Border radius */
  --radius: 0.5rem;
}
```

### Dark Mode Variables

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
}
```

## Component Styling

### Filter Components

#### FilterBar

```tsx
<FilterBar
  className="bg-card border rounded-lg shadow-sm p-4"
  theme={{
    container: "space-y-4",
    addButton: "bg-primary text-primary-foreground hover:bg-primary/90",
    clearButton: "text-muted-foreground hover:text-foreground",
  }}
/>
```

#### ActiveFilters

```tsx
<ActiveFilters
  className="flex flex-wrap gap-2"
  theme={{
    container: "space-y-2",
    filterBadge: "bg-secondary text-secondary-foreground border rounded-md px-2 py-1",
    removeButton: "text-destructive hover:text-destructive/80",
  }}
/>
```

#### Filter Inputs

```tsx
<TextFilterInput
  className="w-full"
  theme={{
    input: "border border-input bg-background text-foreground",
    error: "text-destructive text-sm",
  }}
/>
```

### Table Components

#### BetterTable

```tsx
<BetterTable
  className="border rounded-lg overflow-hidden"
  theme={{
    container: "bg-background",
    header: "bg-muted/50 border-b",
    row: "border-b hover:bg-muted/50",
    cell: "px-4 py-2",
  }}
/>
```

#### VirtualizedTable

```tsx
<VirtualizedTable
  className="border rounded-lg"
  theme={{
    container: "bg-background",
    viewport: "overflow-auto",
    row: "border-b hover:bg-muted/50",
  }}
/>
```

## Customization

### Custom Color Schemes

#### Blue Theme

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
}
```

#### Green Theme

```css
:root {
  --primary: 142.1 76.2% 36.3%;
  --primary-foreground: 355.7 100% 97.3%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
}
```

#### Purple Theme

```css
:root {
  --primary: 262.1 83.3% 57.8%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
}
```

### Custom Border Radius

```css
:root {
  --radius: 0.75rem; /* More rounded */
}

:root {
  --radius: 0.25rem; /* Less rounded */
}
```

### Custom Spacing

```css
:root {
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

## Dark Mode

### Implementation with next-themes

```tsx
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

### Manual Dark Mode Toggle

```tsx
import { useState, useEffect } from 'react';

function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-md border"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### Dark Mode Components

```tsx
// Components automatically adapt to dark mode
<BetterTable
  data={data}
  columns={columns}
  // No additional props needed for dark mode
/>
```

## Responsive Design

### Mobile-First Approach

```tsx
<FilterBar
  className="
    flex flex-col space-y-2
    sm:flex-row sm:space-y-0 sm:space-x-2
    md:space-x-4
  "
/>
```

### Responsive Table Layout

```tsx
<BetterTable
  className="
    block sm:table
    w-full
    overflow-x-auto
    sm:overflow-x-visible
  "
  features={{
    filtering: true,
    pagination: true,
    rowSelection: false, // Disable on mobile
  }}
/>
```

### Responsive Filter Inputs

```tsx
<TextFilterInput
  className="
    w-full
    sm:w-auto
    md:w-64
  "
/>
```

### Breakpoint Utilities

```css
/* Custom breakpoints */
@media (max-width: 640px) {
  .table-mobile {
    display: block;
  }
  
  .table-desktop {
    display: none;
  }
}

@media (min-width: 641px) {
  .table-mobile {
    display: none;
  }
  
  .table-desktop {
    display: table;
  }
}
```

## Accessibility

### Focus Management

```tsx
<FilterBar
  className="focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
/>
```

### High Contrast Mode

```css
@media (prefers-contrast: high) {
  :root {
    --border: 0 0% 0%;
    --ring: 0 0% 0%;
  }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .table-row {
    transition: none;
  }
  
  .filter-transition {
    transition: none;
  }
}
```

### Screen Reader Support

```tsx
<BetterTable
  aria-label="User data table"
  aria-describedby="table-description"
  className="sr-only focus:ring-2 focus:ring-primary focus:outline-none"
/>
```

## Performance

### CSS Optimization

```css
/* Use CSS containment for better performance */
.table-container {
  contain: layout style paint;
}

/* Optimize animations */
.table-row {
  will-change: transform;
  transform: translateZ(0);
}
```

### Tailwind Purge Configuration

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@better-tables/ui/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Custom theme extensions
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

### Critical CSS

```css
/* Critical styles for above-the-fold content */
.table-header {
  background-color: hsl(var(--background));
  border-bottom: 1px solid hsl(var(--border));
}

.filter-bar {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
}
```

## Advanced Customization

### Custom Component Variants

```tsx
import { cva } from 'class-variance-authority';

const filterButtonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-4',
        lg: 'h-10 px-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);
```

### Custom Animation Classes

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.filter-slide-in {
  animation: slideIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.table-fade-in {
  animation: fadeIn 0.3s ease-out;
}
```

### Custom Utility Classes

```css
/* Custom utilities for Better Tables */
.table-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground)) transparent;
}

.table-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.table-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.table-scrollbar::-webkit-scrollbar-thumb {
  background-color: hsl(var(--muted-foreground));
  border-radius: 3px;
}

.filter-glass {
  backdrop-filter: blur(10px);
  background-color: hsl(var(--background) / 0.8);
}
```

## Best Practices

### 1. Use Semantic Color Names

```tsx
// ✅ Good
<Button className="bg-primary text-primary-foreground" />

// ❌ Avoid
<Button className="bg-blue-500 text-white" />
```

### 2. Leverage CSS Variables

```tsx
// ✅ Good
<div className="bg-background text-foreground border border-border" />

// ❌ Avoid
<div className="bg-white text-black border border-gray-200" />
```

### 3. Use Consistent Spacing

```tsx
// ✅ Good
<div className="space-y-4 p-4" />

// ❌ Avoid
<div className="space-y-2 p-2" />
```

### 4. Optimize for Performance

```tsx
// ✅ Good - Use CSS containment
<div className="contain-layout contain-style contain-paint" />

// ❌ Avoid - Expensive operations
<div className="backdrop-blur-lg" />
```

### 5. Maintain Accessibility

```tsx
// ✅ Good - Proper focus management
<button className="focus:ring-2 focus:ring-primary focus:ring-offset-2" />

// ❌ Avoid - Poor focus indicators
<button className="focus:outline-none" />
```

## Troubleshooting

### Common Issues

#### 1. Styles Not Applying

```bash
# Check Tailwind configuration
npx tailwindcss --init

# Ensure Better Tables UI is in content paths
```

#### 2. Dark Mode Not Working

```tsx
// Ensure dark class is applied to html element
document.documentElement.classList.add('dark');
```

#### 3. Custom Colors Not Working

```css
/* Ensure HSL format */
:root {
  --custom-color: 221.2 83.2% 53.3%; /* HSL values */
}
```

#### 4. Performance Issues

```css
/* Use CSS containment */
.table-container {
  contain: layout style paint;
}

/* Optimize animations */
.table-row {
  will-change: transform;
}
```

## Related Documentation

- [Component Reference](./COMPONENT_REFERENCE.md)
- [Hooks Reference](./HOOKS_REFERENCE.md)
- [Filter Components Reference](./FILTER_COMPONENTS_REFERENCE.md)
- [Table Components Reference](./TABLE_COMPONENTS_REFERENCE.md)
- [Getting Started Guide](../GETTING_STARTED.md)
