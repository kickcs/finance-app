import { Email } from './email.vo';

describe('Email Value Object', () => {
  it('should create a valid email', () => {
    const email = Email.create('Test@Example.COM');
    expect(email.value).toBe('test@example.com');
  });

  it('should lowercase the email', () => {
    const email = Email.create('User@Domain.IO');
    expect(email.value).toBe('user@domain.io');
  });

  it('should reject emails with leading/trailing spaces', () => {
    expect(() => Email.create('  User@Domain.IO  ')).toThrow('Invalid email address');
  });

  it('should throw for an empty string', () => {
    expect(() => Email.create('')).toThrow('Invalid email address');
  });

  it('should throw for a missing @ symbol', () => {
    expect(() => Email.create('userexample.com')).toThrow('Invalid email address');
  });

  it('should throw for a missing domain', () => {
    expect(() => Email.create('user@')).toThrow('Invalid email address');
  });

  it('should throw for a missing local part', () => {
    expect(() => Email.create('@example.com')).toThrow('Invalid email address');
  });

  it('should throw for whitespace only', () => {
    expect(() => Email.create('   ')).toThrow('Invalid email address');
  });

  it('should return the value from toString()', () => {
    const email = Email.create('hello@world.com');
    expect(email.toString()).toBe('hello@world.com');
  });

  it('should consider two emails with same address as equal', () => {
    const email1 = Email.create('a@b.com');
    const email2 = Email.create('A@B.COM');
    expect(email1.equals(email2)).toBe(true);
  });

  it('should consider two emails with different addresses as not equal', () => {
    const email1 = Email.create('a@b.com');
    const email2 = Email.create('x@y.com');
    expect(email1.equals(email2)).toBe(false);
  });
});
