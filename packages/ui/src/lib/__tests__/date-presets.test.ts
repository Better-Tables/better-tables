import { describe, expect, it } from 'vitest';
import type { DatePreset } from '../date-presets';
import {
  createCustomPreset,
  DEFAULT_DATE_PRESETS,
  getGroupedPresets,
  getPresetById,
} from '../date-presets';

describe('date-presets', () => {
  describe('getGroupedPresets', () => {
    it('should group presets by category', () => {
      const presets: DatePreset[] = [
        {
          id: 'today',
          label: 'Today',
          category: 'relative',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
        {
          id: 'yesterday',
          label: 'Yesterday',
          category: 'absolute',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
        {
          id: 'last-week',
          label: 'Last Week',
          category: 'relative',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
        {
          id: 'custom',
          label: 'Custom',
          category: 'custom',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
      ];

      const grouped = getGroupedPresets(presets);

      expect(grouped.relative).toHaveLength(2);
      expect(grouped.absolute).toHaveLength(1);
      expect(grouped.custom).toHaveLength(1);
      expect(grouped.relative?.[0].id).toBe('today');
      expect(grouped.relative?.[1].id).toBe('last-week');
      expect(grouped.absolute?.[0].id).toBe('yesterday');
      expect(grouped.custom?.[0].id).toBe('custom');
    });

    it('should use default category for presets without category', () => {
      const presets: DatePreset[] = [
        {
          id: 'no-category',
          label: 'No Category',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
      ];

      const grouped = getGroupedPresets(presets);

      expect(grouped.relative).toHaveLength(1);
      expect(grouped.relative?.[0].id).toBe('no-category');
    });

    it('should use default presets when none provided', () => {
      const grouped = getGroupedPresets();

      expect(Object.keys(grouped).length).toBeGreaterThan(0);
      expect(grouped.relative).toBeDefined();
      expect(grouped.relative).toHaveLength(DEFAULT_DATE_PRESETS.length);
    });

    it('should handle empty presets array', () => {
      const grouped = getGroupedPresets([]);

      expect(Object.keys(grouped).length).toBe(0);
    });

    it('should handle presets with mixed categories', () => {
      const presets: DatePreset[] = [
        {
          id: 'preset1',
          label: 'Preset 1',
          category: 'relative',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
        {
          id: 'preset2',
          label: 'Preset 2',
          category: 'relative',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
        {
          id: 'preset3',
          label: 'Preset 3',
          category: 'absolute',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
        {
          id: 'preset4',
          label: 'Preset 4',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
      ];

      const grouped = getGroupedPresets(presets);

      expect(grouped.relative).toHaveLength(3); // 2 explicit + 1 default
      expect(grouped.absolute).toHaveLength(1);
      expect(grouped.relative?.map((p: DatePreset) => p.id)).toEqual(['preset1', 'preset2', 'preset4']);
    });
  });

  describe('getPresetById', () => {
    it('should find preset by ID', () => {
      const presets: DatePreset[] = [
        {
          id: 'today',
          label: 'Today',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
        {
          id: 'yesterday',
          label: 'Yesterday',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
      ];

      const preset = getPresetById('today', presets);

      expect(preset).toBeDefined();
      expect(preset?.id).toBe('today');
      expect(preset?.label).toBe('Today');
    });

    it('should return undefined for non-existent ID', () => {
      const presets: DatePreset[] = [
        {
          id: 'today',
          label: 'Today',
          getRange: () => ({ from: new Date(), to: new Date() }),
        },
      ];

      const preset = getPresetById('non-existent', presets);

      expect(preset).toBeUndefined();
    });

    it('should use default presets when none provided', () => {
      const preset = getPresetById('today');

      expect(preset).toBeDefined();
      expect(preset?.id).toBe('today');
    });

    it('should handle empty presets array', () => {
      const preset = getPresetById('today', []);

      expect(preset).toBeUndefined();
    });
  });

  describe('createCustomPreset', () => {
    it('should create a custom preset with provided parameters', () => {
      const from = new Date('2023-01-01');
      const to = new Date('2023-01-31');

      const preset = createCustomPreset(
        'custom-january-2023',
        'January 2023',
        () => ({ from, to }),
        {
          description: 'First month of 2023',
          icon: 'calendar',
        }
      );

      expect(preset.id).toBe('custom-january-2023');
      expect(preset.label).toBe('January 2023');
      expect(preset.description).toBe('First month of 2023');
      expect(preset.icon).toBe('calendar');
      expect(preset.category).toBe('custom');
      expect(preset.isRelative).toBe(false);

      const range = preset.getRange();
      expect(range.from).toEqual(from);
      expect(range.to).toEqual(to);
    });

    it('should generate ID from label when not provided', () => {
      const preset = createCustomPreset(
        'custom-my-custom-range',
        'My Custom Range',
        () => ({ from: new Date(), to: new Date() })
      );

      expect(preset.id).toBe('custom-my-custom-range');
    });

    it('should use provided ID when given', () => {
      const preset = createCustomPreset(
        'my-custom-id',
        'Custom Range',
        () => ({ from: new Date(), to: new Date() })
      );

      expect(preset.id).toBe('my-custom-id');
    });

    it('should handle special characters in label for ID generation', () => {
      const preset = createCustomPreset(
        'custom-q1-2023-jan-mar',
        'Q1 2023 (Jan-Mar)',
        () => ({ from: new Date(), to: new Date() })
      );

      expect(preset.id).toBe('custom-q1-2023-jan-mar');
    });

    it('should set default values for optional properties', () => {
      const preset = createCustomPreset(
        'test',
        'Test',
        () => ({ from: new Date(), to: new Date() })
      );

      expect(preset.description).toBeUndefined();
      expect(preset.icon).toBeUndefined();
      expect(preset.category).toBe('custom');
      expect(preset.isRelative).toBe(false);
    });
  });

  describe('DEFAULT_DATE_PRESETS', () => {
    it('should contain expected preset categories', () => {
      const grouped = getGroupedPresets(DEFAULT_DATE_PRESETS);

      expect(grouped.relative).toBeDefined();
      expect(grouped.relative).toHaveLength(DEFAULT_DATE_PRESETS.length);
      // DEFAULT_DATE_PRESETS only contains relative presets
      expect(grouped.absolute).toBeUndefined();
      expect(grouped.custom).toBeUndefined();
    });

    it('should have presets with valid structure', () => {
      DEFAULT_DATE_PRESETS.forEach((preset: DatePreset) => {
        expect(preset.id).toBeDefined();
        expect(preset.label).toBeDefined();
        expect(preset.getRange).toBeInstanceOf(Function);
        expect(preset.category).toBeDefined();
      });
    });

    it('should have unique IDs', () => {
      const ids = DEFAULT_DATE_PRESETS.map((p: DatePreset) => p.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid date ranges', () => {
      DEFAULT_DATE_PRESETS.forEach((preset: DatePreset) => {
        const range = preset.getRange();
        expect(range.from).toBeInstanceOf(Date);
        expect(range.to).toBeInstanceOf(Date);
        expect(range.from.getTime()).toBeLessThanOrEqual(range.to.getTime());
      });
    });
  });

  describe('integration tests', () => {
    it('should work with grouped presets and preset lookup', () => {
      const grouped = getGroupedPresets();
      const todayPreset = getPresetById('today');

      expect(todayPreset).toBeDefined();
      expect(grouped.relative).toContain(todayPreset);
    });

    it('should handle custom presets in grouping', () => {
      const customPreset = createCustomPreset(
        'test-range',
        'Test Range',
        () => ({ from: new Date('2023-01-01'), to: new Date('2023-01-31') })
      );

      const allPresets = [...DEFAULT_DATE_PRESETS, customPreset];
      const grouped = getGroupedPresets(allPresets);

      expect(grouped.custom).toContain(customPreset);
    });
  });
});
