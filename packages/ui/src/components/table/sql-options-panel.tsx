'use client';

/**
 * @fileoverview SQL options panel for configuring SQL export settings.
 *
 * @module components/table/sql-options-panel
 */

import type { SqlDialect, SqlExportOptions } from '@better-tables/core';
import * as React from 'react';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

/**
 * Props for the SqlOptionsPanel component.
 */
export interface SqlOptionsPanelProps {
  /** Current SQL options */
  options: SqlExportOptions;

  /** Detected dialect from adapter */
  detectedDialect?: SqlDialect;

  /** Callback when options change */
  onOptionsChange: (options: SqlExportOptions) => void;
}

/**
 * SQL options panel component for configuring SQL export settings.
 */
export function SqlOptionsPanel({
  options,
  detectedDialect,
  onOptionsChange,
}: SqlOptionsPanelProps): React.ReactElement {
  const updateOption = React.useCallback(
    <K extends keyof SqlExportOptions>(key: K, value: SqlExportOptions[K]) => {
      onOptionsChange({ ...options, [key]: value });
    },
    [options, onOptionsChange]
  );

  const currentDialect = options.dialect || detectedDialect || 'postgres';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>SQL Dialect</Label>
        <Select
          value={currentDialect}
          onValueChange={(value) => updateOption('dialect', value as SqlDialect)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="postgres">PostgreSQL</SelectItem>
            <SelectItem value="mysql">MySQL</SelectItem>
            <SelectItem value="sqlite">SQLite</SelectItem>
          </SelectContent>
        </Select>
        {detectedDialect && !options.dialect && (
          <p className="text-xs text-muted-foreground">
            Auto-detected from adapter: {detectedDialect}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <Label>Export Options</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeStructure"
              checked={options.includeStructure ?? true}
              onCheckedChange={(checked) => updateOption('includeStructure', !!checked)}
            />
            <Label htmlFor="includeStructure" className="cursor-pointer">
              Structure (CREATE TABLE statements)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeDrop"
              checked={options.includeDrop ?? false}
              onCheckedChange={(checked) => updateOption('includeDrop', !!checked)}
            />
            <Label htmlFor="includeDrop" className="cursor-pointer">
              DROP TABLE IF EXISTS
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeData"
              checked={options.includeData ?? true}
              onCheckedChange={(checked) => updateOption('includeData', !!checked)}
            />
            <Label htmlFor="includeData" className="cursor-pointer">
              Data (INSERT statements)
            </Label>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="compressGzip"
          checked={options.compressWithGzip ?? false}
          onCheckedChange={(checked) => updateOption('compressWithGzip', !!checked)}
        />
        <Label htmlFor="compressGzip" className="cursor-pointer">
          Compress using gzip
        </Label>
      </div>
    </div>
  );
}
