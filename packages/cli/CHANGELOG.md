# @better-tables/cli

## 0.1.5

### Patch Changes

- This update modifies the `installPackage` function to utilize `npx` for executing `pnpm` and `yarn`, ensuring that these package managers are found even when not in the user's PATH. Additionally, the tests have been updated to reflect these changes, confirming that the correct commands are called with the appropriate arguments and environment settings.

## 0.1.4

### Patch Changes

- This update introduces a new `--components-path` flag for the CLI, allowing users to specify the output path for components relative to the components directory. Additionally, the initialization command now detects if the project is a Next.js application and checks for required dependencies, prompting the user to install any missing packages. The file operations have been updated to accommodate the new components path in file mappings and import transformations.

## 0.1.3

### Patch Changes

- Introduce a new 'init' command to the CLI, allowing users to initialize Better Tables in their projects. The command checks for shadcn setup, installs missing components, and copies necessary files with appropriate import transformations. Additionally, it includes a configuration file reader and file operation utilities to streamline the setup process.

## 0.1.2

### Patch Changes

- update CLI package to use .mjs and .cjs extensions

## 0.1.1

### Patch Changes

- Initialized CLI package for better-tables
