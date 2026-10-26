import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CloseAllDebtsDto, PreviewCloseAllDto } from './close-all-debts.dto';

// Как глобальный ValidationPipe: transform + whitelist.
async function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(CloseAllDebtsDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
}

async function parsePreview(body: Record<string, unknown>) {
  const dto = plainToInstance(PreviewCloseAllDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
}

const base = {
  debtIds: ['0b6f1c2e-3d4a-4b5c-8d9e-1f2a3b4c5d6e'],
  accountId: '1c7a2d3f-4e5b-4c6d-9eaf-2a3b4c5d6e7f',
};

describe('CloseAllDebtsDto', () => {
  it('paymentAmount: null становится undefined — как будто поля нет', async () => {
    const { dto, errors } = await parse({ ...base, paymentAmount: null });

    expect(errors).toEqual([]);
    expect(dto.paymentAmount).toBeUndefined();
  });

  it('число и ноль остаются как есть', async () => {
    expect((await parse({ ...base, paymentAmount: 150.5 })).dto.paymentAmount).toBe(150.5);
    expect((await parse({ ...base, paymentAmount: 0 })).dto.paymentAmount).toBe(0);
  });

  it('отрицательная сумма по-прежнему отклоняется', async () => {
    const { errors } = await parse({ ...base, paymentAmount: -1 });

    expect(errors.map((e) => e.property)).toEqual(['paymentAmount']);
  });
});

describe('PreviewCloseAllDto', () => {
  it('счёт не нужен: предпросмотр принимает долги и сумму без него', async () => {
    const { errors } = await parsePreview({ debtIds: base.debtIds, paymentAmount: 10 });

    expect(errors).toEqual([]);
    // Исполнение без счёта по-прежнему отклоняется.
    expect((await parse({ debtIds: base.debtIds })).errors.map((e) => e.property)).toEqual([
      'accountId',
    ]);
  });

  it('те же правила суммы: null становится undefined, отрицательная отклоняется', async () => {
    const withNull = await parsePreview({ debtIds: base.debtIds, paymentAmount: null });
    expect(withNull.errors).toEqual([]);
    expect(withNull.dto.paymentAmount).toBeUndefined();

    const negative = await parsePreview({ debtIds: base.debtIds, paymentAmount: -1 });
    expect(negative.errors.map((e) => e.property)).toEqual(['paymentAmount']);
  });

  it('список долгов обязателен и ограничен идентификаторами', async () => {
    expect((await parsePreview({})).errors.map((e) => e.property)).toEqual(['debtIds']);
    expect((await parsePreview({ debtIds: ['x'] })).errors.map((e) => e.property)).toEqual([
      'debtIds',
    ]);
  });
});
