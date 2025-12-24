import * as readline from 'node:readline';

/**
 * Create a readline interface for user prompts
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a yes/no confirmation question
 */
export async function confirm(message: string, defaultValue = true): Promise<boolean> {
  const rl = createInterface();
  const defaultHint = defaultValue ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`${message} (${defaultHint}): `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '') {
        resolve(defaultValue);
      } else {
        resolve(trimmed === 'y' || trimmed === 'yes');
      }
    });
  });
}

/**
 * Ask for text input
 */
export async function input(message: string, defaultValue?: string): Promise<string> {
  const rl = createInterface();
  const prompt = defaultValue ? `${message} (${defaultValue}): ` : `${message}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue || '');
    });
  });
}

/**
 * Ask user to select from a list of options
 */
export async function select<T extends string>(
  _message: string,
  options: { label: string; value: T }[]
): Promise<T> {
  if (options.length === 0) {
    throw new Error('select() requires at least one option');
  }
  const rl = createInterface();
  options.forEach((_option, _index) => {});
  return new Promise((resolve) => {
    rl.question('\nEnter your choice (number): ', (answer) => {
      rl.close();
      const index = parseInt(answer.trim(), 10) - 1;
      if (index >= 0 && index < options.length && options[index]) {
        resolve(options[index].value);
      } else {
        // Default to first option if invalid input
        resolve(options[0].value);
      }
    });
  });
}

/**
 * File conflict resolution options
 */
export type ConflictResolution = 'overwrite' | 'skip' | 'overwrite-all' | 'skip-all';

/**
 * Ask user how to handle a file conflict
 */
export async function resolveFileConflict(filePath: string): Promise<ConflictResolution> {
  return select<ConflictResolution>(`File already exists: ${filePath}`, [
    { label: 'Overwrite this file', value: 'overwrite' },
    { label: 'Skip this file', value: 'skip' },
    { label: 'Overwrite all existing files', value: 'overwrite-all' },
    { label: 'Skip all existing files', value: 'skip-all' },
  ]);
}
