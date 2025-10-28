'use client';

import type { ActionConfirmationConfig } from '@better-tables/core';
import { AlertTriangle } from 'lucide-react';
import { useId } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        showCloseButton={false}
        aria-describedby={descriptionId}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            {config.destructive && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            )}
            <DialogTitle className="text-left">{config.title}</DialogTitle>
          </div>
          <DialogDescription id={descriptionId} className="text-left">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            {config.cancelLabel || 'Cancel'}
          </Button>
          <Button
            type="button"
            variant={config.destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            className="w-full sm:w-auto"
          >
            {config.confirmLabel || 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
