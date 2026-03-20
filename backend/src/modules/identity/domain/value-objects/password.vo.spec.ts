import { Password } from './password.vo';

describe('Password Value Object', () => {
  describe('fromHash', () => {
    it('should create a password from a hashed value', () => {
      const hash = '$2b$10$somehashvalue';
      const password = Password.fromHash(hash);
      expect(password.hashedValue).toBe(hash);
    });
  });

  describe('validatePlainText', () => {
    it('should pass for a valid password (6+ chars)', () => {
      expect(() => {
        Password.validatePlainText('123456');
      }).not.toThrow();
    });

    it('should pass for a long password', () => {
      expect(() => {
        Password.validatePlainText('a-very-long-password-that-is-valid');
      }).not.toThrow();
    });

    it('should throw for a password shorter than 6 characters', () => {
      expect(() => {
        Password.validatePlainText('12345');
      }).toThrow('Password must be at least 6 characters long');
    });

    it('should throw for an empty password', () => {
      expect(() => {
        Password.validatePlainText('');
      }).toThrow('Password must be at least 6 characters long');
    });

    it('should throw for a null-ish password', () => {
      expect(() => {
        Password.validatePlainText(null as unknown as string);
      }).toThrow('Password must be at least 6 characters long');
    });
  });

  describe('equality', () => {
    it('should consider two passwords with the same hash as equal', () => {
      const p1 = Password.fromHash('hash-abc');
      const p2 = Password.fromHash('hash-abc');
      expect(p1.equals(p2)).toBe(true);
    });

    it('should consider two passwords with different hashes as not equal', () => {
      const p1 = Password.fromHash('hash-abc');
      const p2 = Password.fromHash('hash-xyz');
      expect(p1.equals(p2)).toBe(false);
    });
  });
});
