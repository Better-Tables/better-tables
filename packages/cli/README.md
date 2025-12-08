# @better-tables/cli

Command-line utilities for Better Tables. Execute commands directly without installation using `pnpm dlx`, `npx`, or `bunx`.

## Usage

### Open Documentation

```bash
# Open main documentation
pnpm dlx @better-tables/cli docs
npx @better-tables/cli docs
bunx --bun @better-tables/cli docs

# Open specific package documentation
pnpm dlx @better-tables/cli docs core      # Core package docs
pnpm dlx @better-tables/cli docs ui        # UI package docs
pnpm dlx @better-tables/cli docs drizzle   # Drizzle adapter docs
```

### Available Commands

- `docs [type]` - Open documentation in browser
  - `type`: Optional. One of: `main`, `core`, `ui`, `drizzle` (default: `main`)

- `init` - Initialize Better Tables in your project
  - `--cwd <path>`: Working directory (default: current directory)
  - `--skip-shadcn`: Skip shadcn component installation
  - `-y, --yes`: Skip confirmation prompts

### Examples

```bash
# Open main README
pnpm dlx @better-tables/cli docs

# Open core package documentation
npx @better-tables/cli docs core

# Open UI package documentation
bunx --bun @better-tables/cli docs ui

# Open Drizzle adapter documentation
pnpm dlx @better-tables/cli docs drizzle

# Initialize Better Tables in your project
pnpm dlx @better-tables/cli init

# Initialize with custom working directory
npx @better-tables/cli init --cwd ./my-project

# Initialize without shadcn component installation
bunx --bun @better-tables/cli init --skip-shadcn

# Initialize without prompts (non-interactive)
pnpm dlx @better-tables/cli init -y
```

## Installation (Optional)

If you prefer to install globally:

```bash
npm install -g @better-tables/cli
# Then use: better-tables docs
# Or: better-tables init
```

## Initialization

The `init` command helps you set up Better Tables in your project:

1. **Validates shadcn setup** - Checks for `components.json` configuration
2. **Installs missing shadcn components** - Automatically installs 21 required UI components
3. **Copies Better Tables files** - Copies table, filter, hook, store, and utility files to your project
4. **Transforms imports** - Updates import paths to match your project's alias configuration

### Prerequisites

- Your project must have shadcn/ui initialized (`npx shadcn@latest init`)
- Node.js 18+ is required

### What Gets Copied

The init command copies the following files to your project:

- **Table components**: `{components}/table/*`
- **Filter components**: `{components}/filters/*`
- **Hooks**: `{hooks}/*` or `{components}/hooks/*`
- **Stores**: `{components}/stores/*`
- **Utilities**: `{lib}/utils/*`
- **Lib files**: `{lib}/*`

All import paths are automatically transformed to match your `components.json` alias configuration.

### After Initialization

After running `init`, you'll need to:

1. Install peer dependencies:
   ```bash
   npm install @better-tables/core zustand @dnd-kit/core @dnd-kit/sortable
   ```

2. Import and use BetterTable:
   ```tsx
   import { BetterTable } from '@/components/table/table';
   ```

## Development

```bash
# Build
bun run build

# Watch mode
bun run dev

# Test
bun test

# Lint
bun run lint
```

## Testing Locally

### Option 1: Using Bun (Recommended)

```bash
# From the CLI package directory
cd packages/cli

# Build the package
bun run build

# Test the CLI directly
node dist/cli.js docs
node dist/cli.js docs core
node dist/cli.js docs ui
node dist/cli.js docs drizzle
node dist/cli.js init --help

# Or use bun to run the source directly
bun src/cli.ts docs
bun src/cli.ts docs core
bun src/cli.ts init --help
```

### Option 2: Using pnpm dlx (Local Package)

```bash
# From the monorepo root
cd ../..

# Build the CLI package first
bun run build --filter @better-tables/cli

# Test using pnpm dlx (will use local package)
pnpm dlx --filter @better-tables/cli better-tables docs
pnpm dlx --filter @better-tables/cli better-tables docs core
pnpm dlx --filter @better-tables/cli better-tables init --help
```

### Option 3: Link Package Globally

```bash
# From the CLI package directory
cd packages/cli

# Build first
bun run build

# Link globally (npm)
npm link

# Or use pnpm link
pnpm link --global

# Then use from anywhere
better-tables docs
better-tables docs core
better-tables init --help
```

### Option 4: Run Tests

```bash
# From the CLI package directory
cd packages/cli

# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Testing the Bin Entry Point

After building, you can test the bin entry point:

```bash
# From the CLI package directory
cd packages/cli
bun run build

# Test the bin entry
./dist/cli.js docs
./dist/cli.js docs core
./dist/cli.js init --help
./dist/cli.js --version
./dist/cli.js --help
```

## License

MIT

