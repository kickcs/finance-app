import { Debt, type CreateDebtProps } from './debt.aggregate';
import { Money, Currency } from '../../../../../shared/domain/value-objects';
import { DebtType } from '../../value-objects';

describe('Debt Aggregate', () => {
  const defaultProps: CreateDebtProps = {
    id: 'debt-1',
    userId: 'user-1',
    name: 'Test Debt',
    totalAmount: 1000,
    currency: 'USD',
    debtType: 'given',
    personName: 'John Doe',
    accountId: 'account-1',
  };

  describe('create', () => {
    it('should create a debt with required fields', () => {
      const debt = Debt.create({
        id: 'debt-1',
        userId: 'user-1',
        name: 'Test Debt',
        totalAmount: 1000,
        currency: 'USD',
        debtType: 'given',
      });

      expect(debt.id).toBe('debt-1');
      expect(debt.userId).toBe('user-1');
      expect(debt.name).toBe('Test Debt');
      expect(debt.totalAmountValue).toBe(1000);
      expect(debt.remainingAmountValue).toBe(1000);
      expect(debt.currency).toBe('USD');
      expect(debt.debtTypeValue).toBe('given');
      expect(debt.isClosed).toBe(false);
      expect(debt.personName).toBeNull();
      expect(debt.accountId).toBeNull();
      expect(debt.transactionId).toBeNull();
      expect(debt.closeTransactionId).toBeNull();
      expect(debt.sourceTransactionId).toBeNull();
      expect(debt.description).toBeNull();
      expect(debt.closedAt).toBeNull();
      expect(debt.forgivenAmount).toBe(0);
      expect(debt.isPrivate).toBe(false);
    });

    it('should create a debt with all optional fields', () => {
      const createdAt = new Date('2025-01-01');
      const nextPaymentDate = new Date('2025-02-01');

      const debt = Debt.create({
        ...defaultProps,
        monthlyPayment: 100,
        nextPaymentDate,
        createdAt,
        description: 'Test description',
      });

      expect(debt.monthlyPaymentValue).toBe(100);
      expect(debt.nextPaymentDate).toBe(nextPaymentDate);
      expect(debt.createdAt).toBe(createdAt);
      expect(debt.description).toBe('Test description');
      expect(debt.personName).toBe('John Doe');
      expect(debt.accountId).toBe('account-1');
    });

    it('should set remaining amount equal to total amount on creation', () => {
      const debt = Debt.create(defaultProps);
      expect(debt.remainingAmountValue).toBe(debt.totalAmountValue);
    });

    it('should emit DebtCreatedEvent on creation', () => {
      const debt = Debt.create(defaultProps);
      const events = debt.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('debt.created');
    });

    it('should trim person name', () => {
      const debt = Debt.create({ ...defaultProps, personName: '  John Doe  ' });
      expect(debt.personName).toBe('John Doe');
    });

    it('should set personName to null if empty string', () => {
      const debt = Debt.create({ ...defaultProps, personName: '   ' });
      expect(debt.personName).toBeNull();
    });

    it('should trim description', () => {
      const debt = Debt.create({ ...defaultProps, description: '  A description  ' });
      expect(debt.description).toBe('A description');
    });

    it('should create a "taken" type debt', () => {
      const debt = Debt.create({ ...defaultProps, debtType: 'taken' });
      expect(debt.debtTypeValue).toBe('taken');
      expect(debt.debtType.isTaken()).toBe(true);
    });

    it('should set monthlyPayment to null when not provided', () => {
      const debt = Debt.create(defaultProps);
      expect(debt.monthlyPayment).toBeNull();
      expect(debt.monthlyPaymentValue).toBeNull();
    });
  });

  describe('makePayment', () => {
    it('should reduce remaining amount by payment', () => {
      const debt = Debt.create(defaultProps);
      debt.clearDomainEvents();

      debt.makePayment(300);

      expect(debt.remainingAmountValue).toBe(700);
    });

    it('should emit DebtPaymentMadeEvent', () => {
      const debt = Debt.create(defaultProps);
      debt.clearDomainEvents();

      debt.makePayment(300);

      const events = debt.domainEvents;
      expect(events.some((e) => e.eventName === 'debt.payment-made')).toBe(true);
    });

    it('should auto-close debt when remaining reaches zero', () => {
      const debt = Debt.create(defaultProps);
      debt.clearDomainEvents();

      debt.makePayment(1000);

      expect(debt.isClosed).toBe(true);
      expect(debt.remainingAmountValue).toBe(0);
      expect(debt.closedAt).toBeInstanceOf(Date);
    });

    it('should auto-close debt when payment exceeds remaining', () => {
      const debt = Debt.create(defaultProps);
      debt.clearDomainEvents();

      debt.makePayment(1500);

      expect(debt.isClosed).toBe(true);
      expect(debt.remainingAmountValue).toBe(0);
    });

    it('should emit both payment and closed events when auto-closing', () => {
      const debt = Debt.create(defaultProps);
      debt.clearDomainEvents();

      debt.makePayment(1000);

      const events = debt.domainEvents;
      expect(events.some((e) => e.eventName === 'debt.payment-made')).toBe(true);
      expect(events.some((e) => e.eventName === 'debt.closed')).toBe(true);
    });

    it('should throw error when making payment on closed debt', () => {
      const debt = Debt.create(defaultProps);
      debt.close();

      expect(() => {
        debt.makePayment(100);
      }).toThrow('Cannot make payment on a closed debt');
    });
  });

  describe('close', () => {
    it('should close an open debt', () => {
      const debt = Debt.create(defaultProps);
      debt.clearDomainEvents();

      debt.close();

      expect(debt.isClosed).toBe(true);
      expect(debt.remainingAmountValue).toBe(0);
      expect(debt.closedAt).toBeInstanceOf(Date);
    });

    it('should emit DebtClosedEvent', () => {
      const debt = Debt.create(defaultProps);
      debt.clearDomainEvents();

      debt.close();

      const events = debt.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('debt.closed');
    });

    it('should not emit event if already closed (idempotent)', () => {
      const debt = Debt.create(defaultProps);
      debt.close();
      debt.clearDomainEvents();

      debt.close();

      expect(debt.domainEvents).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update name', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ name: 'Updated Name' });
      expect(debt.name).toBe('Updated Name');
    });

    it('should update totalAmount', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ totalAmount: 2000 });
      expect(debt.totalAmountValue).toBe(2000);
    });

    it('should update remainingAmount', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ remainingAmount: 500 });
      expect(debt.remainingAmountValue).toBe(500);
    });

    it('should update monthlyPayment', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ monthlyPayment: 200 });
      expect(debt.monthlyPaymentValue).toBe(200);
    });

    it('should clear monthlyPayment to null', () => {
      const debt = Debt.create({ ...defaultProps, monthlyPayment: 100 });
      debt.update({ monthlyPayment: null });
      expect(debt.monthlyPaymentValue).toBeNull();
    });

    it('should update debtType', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ debtType: 'taken' });
      expect(debt.debtTypeValue).toBe('taken');
    });

    it('should update personName and trim it', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ personName: '  Jane  ' });
      expect(debt.personName).toBe('Jane');
    });

    it('should close debt when isClosed is set to true via update', () => {
      const debt = Debt.create(defaultProps);
      debt.clearDomainEvents();
      debt.update({ isClosed: true });

      expect(debt.isClosed).toBe(true);
      expect(debt.closedAt).toBeInstanceOf(Date);
    });

    it('should reopen debt when isClosed is set to false', () => {
      const debt = Debt.create(defaultProps);
      debt.close();
      debt.update({ isClosed: false });

      expect(debt.isClosed).toBe(false);
      expect(debt.closedAt).toBeNull();
    });

    it('should update description', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ description: 'New description' });
      expect(debt.description).toBe('New description');
    });

    it('should update forgivenAmount', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ forgivenAmount: 100 });
      expect(debt.forgivenAmount).toBe(100);
    });

    it('should update isPrivate', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ isPrivate: true });
      expect(debt.isPrivate).toBe(true);
    });

    it('should update transactionId', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ transactionId: 'tx-1' });
      expect(debt.transactionId).toBe('tx-1');
    });

    it('should update closeTransactionId', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ closeTransactionId: 'tx-close-1' });
      expect(debt.closeTransactionId).toBe('tx-close-1');
    });

    it('should update sourceTransactionId', () => {
      const debt = Debt.create(defaultProps);
      debt.update({ sourceTransactionId: 'tx-source-1' });
      expect(debt.sourceTransactionId).toBe('tx-source-1');
    });
  });

  describe('setTransactionId', () => {
    it('should set transaction id', () => {
      const debt = Debt.create(defaultProps);
      debt.setTransactionId('tx-123');
      expect(debt.transactionId).toBe('tx-123');
    });
  });

  describe('setCloseTransactionId', () => {
    it('should set close transaction id', () => {
      const debt = Debt.create(defaultProps);
      debt.setCloseTransactionId('tx-close-123');
      expect(debt.closeTransactionId).toBe('tx-close-123');
    });
  });

  describe('setForgivenAmount', () => {
    it('should set forgiven amount', () => {
      const debt = Debt.create(defaultProps);
      debt.setForgivenAmount(250);
      expect(debt.forgivenAmount).toBe(250);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from full props', () => {
      const now = new Date();
      const currencyVo = Currency.create('USD');
      const debt = Debt.reconstitute({
        id: 'debt-1',
        userId: 'user-1',
        name: 'Reconstituted Debt',
        totalAmount: Money.create(500, currencyVo),
        remainingAmount: Money.create(300, currencyVo),
        monthlyPayment: Money.create(50, currencyVo),
        nextPaymentDate: now,
        debtType: DebtType.create('taken'),
        personName: 'Alice',
        accountId: 'acc-1',
        transactionId: 'tx-1',
        closeTransactionId: null,
        isClosed: false,
        sourceTransactionId: null,
        createdAt: now,
        description: 'Some description',
        closedAt: null,
        forgivenAmount: 0,
        isPrivate: true,
      });

      expect(debt.id).toBe('debt-1');
      expect(debt.totalAmountValue).toBe(500);
      expect(debt.remainingAmountValue).toBe(300);
      expect(debt.isPrivate).toBe(true);
      expect(debt.debtTypeValue).toBe('taken');
    });
  });
});
