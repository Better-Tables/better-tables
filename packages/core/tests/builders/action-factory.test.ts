import { describe, expect, it, vi } from 'vitest';
import { ActionBuilder } from '../../src/builders/action-builder';
import {
  createActionBuilder,
  createActionBuilders,
  deleteAction,
} from '../../src/builders/action-factory';
import type { ActionHandler } from '../../src/types/action';
import type { IconComponent } from '../../src/types/common';

interface TestUser {
  id: string;
  name: string;
  email: string;
}

describe('Action Factory', () => {
  describe('createActionBuilder', () => {
    it('should create a new action builder instance', () => {
      const builder = createActionBuilder<TestUser>();

      expect(builder).toBeDefined();
      expect(builder).toBeInstanceOf(ActionBuilder);
      expect(typeof builder.id).toBe('function');
      expect(typeof builder.label).toBe('function');
      expect(typeof builder.build).toBe('function');
    });

    it('should create type-safe builder with proper inference', () => {
      const builder = createActionBuilder<TestUser>();

      // TypeScript should infer TestUser type in handler
      const action = builder
        .id('test')
        .label('Test Action')
        .handler(async (ids, _data) => {
          // data should be typed as TestUser[] | undefined
          return ids.map((id) => id);
        })
        .build();

      expect(action.id).toBe('test');
      expect(action.label).toBe('Test Action');
    });

    it('should allow building complete actions', () => {
      const MockIcon: IconComponent = () => null;
      const handler: ActionHandler<TestUser> = async () => {};

      const action = createActionBuilder<TestUser>()
        .id('delete')
        .label('Delete Users')
        .icon(MockIcon)
        .variant('destructive')
        .handler(handler)
        .confirmationDialog({
          title: 'Confirm Delete',
          description: 'Are you sure?',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          destructive: true,
        })
        .build();

      expect(action.id).toBe('delete');
      expect(action.label).toBe('Delete Users');
      expect(action.icon).toBe(MockIcon);
      expect(action.variant).toBe('destructive');
      expect(action.handler).toBe(handler);
    });
  });

  describe('deleteAction', () => {
    it('should create a delete action with default configuration', () => {
      const handler: ActionHandler<TestUser> = async (ids) => ids;

      const action = deleteAction({
        handler,
      });

      expect(action.id).toBe('delete');
      expect(action.label).toBe('Delete Selected');
      expect(action.variant).toBe('destructive');
      expect(action.handler).toBe(handler);
      expect(action.confirmationDialog).toBeDefined();
      expect(action.confirmationDialog?.title).toBe('Delete Selected');
      expect(action.confirmationDialog?.destructive).toBe(true);
    });

    it('should create a delete action with custom label', () => {
      const handler: ActionHandler<TestUser> = async (ids) => ids;

      const action = deleteAction({
        label: 'Remove Users',
        handler,
      });

      expect(action.label).toBe('Remove Users');
      expect(action.id).toBe('delete');
      expect(action.variant).toBe('destructive');
    });

    it('should create a delete action with custom icon', () => {
      const MockIcon: IconComponent = () => null;
      const handler: ActionHandler<TestUser> = async (ids) => ids;

      const action = deleteAction({
        icon: MockIcon,
        handler,
      });

      expect(action.icon).toBe(MockIcon);
      expect(action.id).toBe('delete');
    });

    it('should create a delete action with custom confirmation', () => {
      const handler: ActionHandler<TestUser> = async (ids) => ids;

      const action = deleteAction({
        handler,
        confirmation: {
          title: 'Custom Delete Title',
          description: 'Custom description',
          confirmLabel: 'Confirm',
        },
      });

      expect(action.confirmationDialog?.title).toBe('Custom Delete Title');
      expect(action.confirmationDialog?.description).toBe('Custom description');
      expect(action.confirmationDialog?.confirmLabel).toBe('Confirm');
      expect(action.confirmationDialog?.cancelLabel).toBe('Cancel');
      expect(action.confirmationDialog?.destructive).toBe(true);
    });

    it('should create a delete action without custom confirmation', () => {
      const handler: ActionHandler<TestUser> = async (ids) => ids;

      const action = deleteAction({
        handler,
      });

      // Should still have default confirmation
      expect(action.confirmationDialog).toBeDefined();
      expect(action.confirmationDialog?.title).toBe('Delete Selected');
      expect(action.confirmationDialog?.description).toContain('cannot be undone');
    });

    it('should set handler function', async () => {
      const mockHandler = vi.fn<ActionHandler<TestUser>>();

      const action = deleteAction({
        handler: mockHandler,
      });

      const testIds = ['1', '2', '3'];
      await action.handler(testIds);

      expect(mockHandler).toHaveBeenCalledWith(testIds);
    });

    it('should be type-safe with data parameter', async () => {
      const handler: ActionHandler<TestUser> = async (_ids, _data) => {
        // data should be typed as TestUser[] | undefined
        // Handler receives typed data but doesn't return it
      };

      const action = deleteAction({ handler });

      const testData: TestUser[] = [{ id: '1', name: 'John', email: 'john@test.com' }];

      const result = await action.handler(['1'], testData);
      expect(result).toBeUndefined();
    });
  });

  describe('createActionBuilders', () => {
    it('should create multiple action builders', () => {
      const builders = createActionBuilders<TestUser>(3);

      expect(builders).toHaveLength(3);
      expect(builders[0]).toBeInstanceOf(ActionBuilder);
      expect(builders[1]).toBeInstanceOf(ActionBuilder);
      expect(builders[2]).toBeInstanceOf(ActionBuilder);
    });

    it('should create independent builder instances', () => {
      const builders = createActionBuilders<TestUser>(2);

      const action1 = builders[0]
        .id('action1')
        .label('Action 1')
        .handler(async () => {})
        .build();
      const action2 = builders[1]
        .id('action2')
        .label('Action 2')
        .handler(async () => {})
        .build();

      expect(action1.id).toBe('action1');
      expect(action2.id).toBe('action2');
      expect(action1).not.toBe(action2);
    });

    it('should create type-safe builders', () => {
      const builders = createActionBuilders<TestUser>(2);

      const [deleteBuilder, archiveBuilder] = builders;

      const deleteAction = deleteBuilder
        .id('delete')
        .label('Delete')
        .handler(async (_ids, _data) => {
          // TypeScript should infer TestUser[] | undefined
          // Handler should not return a value
        })
        .build();

      const archiveAction = archiveBuilder
        .id('archive')
        .label('Archive')
        .handler(async () => {})
        .build();

      expect(deleteAction.id).toBe('delete');
      expect(archiveAction.id).toBe('archive');
    });

    it('should handle zero count', () => {
      const builders = createActionBuilders<TestUser>(0);

      expect(builders).toHaveLength(0);
      expect(builders).toEqual([]);
    });

    it('should allow building multiple actions', () => {
      const handlers: ActionHandler<TestUser>[] = [async () => {}, async () => {}, async () => {}];

      const builders = createActionBuilders<TestUser>(3);

      const actions = builders.map((builder, index) => {
        return builder
          .id(`action${index}`)
          .label(`Action ${index}`)
          .handler(handlers[index])
          .build();
      });

      expect(actions).toHaveLength(3);
      expect(actions[0].id).toBe('action0');
      expect(actions[1].id).toBe('action1');
      expect(actions[2].id).toBe('action2');
    });
  });

  describe('Edge cases', () => {
    it('should handle handlers that return void', async () => {
      const builder = createActionBuilder<TestUser>();
      const action = builder
        .id('test')
        .label('Test')
        .handler(async () => {})
        .build();

      const result = await action.handler(['1', '2', '3']);
      expect(result).toBeUndefined();
    });

    it('should handle handlers that throw errors', async () => {
      const builder = createActionBuilder<TestUser>();
      const action = builder
        .id('test')
        .label('Test')
        .handler(async () => {
          throw new Error('Handler error');
        })
        .build();

      await expect(action.handler(['1'])).rejects.toThrow('Handler error');
    });

    it('should work with undefined handler data', async () => {
      const handler: ActionHandler<TestUser> = async () => {};

      const action = createActionBuilder<TestUser>()
        .id('test')
        .label('Test')
        .handler(handler)
        .build();

      const result = await action.handler(['1']);
      expect(result).toBeUndefined();
    });
  });
});
