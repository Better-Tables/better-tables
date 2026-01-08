'use client';

/**
 * @fileoverview ERD (Entity Relationship Diagram) dialog component for visualizing database schema.
 *
 * @module components/table/erd-dialog
 */

import type { SchemaInfo } from '@better-tables/core';
import {
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  ReactFlow,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Database, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

/**
 * Props for the ERDDialog component.
 */
export interface ERDDialogProps {
  /** Schema information */
  schemaInfo?: SchemaInfo;

  /** Whether dialog is open (for standalone dialog mode) */
  open?: boolean;

  /** Callback when dialog open state changes (for standalone dialog mode) */
  onOpenChange?: (open: boolean) => void;

  /** Selected table names */
  selectedTables?: string[];

  /** Callback when a table is toggled */
  onTableToggle?: (tableName: string) => void;
}

/**
 * ERD Dialog component that visualizes database schema as an entity relationship diagram.
 */
export function ERDDialog({
  schemaInfo,
  open: controlledOpen,
  onOpenChange,
  selectedTables = [],
  onTableToggle,
}: ERDDialogProps): React.ReactElement {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<ReactFlowInstance | null>(null);

  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  // Generate nodes and edges from schema info
  React.useEffect(() => {
    // In inline mode (no onOpenChange), always render if schemaInfo exists
    // In dialog mode, only render if open
    const shouldRender = onOpenChange === undefined ? !!schemaInfo : !!schemaInfo && isOpen;

    if (!shouldRender || !schemaInfo) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const tablePositions = new Map<string, { x: number; y: number }>();

    // Calculate layout (simple grid layout)
    const tablesPerRow = Math.ceil(Math.sqrt(schemaInfo.tables.length));
    let row = 0;
    let col = 0;
    const nodeWidth = 250;
    const nodeHeight = 150;
    const horizontalSpacing = 300;
    const verticalSpacing = 200;

    // Create nodes for each table
    for (const table of schemaInfo.tables) {
      const x = col * horizontalSpacing + 100;
      const y = row * verticalSpacing + 100;
      tablePositions.set(table.name, { x, y });

      // Check if table is selected
      const isSelected = selectedTables.includes(table.name);
      const primaryKeys = table.columns.filter((col) => col.isPrimaryKey);
      const foreignKeys = table.columns.filter((col) => col.isForeignKey);

      // Create node for table
      const node: Node = {
        id: table.name,
        type: 'default',
        position: { x, y },
        data: {
          label: (
            <div
              className={`p-3 transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
            >
              <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Database className="h-4 w-4" />
                {table.name}
                {isSelected && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                    Selected
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs">
                {/* Primary Keys Section */}
                {primaryKeys.length > 0 && (
                  <div className="mb-2 pb-2 border-b border-primary/20">
                    <div className="text-primary font-semibold mb-1 text-[10px] uppercase">
                      Primary Keys
                    </div>
                    {primaryKeys.map((column) => (
                      <div
                        key={column.name}
                        className="flex items-center gap-2 text-primary font-medium"
                      >
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span>
                          {column.name}
                          {column.nullable && '?'}
                        </span>
                        <span className="text-muted-foreground ml-auto text-[10px]">
                          {column.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Foreign Keys Section */}
                {foreignKeys.length > 0 && (
                  <div className="mb-2 pb-2 border-b border-blue-500/20">
                    <div className="text-blue-600 font-semibold mb-1 text-[10px] uppercase">
                      Foreign Keys
                    </div>
                    {foreignKeys.map((column) => (
                      <div key={column.name} className="flex items-center gap-2 text-blue-600">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span>
                          {column.name}
                          {column.nullable && '?'}
                        </span>
                        <span className="text-muted-foreground ml-auto text-[10px]">
                          {column.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Other Columns */}
                {table.columns
                  .filter((col) => !col.isPrimaryKey && !col.isForeignKey)
                  .map((column) => (
                    <div
                      key={column.name}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                      <span>
                        {column.name}
                        {column.nullable && '?'}
                      </span>
                      <span className="text-muted-foreground ml-auto text-[10px]">
                        {column.type}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ),
        },
        style: {
          width: nodeWidth,
          minHeight: nodeHeight,
          background: isSelected ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--card))',
          border: isSelected ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
          borderRadius: '8px',
          boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
        },
      };

      newNodes.push(node);

      // Create edges for foreign keys - connect FK to PK
      for (const fkColumn of foreignKeys) {
        // Try multiple strategies to find the target table
        let targetTable: (typeof schemaInfo.tables)[0] | undefined;

        // Strategy 1: Try to infer from column name patterns
        // Pattern: userId -> users, profileId -> profiles, user_id -> users
        const possibleTargetTable = fkColumn.name
          .replace(/Id$|_id$/i, '')
          .replace(/_/g, ' ')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('');

        // Try exact match first
        targetTable = schemaInfo.tables.find(
          (t) => t.name.toLowerCase() === possibleTargetTable.toLowerCase()
        );

        // Try pluralized versions
        if (!targetTable) {
          targetTable = schemaInfo.tables.find((t) => {
            const tableNameLower = t.name.toLowerCase();
            const possibleLower = possibleTargetTable.toLowerCase();
            return (
              tableNameLower === `${possibleLower}s` ||
              tableNameLower === `${possibleLower}es` ||
              tableNameLower.startsWith(possibleLower)
            );
          });
        }

        // Strategy 2: Try to find table with matching primary key name
        // If FK is "userId", look for table with PK "id" in a table named like "user"
        if (!targetTable) {
          const pkName = fkColumn.name.replace(/.*_/, '').replace(/Id$/i, 'id');
          targetTable = schemaInfo.tables.find((t) => {
            const hasMatchingPK = t.columns.some(
              (col) => col.isPrimaryKey && col.name.toLowerCase() === pkName.toLowerCase()
            );
            return hasMatchingPK && t.name !== table.name;
          });
        }

        // If we found a target table, create the edge
        if (targetTable && targetTable.name !== table.name) {
          // Check if edge already exists (avoid duplicates)
          const edgeId = `${table.name}-${fkColumn.name}-${targetTable.name}`;
          if (!newEdges.find((e) => e.id === edgeId)) {
            // Find the primary key in target table that this FK references
            const targetPK = targetTable.columns.find((col) => col.isPrimaryKey);
            const edgeLabel = targetPK ? `${fkColumn.name} → ${targetPK.name}` : fkColumn.name;

            const edge: Edge = {
              id: edgeId,
              source: table.name,
              target: targetTable.name,
              sourceHandle: `fk-${fkColumn.name}`,
              targetHandle: targetPK ? `pk-${targetPK.name}` : undefined,
              type: 'smoothstep',
              animated: false,
              style: {
                stroke: 'hsl(var(--primary))',
                strokeWidth: 2,
                strokeDasharray: '5,5',
              },
              label: edgeLabel,
              labelStyle: {
                fill: 'hsl(var(--foreground))',
                fontSize: 10,
                fontWeight: 500,
                background: 'hsl(var(--card))',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid hsl(var(--border))',
              },
              labelBgStyle: {
                fill: 'hsl(var(--card))',
                fillOpacity: 0.95,
              },
              markerEnd: {
                type: 'arrowclosed',
                color: 'hsl(var(--primary))',
                width: 20,
                height: 20,
              },
              className: 'erd-edge',
            };
            newEdges.push(edge);
          }
        }
      }

      // Update grid position
      col++;
      if (col >= tablesPerRow) {
        col = 0;
        row++;
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [schemaInfo, isOpen, selectedTables, onTableToggle, onOpenChange]);

  // If used as embedded component (no onOpenChange means inline mode), render without Dialog wrapper
  if (onOpenChange === undefined) {
    // If no schema info, show empty state
    if (!schemaInfo) {
      return (
        <div className="flex-1 min-h-0 relative w-full h-full flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Database className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Schema information is required to display the ERD.</p>
          </div>
        </div>
      );
    }
    // Embedded/inline mode - render just the ReactFlow content
    return (
      <div className="flex-1 min-h-0 relative w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          minZoom={0.1}
          maxZoom={2}
          onlyRenderVisibleElements={nodes.length > 20}
          preventScrolling={true}
          attributionPosition="bottom-left"
          onInit={setReactFlowInstance}
          onNodeClick={(_event, node) => {
            onTableToggle?.(node.id);
          }}
          onNodeDoubleClick={(_event, node) => {
            // Fit view to selected node on double-click
            reactFlowInstance?.fitView({
              nodes: [node],
              padding: 0.3,
              maxZoom: 1.5,
            });
          }}
          onNodesChange={(changes: NodeChange[]) => {
            // Update node positions when dragged
            setNodes((nds) => applyNodeChanges(changes, nds));
          }}
          onPaneClick={() => {
            // Optional: Deselect all on pane click
          }}
        >
          <Background gap={12} size={1} color="hsl(var(--muted))" />
          <Controls
            showZoom={true}
            showFitView={true}
            showInteractive={true}
            position="top-right"
          />
        </ReactFlow>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Entity Relationship Diagram</DialogTitle>
              <DialogDescription>Visual representation of your database schema</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 relative" style={{ height: 'calc(95vh - 120px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            minZoom={0.1}
            maxZoom={2}
            onlyRenderVisibleElements={nodes.length > 20}
            preventScrolling={true}
            attributionPosition="bottom-left"
            onInit={setReactFlowInstance}
            onNodeClick={(_event, node) => {
              onTableToggle?.(node.id);
            }}
            onNodeDoubleClick={(_event, node) => {
              // Fit view to selected node on double-click
              reactFlowInstance?.fitView({
                nodes: [node],
                padding: 0.3,
                maxZoom: 1.5,
              });
            }}
          >
            <Background gap={12} size={1} color="hsl(var(--muted))" />
            <Controls
              showZoom={true}
              showFitView={true}
              showInteractive={true}
              position="top-right"
            />
          </ReactFlow>
        </div>
      </DialogContent>
    </Dialog>
  );
}
