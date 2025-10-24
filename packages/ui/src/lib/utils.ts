import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export date presets for convenience
export * from './date-presets';
// Re-export date utilities for convenience
export * from './date-utils';
// Re-export format utilities for convenience
export * from './format-utils';
// Re-export number input utilities for convenience (input-specific only)
export {
  getFormattedPlaceholder,
  getNumberInputConfig,
  getNumberInputStep,
  type NumberInputConfig,
  parseFormattedNumber,
  validateNumberInput,
} from './number-format-utils';
