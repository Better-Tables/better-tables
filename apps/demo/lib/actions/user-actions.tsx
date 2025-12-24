import { createActionBuilder } from '@better-tables/core';
import { Archive, Trash2 } from 'lucide-react';
import type { UserWithRelations } from '../db/schema';

/**
 * Delete action for users
 */
export const deleteUserAction = createActionBuilder<UserWithRelations>()
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
 * Archive action for users
 */
export const archiveUserAction = createActionBuilder<UserWithRelations>()
  .id('archive')
  .label('Archive Selected')
  .icon(Archive)
  .variant('secondary')
  .confirmationDialog({
    title: 'Archive Users',
    description: 'Are you sure you want to archive {count} user(s)?',
    confirmLabel: 'Archive',
    cancelLabel: 'Cancel',
    destructive: false,
  })
  .handler(async (selectedIds: string[]) => {
    const response = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: selectedIds,
        status: 'archived',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to archive users');
    }

    return response.json();
  })
  .build();

/**
 * All user actions
 */
export const userActions = [deleteUserAction, archiveUserAction];
