import { Test, type TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { DemoInitializationService } from './demo-initialization.service';
import { PROFILE_REPOSITORY } from '../../domain/repositories/profile.repository.interface';
import { ACCOUNT_REPOSITORY } from '../../../accounting/domain/repositories/account.repository.interface';
import { TRANSACTION_REPOSITORY } from '../../../accounting/domain/repositories/transaction.repository.interface';
import { DEBT_REPOSITORY } from '../../../debt/domain/repositories/debt.repository.interface';
import { PERSON_REPOSITORY } from '../../../person/domain/repositories/person.repository.interface';
import { DomainEventPublisher } from '../../../../shared';
import type { Profile } from '../../domain';

type AnyObject = Record<string, any>;

const RU_TRANSLATIONS: Record<string, string | string[]> = {
  'demo.accounts.main': 'Основной',
  'demo.accounts.savings': 'Накопительный',
  'demo.contacts.ahmed': 'Ахмед',
  'demo.contacts.anna': 'Анна',
  'demo.contacts.kolya': 'Коля',
  'demo.contacts.dima': 'Дима',
  'demo.debts.repair': 'На ремонт',
  'demo.debts.trip': 'На поездку',
  'demo.debts.wedding': 'На свадьбу',
  'demo.debts.tillPayday': 'До зарплаты',
  'demo.debts.furniture': 'На мебель',
  'demo.debts.laptop': 'За ноутбук',
  'demo.descriptions.groceries': [
    'Makro',
    'Korzinka',
    'Havas',
    'Овощи на базаре',
    'Продукты на неделю',
  ],
  'demo.descriptions.transport': ['Yandex Go', 'Метро', 'Заправка', 'MyTaxi', 'Автобус'],
  'demo.descriptions.salary': ['Зарплата', 'Аванс'],
  'demo.descriptions.freelance': ['Проект', 'Заказ', 'Консультация'],
  'demo.descriptions.cashback': ['Кэшбек Uzcard', 'Кэшбек Payme'],
  'demo.descriptions.gifts_income': ['Подарок', 'От родителей'],
  'demo.descriptions.investments': ['Дивиденды', 'Проценты по вкладу'],
  'demo.descriptions.other_income': ['Возврат', 'Продажа', 'Прочее'],
  'demo.descriptions.health': ['Аптека', 'Анализы', 'Врач', 'Стоматолог', 'Витамины'],
  'demo.descriptions.housing': ['Коммунальные', 'Интернет', 'Уборка', 'Ремонт', 'Мебель'],
  'demo.descriptions.cafe': ['Обед', 'Кофе', 'Evos', 'Oqtepa', 'Ресторан'],
  'demo.descriptions.entertainment': ['Кино', 'Netflix', 'Концерт', 'Игры', 'Подписка'],
  'demo.descriptions.gifts': ['День рождения', 'Подарок другу', 'Цветы', 'Сувенир'],
  'demo.descriptions.education': ['Курсы', 'Книги', 'Udemy', 'Репетитор'],
  'demo.descriptions.family': ['Детский сад', 'Школа', 'Одежда детям', 'Игрушки'],
  'demo.descriptions.sport': ['Тренажерка', 'Бассейн', 'Спортивная форма', 'Протеин'],
  'demo.descriptions.travel': ['Билеты', 'Отель', 'Экскурсия', 'Сувениры из поездки'],
  'demo.descriptions.other_expense': ['Разное', 'Мелкие расходы', 'Прочее'],
};

describe('DemoInitializationService', () => {
  let service: DemoInitializationService;

  const mockProfileRepo = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByEmail: jest.fn(),
  };

  const mockAccountRepo = {
    save: jest.fn().mockImplementation((account: AnyObject) => Promise.resolve(account)),
  };

  const mockTransactionRepo = {
    saveMany: jest.fn().mockResolvedValue(undefined),
  };

  const mockDebtRepo = {
    save: jest.fn().mockImplementation((debt: AnyObject) => Promise.resolve(debt)),
  };

  const mockPersonRepo = {
    save: jest.fn().mockImplementation((person: AnyObject) => Promise.resolve(person)),
  };

  const mockEventPublisher = {
    publishEvents: jest.fn().mockResolvedValue(undefined),
    publishEventsFromMultiple: jest.fn().mockResolvedValue(undefined),
  };

  const mockI18n = {
    translate: jest.fn().mockImplementation((key: string) => RU_TRANSLATIONS[key] ?? `T:${key}`),
  };

  const mockProfile = {
    id: 'user-123',
    language: 'ru',
    updateProfile: jest.fn(),
  } as unknown as Profile;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemoInitializationService,
        { provide: PROFILE_REPOSITORY, useValue: mockProfileRepo },
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepo },
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepo },
        { provide: DEBT_REPOSITORY, useValue: mockDebtRepo },
        { provide: PERSON_REPOSITORY, useValue: mockPersonRepo },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    service = module.get<DemoInitializationService>(DemoInitializationService);
    jest.clearAllMocks();
    mockI18n.translate.mockImplementation((key: string) => RU_TRANSLATIONS[key] ?? `T:${key}`);
    mockProfileRepo.save.mockImplementation((p: AnyObject) => Promise.resolve(p));

    mockAccountRepo.save.mockImplementation((account: AnyObject) => Promise.resolve(account));

    mockDebtRepo.save.mockImplementation((debt: AnyObject) => Promise.resolve(debt));

    mockPersonRepo.save.mockImplementation((person: AnyObject) => Promise.resolve(person));
    mockTransactionRepo.saveMany.mockResolvedValue(undefined);
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
    mockEventPublisher.publishEventsFromMultiple.mockResolvedValue(undefined);
  });

  it('should call i18n.translate for account names using demo.accounts.main and demo.accounts.savings', async () => {
    await service.initializeDemoData(mockProfile);

    expect(mockI18n.translate).toHaveBeenCalledWith('demo.accounts.main', { lang: 'ru' });
    expect(mockI18n.translate).toHaveBeenCalledWith('demo.accounts.savings', { lang: 'ru' });
  });

  it('should use profile.language to resolve lang', async () => {
    const enProfile = { id: 'u2', language: 'en', updateProfile: jest.fn() } as unknown as Profile;
    mockI18n.translate.mockImplementation((key: string) => `EN:${key}`);

    await service.initializeDemoData(enProfile);

    const calls = mockI18n.translate.mock.calls as Array<[string, { lang: string }]>;
    calls.forEach(([, opts]) => {
      expect(opts.lang).toBe('en');
    });
  });

  it('contact↔debt referential integrity: same i18n key used by both person and debt', async () => {
    await service.initializeDemoData(mockProfile);

    expect(mockI18n.translate).toHaveBeenCalledWith('demo.contacts.ahmed', { lang: 'ru' });
    expect(mockI18n.translate).toHaveBeenCalledWith('demo.contacts.anna', { lang: 'ru' });
    expect(mockI18n.translate).toHaveBeenCalledWith('demo.contacts.kolya', { lang: 'ru' });
    expect(mockI18n.translate).toHaveBeenCalledWith('demo.contacts.dima', { lang: 'ru' });

    const calls = mockI18n.translate.mock.calls as Array<[string, { lang: string }]>;
    // ahmed appears in createPeople (1 call) + 2 debts (repair + trip) = 3 calls
    const ahmedCalls = calls.filter(([key]) => key === 'demo.contacts.ahmed');
    expect(ahmedCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('should call i18n.translate for transaction descriptions by category id', async () => {
    await service.initializeDemoData(mockProfile);

    // salary descriptions are always fetched (at least 1 salary transaction is added)
    expect(mockI18n.translate).toHaveBeenCalledWith('demo.descriptions.salary', { lang: 'ru' });
  });

  it('should call i18n.translate for debt names', async () => {
    await service.initializeDemoData(mockProfile);

    expect(mockI18n.translate).toHaveBeenCalledWith('demo.debts.repair', { lang: 'ru' });
    expect(mockI18n.translate).toHaveBeenCalledWith('demo.debts.furniture', { lang: 'ru' });
    expect(mockI18n.translate).toHaveBeenCalledWith('demo.debts.laptop', { lang: 'ru' });
  });
});
