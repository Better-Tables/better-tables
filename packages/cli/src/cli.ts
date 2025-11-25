import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { commandsRegistry, type RegisteredCommandName } from './commands';
import { docsCommand } from './commands/docs';
import { helpCommand } from './commands/help';
import { createCommand, registerCommandFactory } from './lib/command-factory';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const program = new Command();

program
  .name('better-tables')
  .description('Command-line utilities for Better Tables')
  .version(packageJson.version);

// Register all command factories
// This ensures type safety - only commands in commandsRegistry can be registered
registerCommandFactory('help', helpCommand);
registerCommandFactory('docs', docsCommand);

// Add all registered commands to the program
// TypeScript ensures we can only reference commands that exist in the registry
const registeredCommandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

for (const commandName of registeredCommandNames) {
  const command = createCommand(commandName);
  program.addCommand(command);
}

program.parse();
