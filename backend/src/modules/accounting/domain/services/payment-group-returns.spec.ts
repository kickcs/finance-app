import { paymentPartReturnedAmount } from './payment-group-returns';

describe('paymentPartReturnedAmount', () => {
  // Покупка на 100: 60 картой, 40 наличными; долги участников указывают на карту.
  const card = (returned: number) => ({ amount: 60, returned });
  const cash = (returned: number) => ({ amount: 40, returned });

  const split = (cardReturned: number, cashReturned = 0) => [
    paymentPartReturnedAmount(card(cardReturned), cash(cashReturned)),
    paymentPartReturnedAmount(cash(cashReturned), card(cardReturned)),
  ];

  it('возврат в пределах части остаётся на ней', () => {
    expect(split(50)).toEqual([50, 0]);
  });

  it('излишек сверх части уходит на пару, ни одна часть не уходит в минус', () => {
    expect(split(80)).toEqual([60, 20]);
  });

  it('сумма долей равна возврату группы, пока он не больше итога', () => {
    const [onCard, onCash] = split(75, 10);
    expect(onCard + onCash).toBe(85);
    expect(onCard).toBeLessThanOrEqual(60);
    expect(onCash).toBeLessThanOrEqual(40);
  });

  it('возврат больше итога обнуляет обе части', () => {
    expect(split(130)).toEqual([60, 40]);
  });

  it('копейки не оставляют хвост float', () => {
    expect(
      paymentPartReturnedAmount({ amount: 0.2, returned: 0 }, { amount: 0.1, returned: 0.3 }),
    ).toBe(0.2);
  });
});
