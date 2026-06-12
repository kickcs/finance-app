import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CreateLinkTokenCommand } from './create-link-token.command';
import {
  type ILinkTokenRepository,
  LINK_TOKEN_REPOSITORY,
} from '../../../domain/repositories/link-token.repository.interface';

const TOKEN_TTL_MS = 15 * 60 * 1000;

@CommandHandler(CreateLinkTokenCommand)
export class CreateLinkTokenHandler implements ICommandHandler<CreateLinkTokenCommand> {
  constructor(
    @Inject(LINK_TOKEN_REPOSITORY) private readonly tokenRepo: ILinkTokenRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: CreateLinkTokenCommand): Promise<{ deepLink: string }> {
    const token = crypto.randomBytes(24).toString('base64url');
    await this.tokenRepo.create(command.userId, token, new Date(Date.now() + TOKEN_TTL_MS));
    const botUsername = this.configService.getOrThrow<string>('TELEGRAM_BOT_USERNAME');
    return { deepLink: `https://t.me/${botUsername}?start=${token}` };
  }
}
