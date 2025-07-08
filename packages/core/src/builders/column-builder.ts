import type { ReactNode } from 'react';
import type { 
  ColumnDefinition, 
  ColumnType, 
  CellRendererProps, 
  HeaderRendererProps, 
  ValidationRule 
} from '../types/column';
import type { FilterConfig } from '../types/filter';
import type { IconComponent } from '../types/common';

/**
 * Base column builder class with fluent API
 */
export class ColumnBuilder<TData = any, TValue = any> {
  protected config: Partial<ColumnDefinition<TData, TValue>>;

  constructor(type: ColumnType) {
    this.config = {
      type,
      sortable: true,
      filterable: true,
      resizable: true,
      align: 'left',
      nullable: false,
    };
  }

  /**
   * Set the column identifier
   */
  id(id: string): this {
    this.config.id = id;
    return this;
  }

  /**
   * Set the column display name
   */
  displayName(displayName: string): this {
    this.config.displayName = displayName;
    return this;
  }

  /**
   * Set the data accessor function
   */
  accessor(accessor: (data: TData) => TValue): this {
    this.config.accessor = accessor;
    return this;
  }

  /**
   * Set the column icon
   */
  icon(icon: IconComponent): this {
    this.config.icon = icon;
    return this;
  }

  /**
   * Configure column sorting
   */
  sortable(sortable: boolean = true): this {
    this.config.sortable = sortable;
    return this;
  }

  /**
   * Configure column filtering
   */
  filterable(filterable: boolean = true, filterConfig?: FilterConfig<TValue>): this {
    this.config.filterable = filterable;
    if (filterConfig) {
      this.config.filter = filterConfig;
    }
    return this;
  }

  /**
   * Configure column resizing
   */
  resizable(resizable: boolean = true): this {
    this.config.resizable = resizable;
    return this;
  }

  /**
   * Set column width properties
   */
  width(width: number, minWidth?: number, maxWidth?: number): this {
    this.config.width = width;
    if (minWidth !== undefined) {
      this.config.minWidth = minWidth;
    }
    if (maxWidth !== undefined) {
      this.config.maxWidth = maxWidth;
    }
    return this;
  }

  /**
   * Set minimum column width
   */
  minWidth(minWidth: number): this {
    this.config.minWidth = minWidth;
    return this;
  }

  /**
   * Set maximum column width
   */
  maxWidth(maxWidth: number): this {
    this.config.maxWidth = maxWidth;
    return this;
  }

  /**
   * Set column alignment
   */
  align(align: 'left' | 'center' | 'right'): this {
    this.config.align = align;
    return this;
  }

  /**
   * Set custom cell renderer
   */
  cellRenderer(renderer: (props: CellRendererProps<TData, TValue>) => ReactNode): this {
    this.config.cellRenderer = renderer;
    return this;
  }

  /**
   * Set custom header renderer
   */
  headerRenderer(renderer: (props: HeaderRendererProps<TData>) => ReactNode): this {
    this.config.headerRenderer = renderer;
    return this;
  }

  /**
   * Add validation rules
   */
  validation(rules: ValidationRule<TValue>[]): this {
    this.config.validation = rules;
    return this;
  }

  /**
   * Set whether column supports null/undefined values
   */
  nullable(nullable: boolean = true): this {
    this.config.nullable = nullable;
    return this;
  }

  /**
   * Set column metadata
   */
  meta(meta: Record<string, any>): this {
    this.config.meta = { ...this.config.meta, ...meta };
    return this;
  }

  /**
   * Build the column definition
   */
  build(): ColumnDefinition<TData, TValue> {
    this.validateConfig();
    return this.config as ColumnDefinition<TData, TValue>;
  }

  /**
   * Validate the column configuration
   */
  protected validateConfig(): void {
    if (!this.config.id) {
      throw new Error('Column ID is required. Use .id() to set the column identifier.');
    }
    if (!this.config.displayName) {
      throw new Error('Column display name is required. Use .displayName() to set the column display name.');
    }
    if (!this.config.accessor) {
      throw new Error('Column accessor is required. Use .accessor() to set the data accessor function.');
    }
    if (!this.config.type) {
      throw new Error('Column type is required. This should be set by the specific column builder.');
    }
  }

  /**
   * Get the current configuration (for debugging)
   */
  protected getConfig(): Partial<ColumnDefinition<TData, TValue>> {
    return { ...this.config };
  }
} 