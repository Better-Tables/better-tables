import { describe, expect, it, mock } from 'bun:test';
import { BooleanColumnBuilder } from '../../src/builders/boolean-column-builder';

interface TestUser {
  id: string;
  name: string;
  isActive: boolean;
  isEnabled: boolean;
  isVerified: boolean | null;
}

describe('BooleanColumnBuilder', () => {
  describe('yesNo method', () => {
    it('should configure yes/no display with default options', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .yesNo()
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('text');
      expect((column.meta?.display as { trueText: string })?.trueText).toBe('Yes');
      expect((column.meta?.display as { falseText: string })?.falseText).toBe('No');
    });

    it('should configure yes/no with custom text', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .yesNo({
          yesText: 'Enabled',
          noText: 'Disabled',
        })
        .build();

      expect((column.meta?.display as { trueText: string })?.trueText).toBe('Enabled');
      expect((column.meta?.display as { falseText: string })?.falseText).toBe('Disabled');
    });

    it('should configure yes/no with badges', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .yesNo({
          showBadges: true,
          yesColor: 'blue',
          noColor: 'gray',
        })
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('badge');
      expect((column.meta?.display as { trueColor: string })?.trueColor).toBe('blue');
      expect((column.meta?.display as { falseColor: string })?.falseColor).toBe('gray');
    });
  });

  describe('enabledDisabled method', () => {
    it('should configure enabled/disabled display with defaults', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isEnabled')
        .displayName('Is Enabled')
        .accessor((user) => user.isEnabled)
        .enabledDisabled()
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('badge');
      expect((column.meta?.display as { trueText: string })?.trueText).toBe('Enabled');
      expect((column.meta?.display as { falseText: string })?.falseText).toBe('Disabled');
    });

    it('should configure enabled/disabled with custom text and colors', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isEnabled')
        .displayName('Is Enabled')
        .accessor((user) => user.isEnabled)
        .enabledDisabled({
          enabledText: 'On',
          disabledText: 'Off',
          enabledColor: 'success',
          disabledColor: 'error',
        })
        .build();

      expect((column.meta?.display as { trueText: string })?.trueText).toBe('On');
      expect((column.meta?.display as { falseText: string })?.falseText).toBe('Off');
      expect((column.meta?.display as { trueColor: string })?.trueColor).toBe('success');
      expect((column.meta?.display as { falseColor: string })?.falseColor).toBe('error');
    });

    it('should allow disabling badges for enabled/disabled', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isEnabled')
        .displayName('Is Enabled')
        .accessor((user) => user.isEnabled)
        .enabledDisabled({
          showBadges: false,
        })
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('text');
    });
  });

  describe('checkbox method', () => {
    it('should configure checkbox display', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .checkbox()
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('checkbox');
    });

    it('should configure interactive checkbox', () => {
      const onChange = mock();
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .checkbox({
          interactive: true,
          onChange,
        })
        .build();

      expect((column.meta?.checkbox as { interactive: boolean })?.interactive).toBe(true);
      expect((column.meta?.checkbox as { onChange: typeof onChange })?.onChange).toBe(onChange);
    });

    it('should configure checkbox with label', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .checkbox({
          showLabel: true,
          label: 'Active Status',
        })
        .build();

      expect((column.meta?.checkbox as { showLabel: boolean })?.showLabel).toBe(true);
      expect((column.meta?.checkbox as { label: string })?.label).toBe('Active Status');
    });
  });

  describe('switch method', () => {
    it('should configure switch display', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .switch()
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('switch');
    });

    it('should configure interactive switch', () => {
      const onChange = mock();
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .switch({
          interactive: true,
          onChange,
        })
        .build();

      expect((column.meta?.switch as { interactive: boolean })?.interactive).toBe(true);
      expect((column.meta?.switch as { onChange: typeof onChange })?.onChange).toBe(onChange);
    });

    it('should configure switch with size', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .switch({
          size: 'large',
        })
        .build();

      expect((column.meta?.switch as { size: string })?.size).toBe('large');
    });

    it('should configure switch with label', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .switch({
          showLabel: true,
          label: 'Toggle Status',
        })
        .build();

      expect((column.meta?.switch as { showLabel: boolean })?.showLabel).toBe(true);
      expect((column.meta?.switch as { label: string })?.label).toBe('Toggle Status');
    });
  });

  describe('iconDisplay method', () => {
    it('should configure icon display with defaults', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .iconDisplay()
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('icon');
      expect((column.meta?.iconDisplay as { trueIcon: string })?.trueIcon).toBe('check');
      expect((column.meta?.iconDisplay as { falseIcon: string })?.falseIcon).toBe('x');
      expect((column.meta?.iconDisplay as { nullIcon: string })?.nullIcon).toBe('minus');
    });

    it('should configure icon display with custom icons', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .iconDisplay({
          trueIcon: 'check-circle',
          falseIcon: 'x-circle',
          nullIcon: 'minus-circle',
        })
        .build();

      expect((column.meta?.iconDisplay as { trueIcon: string })?.trueIcon).toBe('check-circle');
      expect((column.meta?.iconDisplay as { falseIcon: string })?.falseIcon).toBe('x-circle');
      expect((column.meta?.iconDisplay as { nullIcon: string })?.nullIcon).toBe('minus-circle');
    });

    it('should configure icon display with colors and size', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .iconDisplay({
          trueColor: 'success',
          falseColor: 'danger',
          nullColor: 'muted',
          size: 'large',
        })
        .build();

      expect((column.meta?.display as { trueColor: string })?.trueColor).toBe('success');
      expect((column.meta?.display as { falseColor: string })?.falseColor).toBe('danger');
      expect((column.meta?.display as { nullColor: string })?.nullColor).toBe('muted');
      expect((column.meta?.iconDisplay as { size: string })?.size).toBe('large');
    });
  });

  describe('displayFormat method', () => {
    it('should configure all display format options', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .displayFormat({
          type: 'badge',
          trueText: 'Yes',
          falseText: 'No',
          nullText: 'N/A',
          trueColor: 'green',
          falseColor: 'red',
          nullColor: 'gray',
          showIcons: false,
        })
        .build();

      const display = column.meta?.display as {
        type: string;
        trueText: string;
        falseText: string;
        nullText: string;
        trueColor: string;
        falseColor: string;
        nullColor: string;
        showIcons: boolean;
      };

      expect(display.type).toBe('badge');
      expect(display.trueText).toBe('Yes');
      expect(display.falseText).toBe('No');
      expect(display.nullText).toBe('N/A');
      expect(display.trueColor).toBe('green');
      expect(display.falseColor).toBe('red');
      expect(display.nullColor).toBe('gray');
      expect(display.showIcons).toBe(false);
    });

    it('should support all display types', () => {
      const types = ['checkbox', 'switch', 'badge', 'icon', 'text'] as const;

      for (const type of types) {
        const builder = new BooleanColumnBuilder<TestUser>();
        const column = builder
          .id('isActive')
          .displayName('Is Active')
          .accessor((user) => user.isActive)
          .displayFormat({ type })
          .build();

        expect((column.meta?.display as { type: string })?.type).toBe(type);
      }
    });
  });

  describe('booleanOperators method', () => {
    it('should configure custom boolean operators', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .booleanOperators(['isTrue', 'isFalse'])
        .build();

      expect(column.filter?.operators).toEqual(['isTrue', 'isFalse']);
    });

    it('should allow configuring all boolean operators', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .booleanOperators(['isTrue', 'isFalse', 'isNull', 'isNotNull'])
        .build();

      expect(column.filter?.operators).toEqual(['isTrue', 'isFalse', 'isNull', 'isNotNull']);
    });
  });

  describe('booleanFilter method', () => {
    it('should configure boolean filter with options', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .booleanFilter({
          includeNull: true,
          defaultValue: false,
        })
        .build();

      expect(column.filter?.includeNull).toBe(true);
      expect(column.meta?.defaultValue).toBe(false);
    });

    it('should configure boolean filter with validation', () => {
      const validation = (value: boolean) => typeof value === 'boolean' || 'Must be boolean';
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .booleanFilter({
          validation,
        })
        .build();

      expect(column.filter?.validation).toBe(validation);
    });
  });

  describe('Method chaining', () => {
    it('should support chaining multiple methods', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .yesNo({ showBadges: true })
        .booleanFilter()
        .sortable(true)
        .filterable(true)
        .build();

      expect(column.type).toBe('boolean');
      expect((column.meta?.display as { type: string })?.type).toBe('badge');
      expect(column.sortable).toBe(true);
      expect(column.filterable).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle null values in accessor', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isVerified')
        .displayName('Is Verified')
        .accessor((user) => user.isVerified ?? false) // Handle null case
        .nullable(true)
        .booleanFilter({ includeNull: true })
        .build();

      expect(column.nullable).toBe(true);
      expect(column.filter?.includeNull).toBe(true);
      expect(column.filter?.operators).toContain('isNull');
      expect(column.filter?.operators).toContain('isNotNull');
    });

    it('should handle display format with minimal options', () => {
      const builder = new BooleanColumnBuilder<TestUser>();
      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .displayFormat({ type: 'text' })
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('text');
      expect((column.meta?.display as { trueText: string })?.trueText).toBe('Yes');
      expect((column.meta?.display as { falseText: string })?.falseText).toBe('No');
    });
  });
});
