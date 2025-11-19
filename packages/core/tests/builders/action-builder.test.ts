import { describe, expect, it, mock } from 'bun:test';
import { ActionBuilder } from '../../src/builders/action-builder';
import type { ActionEnabled, ActionHandler, ActionVisibility } from '../../src/types/action';

interface TestUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

describe('ActionBuilder', () => {
  describe('Constructor', () => {
    it('should create an action builder with default configuration', () => {
      const builder = new ActionBuilder<TestUser>();

      expect(builder).toBeDefined();
      expect(typeof builder.id).toBe('function');
      expect(typeof builder.label).toBe('function');
      expect(typeof builder.handler).toBe('function');
      expect(typeof builder.build).toBe('function');
    });
  });

  describe('id method', () => {
    it('should set the action id', () => {
      const builder = new ActionBuilder<TestUser>();
      builder.id('test-action');

      expect(builder['config'].id).toBe('test-action');
    });

    it('should return builder instance for chaining', () => {
      const builder = new ActionBuilder<TestUser>();
      const result = builder.id('test');

      expect(result).toBe(builder);
    });
  });

  describe('label method', () => {
    it('should set the action label', () => {
      const builder = new ActionBuilder<TestUser>();
      builder.label('Test Action');

      expect(builder['config'].label).toBe('Test Action');
    });

    it('should return builder instance for chaining', () => {
      const builder = new ActionBuilder<TestUser>();
      const result = builder.label('Test');

      expect(result).toBe(builder);
    });
  });

  describe('icon method', () => {
    it('should set the action icon', () => {
      const MockIcon = () => null;
      const builder = new ActionBuilder<TestUser>();
      builder.icon(MockIcon);

      expect(builder['config'].icon).toBe(MockIcon);
    });

    it('should return builder instance for chaining', () => {
      const builder = new ActionBuilder<TestUser>();
      const result = builder.icon(() => null);

      expect(result).toBe(builder);
    });
  });

  describe('variant method', () => {
    it('should set the action variant', () => {
      const builder = new ActionBuilder<TestUser>();
      builder.variant('destructive');

      expect(builder['config'].variant).toBe('destructive');
    });

    it('should support different variants', () => {
      const builder = new ActionBuilder<TestUser>();

      builder.variant('default');
      expect(builder['config'].variant).toBe('default');

      builder.variant('secondary');
      expect(builder['config'].variant).toBe('secondary');

      builder.variant('destructive');
      expect(builder['config'].variant).toBe('destructive');
    });

    it('should return builder instance for chaining', () => {
      const builder = new ActionBuilder<TestUser>();
      const result = builder.variant('default');

      expect(result).toBe(builder);
    });
  });

  describe('handler method', () => {
    it('should set the action handler', async () => {
      const handler: ActionHandler<TestUser> = async () => {
        // Handler returns void
      };
      const builder = new ActionBuilder<TestUser>();
      builder.handler(handler);

      expect(builder['config'].handler).toBe(handler);

      // Test handler is callable
      await handler(['1', '2']);
      expect(builder['config'].handler).toBe(handler);
    });

    it('should allow handler to receive selectedIds and selectedData', async () => {
      const handler = mock<ActionHandler<TestUser>>();
      const builder = new ActionBuilder<TestUser>();
      builder.handler(handler);

      const testData: TestUser[] = [
        { id: '1', name: 'John', email: 'john@test.com', isActive: true },
      ];

      await handler(['1'], testData);
      expect(handler).toHaveBeenCalledWith(['1'], testData);
    });

    it('should return builder instance for chaining', () => {
      const builder = new ActionBuilder<TestUser>();
      const result = builder.handler(async () => {});

      expect(result).toBe(builder);
    });
  });

  describe('confirmationDialog method', () => {
    it('should set the confirmation dialog configuration', () => {
      const builder = new ActionBuilder<TestUser>();
      const config = {
        title: 'Confirm Delete',
        description: 'Are you sure?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        destructive: true,
      };

      builder.confirmationDialog(config);

      expect(builder['config'].confirmationDialog).toEqual(config);
    });

    it('should return builder instance for chaining', () => {
      const builder = new ActionBuilder<TestUser>();
      const result = builder.confirmationDialog({
        title: 'Test',
        description: 'Test description',
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
        destructive: false,
      });

      expect(result).toBe(builder);
    });
  });

  describe('isVisible method', () => {
    it('should set visibility check function', () => {
      const builder = new ActionBuilder<TestUser>();
      const visibilityCheck: ActionVisibility = (_ids) => _ids.length > 0;

      builder.isVisible(visibilityCheck);

      expect(builder['config'].isVisible).toBe(visibilityCheck);
    });

    it('should support visibility check with selected data', () => {
      const builder = new ActionBuilder<TestUser>();
      const visibilityCheck: ActionVisibility<TestUser> = (_ids, data) => {
        return data?.some((user) => user.isActive) ?? false;
      };

      builder.isVisible(visibilityCheck as ActionVisibility);

      const testData: TestUser[] = [
        { id: '1', name: 'John', email: 'john@test.com', isActive: true },
      ];

      expect(visibilityCheck(['1'], testData)).toBe(true);
    });

    it('should return builder instance for chaining', () => {
      const builder = new ActionBuilder<TestUser>();
      const result = builder.isVisible(() => true);

      expect(result).toBe(builder);
    });
  });

  describe('isEnabled method', () => {
    it('should set enabled check function', () => {
      const builder = new ActionBuilder<TestUser>();
      const enabledCheck: ActionEnabled = (ids) => ids.length > 0;

      builder.isEnabled(enabledCheck);

      expect(builder['config'].isEnabled).toBe(enabledCheck);
    });

    it('should support enabled check with selected data', () => {
      const builder = new ActionBuilder<TestUser>();
      const enabledCheck: ActionEnabled<TestUser> = (_ids, data) => {
        return data?.every((user) => !user.isActive) ?? false;
      };

      builder.isEnabled(enabledCheck as ActionEnabled);

      const testData: TestUser[] = [
        { id: '1', name: 'John', email: 'john@test.com', isActive: false },
      ];

      expect(enabledCheck(['1'], testData)).toBe(true);
    });

    it('should return builder instance for chaining', () => {
      const builder = new ActionBuilder<TestUser>();
      const result = builder.isEnabled(() => true);

      expect(result).toBe(builder);
    });
  });

  describe('meta method', () => {
    it('should set action metadata', () => {
      const builder = new ActionBuilder<TestUser>();
      const meta = { requiresPermission: 'delete', logLevel: 'info' };

      builder.meta(meta);

      expect(builder['config'].meta).toEqual(meta);
    });

    it('should return builder instance for chaining', () => {
      const builder = new ActionBuilder<TestUser>();
      const result = builder.meta({ test: 'value' });

      expect(result).toBe(builder);
    });
  });

  describe('build method', () => {
    it('should build a valid action with all required fields', () => {
      const handler = async () => {};
      const action = new ActionBuilder<TestUser>()
        .id('delete')
        .label('Delete Selected')
        .handler(handler)
        .build();

      expect(action.id).toBe('delete');
      expect(action.label).toBe('Delete Selected');
      expect(action.handler).toBe(handler);
      expect(action.variant).toBe('default');
    });

    it('should include optional fields when set', () => {
      const MockIcon = () => null;
      const handler = async () => {};

      const action = new ActionBuilder<TestUser>()
        .id('delete')
        .label('Delete Selected')
        .icon(MockIcon)
        .variant('destructive')
        .handler(handler)
        .confirmationDialog({
          title: 'Confirm',
          description: 'Are you sure?',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          destructive: true,
        })
        .meta({ permission: 'admin' })
        .build();

      expect(action.id).toBe('delete');
      expect(action.label).toBe('Delete Selected');
      expect(action.icon).toBe(MockIcon);
      expect(action.variant).toBe('destructive');
      expect(action.handler).toBe(handler);
      expect(action.confirmationDialog).toEqual({
        title: 'Confirm',
        description: 'Are you sure?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        destructive: true,
      });
      expect(action.meta).toEqual({ permission: 'admin' });
    });
  });

  describe('Validation', () => {
    it('should throw error when id is missing', () => {
      const builder = new ActionBuilder<TestUser>();
      builder.label('TMock Action').handler(async () => {});

      expect(() => builder.build()).toThrow('Action ID is required');
    });

    it('should throw error when label is missing', () => {
      const builder = new ActionBuilder<TestUser>();
      builder.id('test').handler(async () => {});

      expect(() => builder.build()).toThrow('Action label is required');
    });

    it('should throw error when handler is missing', () => {
      const builder = new ActionBuilder<TestUser>();
      builder.id('test').label('Test Action');

      expect(() => builder.build()).toThrow('Action handler is required');
    });

    it('should not throw when all required fields are present', () => {
      const builder = new ActionBuilder<TestUser>();

      expect(() => {
        builder
          .id('test')
          .label('Test Action')
          .handler(async () => {})
          .build();
      }).not.toThrow();
    });
  });

  describe('Method chaining', () => {
    it('should support method chaining', () => {
      const action = new ActionBuilder<TestUser>()
        .id('archive')
        .label('Archive Selected')
        .variant('secondary')
        .handler(async () => {})
        .isVisible((ids) => ids.length > 0)
        .isEnabled((_ids, data) => (data?.length ?? 0) > 0)
        .meta({ type: 'archive' })
        .build();

      expect(action.id).toBe('archive');
      expect(action.label).toBe('Archive Selected');
      expect(action.variant).toBe('secondary');
      expect(action.isVisible).toBeDefined();
      expect(action.isEnabled).toBeDefined();
      expect(action.meta).toEqual({ type: 'archive' });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string as id', () => {
      const builder = new ActionBuilder<TestUser>();
      builder
        .id('')
        .label('Test')
        .handler(async () => {});

      expect(() => builder.build()).toThrow('Action ID is required');
    });

    it('should handle empty string as label', () => {
      const builder = new ActionBuilder<TestUser>();
      builder
        .id('test')
        .label('')
        .handler(async () => {});

      expect(() => builder.build()).toThrow('Action label is required');
    });

    it('should handle async handler that returns void', async () => {
      const builder = new ActionBuilder<TestUser>();
      const action = builder
        .id('test')
        .label('Test')
        .handler(async () => {})
        .build();

      await expect(action.handler(['1'])).resolves.toBeUndefined();
    });

    it('should handle handler that throws errors', async () => {
      const builder = new ActionBuilder<TestUser>();
      const action = builder
        .id('test')
        .label('Test')
        .handler(async () => {
          throw new Error('Handler failed');
        })
        .build();

      await expect(action.handler(['1'])).rejects.toThrow('Handler failed');
    });
  });
});
