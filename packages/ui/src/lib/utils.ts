import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export date utilities for convenience
export * from './date-utils';

// Re-export format utilities for convenience
export * from './format-utils';

// Re-export number input utilities for convenience (input-specific only)
export {
  getNumberInputConfig,
  parseFormattedNumber,
  validateNumberInput,
  getFormattedPlaceholder,
  getNumberInputStep,
  type NumberInputConfig
} from './number-format-utils';

// Re-export date presets for convenience
export * from './date-presets'; 