import { IsDateString } from 'class-validator';
import { PickType } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';

export class DateRangeDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

/**
 * Cursor-based pagination for account-scoped transaction queries.
 * Reuses pageSize/cursorDate/cursorCreatedAt validation from PaginationDto.
 */
export class AccountPaginationDto extends PickType(PaginationDto, [
  'pageSize',
  'cursorDate',
  'cursorCreatedAt',
] as const) {}
