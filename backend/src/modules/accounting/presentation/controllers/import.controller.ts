import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import { BulkImportDto } from '../dto';
import { BulkImportCommand } from '../../application/commands';

@Controller('import')
export class ImportController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('transactions')
  @HttpCode(HttpStatus.OK)
  async importTransactions(
    @CurrentUser('sub') userId: string,
    @Body() dto: BulkImportDto,
  ): Promise<{
    importedCount: number;
    categoriesCreated: string[];
    accountsCreated: string[];
  }> {
    return this.commandBus.execute(new BulkImportCommand(userId, dto.transactions));
  }
}
