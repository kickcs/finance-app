import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { I18nService } from 'nestjs-i18n';
import { TelegramBotService } from './telegram-bot.service';

describe('TelegramBotService', () => {
  let service: TelegramBotService;

  const mockConfigService = { get: jest.fn().mockReturnValue(undefined) };
  const mockCommandBus = { execute: jest.fn() };
  const mockI18n = { translate: jest.fn().mockReturnValue('') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramBotService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    service = module.get(TelegramBotService);
    jest.clearAllMocks();
  });

  describe('resolveTelegramLang', () => {
    it('returns "en" for language_code "en"', () => {
      expect(service.resolveTelegramLang('123', 'en')).toBe('en');
    });

    it('returns "en" for language_code "en-US"', () => {
      expect(service.resolveTelegramLang('123', 'en-US')).toBe('en');
    });

    it('returns "en" for language_code "EN-GB" (case-insensitive)', () => {
      expect(service.resolveTelegramLang('123', 'EN-GB')).toBe('en');
    });

    it('returns "ru" for language_code "de"', () => {
      expect(service.resolveTelegramLang('123', 'de')).toBe('ru');
    });

    it('returns "ru" for language_code "ru"', () => {
      expect(service.resolveTelegramLang('123', 'ru')).toBe('ru');
    });

    it('returns "ru" when language_code is undefined', () => {
      expect(service.resolveTelegramLang('123', undefined)).toBe('ru');
    });

    it('bot is not initialized when no token is set', () => {
      expect(service.enabled).toBe(false);
    });
  });
});
