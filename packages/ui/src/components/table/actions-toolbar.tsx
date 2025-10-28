'use client';

import type { TableAction } from '@better-tables/core';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ActionConfirmationDialog } from './action-confirmation-dialog';

export interface ActionsToolbarProps<TData = unknown> {
  actions: TableAction<TData>[];
  selectedIds: string[];
  selectedData?: TData[];
  onActionMake: (actionId: string) => void;
}

/**
 * Actions toolbar component for table bulk operations.
 *
 * Displays action buttons for performing operations on selected rows.
 * Handles confirmation dialogs and loading states automatically.
 */
export function ActionsToolbar<TData = unknown>({
  actions,
  selectedIds,
  selectedData,
  onActionMake,
}: ActionsToolbarProps<TData>) {
  const [confirmationAction, setConfirmationAction] = useState<{
    action: TableAction<TData>;
    selectedIds: string[];
    selectedData?: TData[];
  } | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  if (selectedIds.length === 0) {
    return null;
  }

  // Filter actions based on visibility
  const visibleActions = actions.filter((action) => {
    if (!action.isVisible) return true;
    return action.isVisible(selectedIds, selectedData);
  });

  // Show nothing if no visible actions
  if (visibleActions.length === 0) {
    return null;
  }

  const handleActionClick = async (action: TableAction<TData>) => {
    // If action has confirmation, show dialog
    if (action.confirmationDialog) {
      setConfirmationAction({ action, selectedIds, selectedData });
      return;
    }

    // Otherwise, execute directly
    await executeAction(action, selectedIds, selectedData);
  };

  const executeAction = async (action: TableAction<TData>, ids: string[], data?: TData[]) => {
    setExecutingActionId(action.id);
    try {
      await action.handler(ids, data);
      onActionMake(action.id);
    } catch {
      // TODO: Show error toast
      // Error will be handled by caller
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirmationAction) return;
    await executeAction(
      confirmationAction.action,
      confirmationAction.selectedIds,
      confirmationAction.selectedData
    );
    setConfirmationAction(null);
  };

  const handleCancel = () => {
    setConfirmationAction(null);
  };

  const isAnyExecuting = executingActionId !== null;

  return (
    <div className="inline-flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isAnyExecuting}
            className="h-8 border-dashed"
          >
            {isAnyExecuting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="mr-1 h-4 w-4" />
            )}
            Actions ({selectedIds.length})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {visibleActions.map((action) => {
            const isEnabled = action.isEnabled ? action.isEnabled(selectedIds, selectedData) : true;

            return (
              <DropdownMenuItem
                key={action.id}
                onSelect={() => handleActionClick(action)}
                disabled={!isEnabled || isAnyExecuting}
                className={
                  action.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''
                }
              >
                {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Dialog */}
      {confirmationAction?.action.confirmationDialog && (
        <ActionConfirmationDialog
          open={!!confirmationAction}
          onOpenChange={(open) => {
            if (!open) setConfirmationAction(null);
          }}
          config={confirmationAction.action.confirmationDialog}
          selectedCount={confirmationAction.selectedIds.length}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
