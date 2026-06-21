import { Injectable, type ExecutionContext } from '@nestjs/common';
import { type I18nResolver } from 'nestjs-i18n';

@Injectable()
export class ProfileLanguageResolver implements I18nResolver {
  resolve(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest<{ user?: { language?: string } }>();
    return req?.user?.language;
  }
}
