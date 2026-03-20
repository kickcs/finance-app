import { describe, it, expect, beforeEach } from 'vitest';
import { useManageCategories } from './useManageCategories';
import { CATEGORY_COLORS, CATEGORY_ICONS } from './constants';

// ---------------------------------------------------------------------------
// useManageCategories unit tests
// ---------------------------------------------------------------------------

describe('useManageCategories', () => {
  let state: ReturnType<typeof useManageCategories>;

  beforeEach(() => {
    state = useManageCategories();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('initializes with empty name', () => {
      expect(state.formData.value.name).toBe('');
    });

    it('initializes with first icon', () => {
      expect(state.formData.value.icon).toBe(CATEGORY_ICONS[0]);
    });

    it('initializes with first color', () => {
      expect(state.formData.value.color).toBe(CATEGORY_COLORS[0]);
    });

    it('initializes with expense type', () => {
      expect(state.formData.value.type).toBe('expense');
    });

    it('isValid is false initially (empty name)', () => {
      expect(state.isValid.value).toBe(false);
    });

    it('nameError is null initially', () => {
      expect(state.nameError.value).toBeNull();
    });

    it('isSubmitting is false initially', () => {
      expect(state.isSubmitting.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // updateField
  // -------------------------------------------------------------------------
  describe('updateField', () => {
    it('updates name field', () => {
      state.updateField('name', 'Продукты');
      expect(state.formData.value.name).toBe('Продукты');
    });

    it('updates icon field', () => {
      state.updateField('icon', 'restaurant');
      expect(state.formData.value.icon).toBe('restaurant');
    });

    it('updates color field', () => {
      state.updateField('color', '#ff0000');
      expect(state.formData.value.color).toBe('#ff0000');
    });

    it('updates type field to income', () => {
      state.updateField('type', 'income');
      expect(state.formData.value.type).toBe('income');
    });
  });

  // -------------------------------------------------------------------------
  // isValid computed
  // -------------------------------------------------------------------------
  describe('isValid', () => {
    it('becomes true when name has non-empty trimmed value', () => {
      state.updateField('name', 'Продукты');
      expect(state.isValid.value).toBe(true);
    });

    it('remains false for whitespace-only name', () => {
      state.updateField('name', '   ');
      expect(state.isValid.value).toBe(false);
    });

    it('remains false for empty name', () => {
      state.updateField('name', '');
      expect(state.isValid.value).toBe(false);
    });

    it('is true for single character name', () => {
      state.updateField('name', 'A');
      expect(state.isValid.value).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // nameError computed
  // -------------------------------------------------------------------------
  describe('nameError', () => {
    it('returns null when name is empty string', () => {
      state.updateField('name', '');
      expect(state.nameError.value).toBeNull();
    });

    it('returns error message for whitespace-only name', () => {
      state.updateField('name', '   ');
      expect(state.nameError.value).toBeTruthy();
      expect(state.nameError.value).toContain('пробел');
    });

    it('returns null for valid name', () => {
      state.updateField('name', 'Транспорт');
      expect(state.nameError.value).toBeNull();
    });

    it('returns null for name with leading/trailing spaces but valid content', () => {
      // "  А  " has trimmed length > 0, but the condition checks: name.length > 0 && trim().length === 0
      state.updateField('name', '  А  ');
      expect(state.nameError.value).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // resetForm
  // -------------------------------------------------------------------------
  describe('resetForm', () => {
    it('resets all fields to defaults', () => {
      state.updateField('name', 'Старое название');
      state.updateField('icon', 'restaurant');
      state.updateField('color', '#ff0000');
      state.updateField('type', 'income');

      state.resetForm();

      expect(state.formData.value.name).toBe('');
      expect(state.formData.value.icon).toBe(CATEGORY_ICONS[0]);
      expect(state.formData.value.color).toBe(CATEGORY_COLORS[0]);
      expect(state.formData.value.type).toBe('expense');
    });

    it('resets with income type when passed', () => {
      state.resetForm('income');
      expect(state.formData.value.type).toBe('income');
    });

    it('isValid becomes false after reset', () => {
      state.updateField('name', 'Something');
      expect(state.isValid.value).toBe(true);

      state.resetForm();
      expect(state.isValid.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles long category names', () => {
      const longName = 'А'.repeat(200);
      state.updateField('name', longName);
      expect(state.formData.value.name).toBe(longName);
      expect(state.isValid.value).toBe(true);
    });

    it('handles special characters in name', () => {
      state.updateField('name', 'Café & Bistro!');
      expect(state.isValid.value).toBe(true);
    });
  });
});
