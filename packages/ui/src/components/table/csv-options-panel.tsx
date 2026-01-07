'use client';

/**
 * @fileoverview CSV options panel for configuring CSV export settings.
 *
 * @module components/table/csv-options-panel
 */

import type { CsvExportOptions } from '@better-tables/core';
import * as React from 'react';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

/**
 * Props for the CsvOptionsPanel component.
 */
export interface CsvOptionsPanelProps {
  /** Current CSV options */
  options: CsvExportOptions;

  /** Callback when options change */
  onOptionsChange: (options: CsvExportOptions) => void;
}

/**
 * CSV options panel component for configuring CSV export settings.
 */
export function CsvOptionsPanel({
  options,
  onOptionsChange,
}: CsvOptionsPanelProps): React.ReactElement {
  const updateOption = React.useCallback(
    <K extends keyof CsvExportOptions>(key: K, value: CsvExportOptions[K]) => {
      onOptionsChange({ ...options, [key]: value });
    },
    [options, onOptionsChange]
  );

  const [customDelimiter, setCustomDelimiter] = React.useState(
    options.delimiter && !['', ',', ';', '\t'].includes(options.delimiter) ? options.delimiter : ''
  );

  const handleDelimiterChange = React.useCallback(
    (value: string) => {
      if (value === 'custom') {
        setCustomDelimiter(options.delimiter || ',');
        updateOption('delimiter', customDelimiter || ',');
      } else {
        setCustomDelimiter('');
        const delimiterMap: Record<string, string> = {
          comma: ',',
          semicolon: ';',
          tab: '\t',
        };
        updateOption('delimiter', delimiterMap[value] || ',');
      }
    },
    [options.delimiter, customDelimiter, updateOption]
  );

  const handleCustomDelimiterChange = React.useCallback(
    (value: string) => {
      setCustomDelimiter(value);
      updateOption('delimiter', value);
    },
    [updateOption]
  );

  const currentDelimiterType =
    options.delimiter === ','
      ? 'comma'
      : options.delimiter === ';'
        ? 'semicolon'
        : options.delimiter === '\t'
          ? 'tab'
          : 'custom';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>NULL Handling</Label>
        <Select
          value={options.nullValue === 'NULL' ? 'NULL' : 'EMPTY'}
          onValueChange={(value) => updateOption('nullValue', value === 'NULL' ? 'NULL' : '')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NULL">NULL</SelectItem>
            <SelectItem value="EMPTY">EMPTY</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="convertLineBreaks"
          checked={options.convertLineBreaksToSpace ?? false}
          onCheckedChange={(checked) => updateOption('convertLineBreaksToSpace', !!checked)}
        />
        <Label htmlFor="convertLineBreaks" className="cursor-pointer">
          Convert line breaks to space
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="includeHeaders"
          checked={options.includeHeaders ?? true}
          onCheckedChange={(checked) => updateOption('includeHeaders', !!checked)}
        />
        <Label htmlFor="includeHeaders" className="cursor-pointer">
          Put field names in the first row (header)
        </Label>
      </div>

      <div className="space-y-2">
        <Label>Delimiter</Label>
        <Select value={currentDelimiterType} onValueChange={handleDelimiterChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comma">Comma (,)</SelectItem>
            <SelectItem value="semicolon">Semicolon (;)</SelectItem>
            <SelectItem value="tab">Tab</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {currentDelimiterType === 'custom' && (
          <Input
            value={customDelimiter}
            onChange={(e) => handleCustomDelimiterChange(e.target.value)}
            placeholder="Enter custom delimiter"
            maxLength={1}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Quote Style</Label>
        <Select
          value={options.quoteStyle || 'quote-if-needed'}
          onValueChange={(value) =>
            updateOption('quoteStyle', value as CsvExportOptions['quoteStyle'])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="quote-if-needed">Quote if needed</SelectItem>
            <SelectItem value="double-quote">Double quote (&quot;)</SelectItem>
            <SelectItem value="single-quote">Single quote (')</SelectItem>
            <SelectItem value="space">Space</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Line Break</Label>
        <Select
          value={options.lineEnding || '\r\n'}
          onValueChange={(value) => updateOption('lineEnding', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="\n">\n (LF)</SelectItem>
            <SelectItem value="\r\n">\r\n (CRLF)</SelectItem>
            <SelectItem value="\r">\r (CR)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Decimal Separator</Label>
        <Select
          value={options.decimalSeparator || '.'}
          onValueChange={(value) => updateOption('decimalSeparator', value as '.' | ',')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=".">Period (.)</SelectItem>
            <SelectItem value=",">Comma (,)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
