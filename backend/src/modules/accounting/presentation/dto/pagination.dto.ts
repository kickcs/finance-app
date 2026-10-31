import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsDateString,
  IsArray,
  IsISO8601,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TAG_BOUNDARY_CHARS } from '../../domain/constants/hashtag';

/** Календарный день без времени: границы периода считаются по дням в часовом поясе пользователя. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const VALID_TAG = new RegExp(`^[^${TAG_BOUNDARY_CHARS}]+$`);

/**
 * Массив из query-строки: одно значение, повторяющийся параметр или список через запятую.
 * Пустой результат — это «фильтра нет».
 */
function toStringList(value: unknown, normalize: (item: string) => string = (s) => s) {
  if (value === undefined || value === null) return undefined;
  const items = (Array.isArray(value) ? value : [value]).flatMap((item: unknown) =>
    typeof item === 'string' ? item.split(',').map((part) => normalize(part.trim())) : [item],
  );
  const list = items.filter((item) => item !== '');
  return list.length > 0 ? [...new Set(list)] : undefined;
}

/** Фильтры истории: общие для ленты, итога и выборки массовой правки. */
export class TransactionFilterDto {
  @IsOptional()
  @IsIn(['income', 'expense', 'transfer', 'debt'])
  type?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  debtId?: string;

  /** Строки, не UUID: у встроенных категорий id-слаги вроде `gifts_income`. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) => toStringList(value))
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @Transform(({ value }: { value: unknown }) => toStringList(value))
  accountIds?: string[];

  /** С `#` или без: приводится к виду без решётки. */
  @IsOptional()
  @IsArray()
  @Matches(VALID_TAG, { each: true, message: 'each value in tags must be a single hashtag' })
  @Transform(({ value }: { value: unknown }) =>
    toStringList(value, (tag) => tag.replace(/^#+/, '')),
  )
  tags?: string[];

  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'startDate must be a calendar date (YYYY-MM-DD)' })
  @IsISO8601({ strict: true })
  startDate?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'endDate must be a calendar date (YYYY-MM-DD)' })
  @IsISO8601({ strict: true })
  endDate?: string;
}

export class PaginationDto extends TransactionFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  // Единственный дефолт размера страницы ленты: ValidationPipe с `transform` подставляет его всегда.
  pageSize: number = 20;

  @IsOptional()
  @IsDateString()
  cursorDate?: string;

  @IsOptional()
  @IsDateString()
  cursorCreatedAt?: string;

  @IsOptional()
  @IsUUID()
  cursorId?: string;
}
