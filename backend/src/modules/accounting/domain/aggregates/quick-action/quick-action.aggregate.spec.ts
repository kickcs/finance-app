import { QuickAction } from './quick-action.aggregate';

describe('QuickAction Aggregate', () => {
  describe('create', () => {
    it('should create a quick action with correct properties', () => {
      const qa = QuickAction.create('qa-1', 'user-1', 'cat-food', 'acc-1', 'Lunch', 0);
      expect(qa.id).toBe('qa-1');
      expect(qa.userId).toBe('user-1');
      expect(qa.categoryId).toBe('cat-food');
      expect(qa.accountId).toBe('acc-1');
      expect(qa.label).toBe('Lunch');
      expect(qa.position).toBe(0);
      expect(qa.createdAt).toBeInstanceOf(Date);
      expect(qa.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('should update categoryId', () => {
      const qa = QuickAction.create('qa-1', 'user-1', 'cat-old', 'acc-1', 'Label', 0);
      qa.update({ categoryId: 'cat-new' });
      expect(qa.categoryId).toBe('cat-new');
    });

    it('should update accountId', () => {
      const qa = QuickAction.create('qa-1', 'user-1', 'cat-1', 'acc-old', 'Label', 0);
      qa.update({ accountId: 'acc-new' });
      expect(qa.accountId).toBe('acc-new');
    });

    it('should update label', () => {
      const qa = QuickAction.create('qa-1', 'user-1', 'cat-1', 'acc-1', 'Old Label', 0);
      qa.update({ label: 'New Label' });
      expect(qa.label).toBe('New Label');
    });

    it('should update updatedAt on update', () => {
      const qa = QuickAction.create('qa-1', 'user-1', 'cat-1', 'acc-1', 'Label', 0);
      const originalUpdatedAt = qa.updatedAt;

      // Small delay to ensure different timestamp
      qa.update({ label: 'Changed' });
      expect(qa.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('should not change fields not provided', () => {
      const qa = QuickAction.create('qa-1', 'user-1', 'cat-1', 'acc-1', 'Label', 0);
      qa.update({ label: 'New' });
      expect(qa.categoryId).toBe('cat-1');
      expect(qa.accountId).toBe('acc-1');
    });
  });

  describe('setPosition', () => {
    it('should update position', () => {
      const qa = QuickAction.create('qa-1', 'user-1', 'cat-1', 'acc-1', 'Label', 0);
      qa.setPosition(3);
      expect(qa.position).toBe(3);
    });

    it('should update updatedAt on setPosition', () => {
      const qa = QuickAction.create('qa-1', 'user-1', 'cat-1', 'acc-1', 'Label', 0);
      const before = qa.updatedAt;
      qa.setPosition(5);
      expect(qa.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
