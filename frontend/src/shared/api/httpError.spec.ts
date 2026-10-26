import { describe, it, expect } from 'vitest';
import { HttpError, getServerErrorMessage, getServerMessageText } from './http';

describe('getServerErrorMessage', () => {
  it('returns the text of a rule refusal (400 and 409)', () => {
    expect(getServerErrorMessage(new HttpError(400, 'Bad Request', { message: 'Нельзя' }))).toBe(
      'Нельзя',
    );
    expect(
      getServerErrorMessage(new HttpError(409, 'Conflict', { message: 'Сначала отмените' })),
    ).toBe('Сначала отмените');
  });

  // Бэкенд местами отвечает английским («Debt is not closed», «Informational
  // transactions cannot be edited»): такой текст пользователю не показываем.
  it('ignores an English message even on a rule refusal', () => {
    expect(
      getServerErrorMessage(new HttpError(409, 'Conflict', { message: 'Debt is not closed' })),
    ).toBeUndefined();
    expect(
      getServerErrorMessage(
        new HttpError(400, 'Bad Request', {
          message: 'Informational transactions cannot be edited',
        }),
      ),
    ).toBeUndefined();
    expect(
      getServerErrorMessage(new HttpError(400, 'Bad Request', { message: ['id must be a UUID'] })),
    ).toBeUndefined();
  });

  it('keeps a Russian message that mentions Latin words or digits', () => {
    expect(
      getServerErrorMessage(
        new HttpError(409, 'Conflict', { message: 'Сначала отмените расчёт №5' }),
      ),
    ).toBe('Сначала отмените расчёт №5');
  });

  it('joins a validation list into one line', () => {
    const error = new HttpError(400, 'Bad Request', { message: ['a плохо', 'b плохо'] });

    expect(getServerErrorMessage(error)).toBe('a плохо. b плохо');
  });

  // «Расчёт не найден» при гонке двух отмен: русский 404 объясняет, что произошло, английский — нет.
  it('returns a Russian 404 text and ignores an English one', () => {
    expect(
      getServerErrorMessage(new HttpError(404, 'Not Found', { message: 'Расчёт не найден' })),
    ).toBe('Расчёт не найден');
    expect(
      getServerErrorMessage(new HttpError(404, 'Not Found', { message: 'Debt not found' })),
    ).toBeUndefined();
  });

  it('ignores service statuses, whose texts are not meant for users', () => {
    expect(
      getServerErrorMessage(
        new HttpError(500, 'Server Error', { message: 'Internal server error' }),
      ),
    ).toBeUndefined();
    expect(
      getServerErrorMessage(new HttpError(403, 'Forbidden', { message: 'Доступ запрещён' })),
    ).toBeUndefined();
  });

  it('returns nothing when the body has no message or the error is not an HttpError', () => {
    expect(getServerErrorMessage(new HttpError(409, 'Conflict', ''))).toBeUndefined();
    expect(getServerErrorMessage(new HttpError(409, 'Conflict'))).toBeUndefined();
    expect(getServerErrorMessage(new HttpError(409, 'Conflict', { message: '' }))).toBeUndefined();
    expect(getServerErrorMessage(new Error('boom'))).toBeUndefined();
    expect(getServerErrorMessage(null)).toBeUndefined();
  });
});

describe('getServerMessageText', () => {
  it('returns a string message as is and joins a validation list', () => {
    expect(getServerMessageText({ message: 'Нельзя' })).toBe('Нельзя');
    expect(getServerMessageText({ message: ['a', 'b'] })).toBe('a. b');
  });

  it('does not filter by language: that is up to the caller', () => {
    expect(getServerMessageText({ message: 'id must be a UUID' })).toBe('id must be a UUID');
  });

  it('returns nothing for an empty message or a body without one', () => {
    expect(getServerMessageText({ message: '' })).toBeUndefined();
    expect(getServerMessageText({ message: [] })).toBeUndefined();
    expect(getServerMessageText({})).toBeUndefined();
    expect(getServerMessageText('')).toBeUndefined();
    expect(getServerMessageText(null)).toBeUndefined();
    expect(getServerMessageText(undefined)).toBeUndefined();
  });
});
