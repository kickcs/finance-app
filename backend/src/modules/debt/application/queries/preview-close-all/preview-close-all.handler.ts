import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PreviewCloseAllQuery } from './preview-close-all.query';
import { DebtSettlementService, type CloseAllPreviewDto } from '../../settlement';

/** Предпросмотр «Закрыть все»: тот же план, что у исполнения, ничего не пишет. */
@QueryHandler(PreviewCloseAllQuery)
export class PreviewCloseAllHandler implements IQueryHandler<PreviewCloseAllQuery> {
  constructor(private readonly settlement: DebtSettlementService) {}

  execute(query: PreviewCloseAllQuery): Promise<CloseAllPreviewDto> {
    return this.settlement.previewCloseAll(query);
  }
}
