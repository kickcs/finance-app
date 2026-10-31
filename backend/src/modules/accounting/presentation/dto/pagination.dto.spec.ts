import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PaginationDto, TransactionFilterDto } from './pagination.dto';
import { AccountPaginationDto } from './transaction-queries.dto';

// Те же настройки, что в main.ts: лишние поля отвергаются, query приводится к классу.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: false },
});

const parse = <T extends object>(metatype: new () => T, query: Record<string, unknown>) =>
  pipe.transform(query, { type: 'query', metatype }) as Promise<T>;

const UUID_A = '3f1c6a1e-5c0e-4a52-9a52-0f2a8c8b1d11';
const UUID_B = '9b7d2c64-1a8e-4f0b-8d63-6a1e7f3f2c22';

describe('TransactionFilterDto: массивы из query-строки', () => {
  it.each([
    ['одно значение', 'food', ['food']],
    ['повторяющийся параметр', ['food', 'taxi'], ['food', 'taxi']],
    ['список через запятую', 'food,taxi', ['food', 'taxi']],
    [
      'повторы и запятые вместе',
      ['food,taxi', 'taxi', 'gifts_income'],
      ['food', 'taxi', 'gifts_income'],
    ],
  ])('categoryIds: %s', async (_name, input, expected) => {
    const dto = await parse(TransactionFilterDto, { categoryIds: input });

    expect(dto.categoryIds).toEqual(expected);
  });

  it('категории не обязаны быть UUID: допустим слаг встроенной категории', async () => {
    const dto = await parse(TransactionFilterDto, { categoryIds: 'gifts_income' });

    expect(dto.categoryIds).toEqual(['gifts_income']);
  });

  it('пустое значение — «фильтра нет»', async () => {
    const dto = await parse(TransactionFilterDto, { categoryIds: '', tags: ',', accountIds: [''] });

    expect(dto.categoryIds).toBeUndefined();
    expect(dto.tags).toBeUndefined();
    expect(dto.accountIds).toBeUndefined();
  });

  it('accountIds принимает UUID в любой из трёх форм и отвергает остальное', async () => {
    expect((await parse(TransactionFilterDto, { accountIds: UUID_A })).accountIds).toEqual([
      UUID_A,
    ]);
    expect(
      (await parse(TransactionFilterDto, { accountIds: [UUID_A, UUID_B] })).accountIds,
    ).toEqual([UUID_A, UUID_B]);
    expect(
      (await parse(TransactionFilterDto, { accountIds: `${UUID_A},${UUID_B}` })).accountIds,
    ).toEqual([UUID_A, UUID_B]);
    await expect(parse(TransactionFilterDto, { accountIds: 'not-a-uuid' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('теги приходят с решёткой или без и сводятся к одному виду', async () => {
    const dto = await parse(TransactionFilterDto, { tags: ['#кафе', 'кафе', '##Работа,такси'] });

    expect(dto.tags).toEqual(['кафе', 'Работа', 'такси']);
  });

  it.each([['a b'], ['a.b'], ['a)'], ['a?']])(
    'тег с границей внутри (%s) отвергается: такого тега в описании не бывает',
    async (tag) => {
      await expect(parse(TransactionFilterDto, { tags: tag })).rejects.toThrow(BadRequestException);
    },
  );

  it('форма с квадратными скобками не разбирается: ключ остаётся «categoryIds[]» и отвергается', async () => {
    await expect(parse(TransactionFilterDto, { 'categoryIds[]': 'food' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('TransactionFilterDto: период', () => {
  it('принимает календарные даты', async () => {
    const dto = await parse(TransactionFilterDto, {
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });

    expect(dto).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-31' });
  });

  it.each([
    ['дата со временем', '2026-10-01T10:00:00Z'],
    ['несуществующий день', '2026-02-31'],
    ['не дата', 'yesterday'],
  ])('отвергает: %s', async (_name, value) => {
    await expect(parse(TransactionFilterDto, { startDate: value })).rejects.toThrow(
      BadRequestException,
    );
    await expect(parse(TransactionFilterDto, { endDate: value })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('старые параметры ленты', () => {
  it('categoryId, accountId, type, search, debtId и страница остаются как были', async () => {
    const dto = await parse(PaginationDto, {
      pageSize: '50',
      categoryId: 'food',
      accountId: UUID_A,
      type: 'expense',
      search: 'кофе',
      debtId: UUID_B,
    });

    expect(dto).toMatchObject({
      pageSize: 50,
      categoryId: 'food',
      accountId: UUID_A,
      type: 'expense',
      search: 'кофе',
      debtId: UUID_B,
    });
  });

  it.each([PaginationDto, AccountPaginationDto])(
    'без pageSize страница — 20 строк: другого дефолта у ленты нет (%p)',
    async (metatype) => {
      const dto = await parse(metatype, {});

      expect(dto.pageSize).toBe(20);
    },
  );

  it('итог не принимает страницу и курсор', async () => {
    await expect(parse(TransactionFilterDto, { pageSize: '10' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(parse(TransactionFilterDto, { cursorId: UUID_A })).rejects.toThrow(
      BadRequestException,
    );
  });
});
