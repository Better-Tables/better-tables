'use client';

import type { ActionConfirmationConfig } from '@better-tables/core';
import { CircleAlertIcon } from 'lucide-react';
import { useId } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

export interface ActionConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ActionConfirmationConfig;
  selectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog for table actions.
 *
 * Displays a confirmation dialog before executing potentially destructive actions.
 * Supports customizable title, description, and button labels.
 */
export function ActionConfirmationDialog({
  open,
  onOpenChange,
  config,
  selectedCount,
  onConfirm,
  onCancel,
}: ActionConfirmationDialogProps) {
  const descriptionId = useId();

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  // Replace {count} placeholder in description
  const description = config.description.replace('{count}', selectedCount.toString());

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]" aria-describedby={descriptionId}>
        <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
          {config.destructive && (
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-destructive/10"
              aria-hidden="true"
            >
              <CircleAlertIcon className="opacity-80 text-destructive" size={16} />
            </div>
          )}
          <AlertDialogHeader>
            <AlertDialogTitle>{config.title}</AlertDialogTitle>
            <AlertDialogDescription id={descriptionId}>{description}</AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {config.cancelLabel || 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={
              config.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {config.confirmLabel || 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
