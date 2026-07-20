import { createActionBuilder } from '@better-tables/core';
import { Archive, Trash2 } from 'lucide-react';
import type { UserRow } from '@/lib/demo/users/columns';

/**
 * Delete action for users
 */
export const deleteUserAction = createActionBuilder<UserRow>()
  .id('delete')
  .label('Delete Selected')
  .icon(Trash2)
  .variant('destructive')
  .confirmationDialog({
    title: 'Delete Users',
    description: 'Are you sure you want to delete {count} user(s)? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    destructive: true,
  })
  .handler(async (selectedIds: string[]) => {
    const response = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    });

    if (!response.ok) {
      throw new Error('Failed to delete users');
    }

    // Return the response to trigger revalidation
    return response.json();
  })
  .build();

/**
 * Suspend action for users — sets the (real) `suspended` status so the
 * change is visible in the status column and filterable afterwards.
 */
export const suspendUserAction = createActionBuilder<UserRow>()
  .id('suspend')
  .label('Suspend Selected')
  .icon(Archive)
  .variant('secondary')
  .confirmationDialog({
    title: 'Suspend Users',
    description: 'Set {count} user(s) to suspended?',
    confirmLabel: 'Suspend',
    cancelLabel: 'Cancel',
    destructive: false,
  })
  .handler(async (selectedIds: string[]) => {
    const response = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: selectedIds,
        status: 'suspended',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to suspend users');
    }

    return response.json();
  })
  .build();

/**
 * All user actions
 */
export const userActions = [deleteUserAction, suspendUserAction];
