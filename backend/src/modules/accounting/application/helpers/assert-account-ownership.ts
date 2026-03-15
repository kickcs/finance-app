import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { type IAccountRepository } from '../../domain/repositories/account.repository.interface';

/**
 * Verifies that the account exists and belongs to the given user.
 * Uses a lightweight COUNT query instead of full entity hydration.
 * Throws NotFoundException if the account doesn't exist.
 * Throws ForbiddenException if the account belongs to a different user.
 */
export async function assertAccountOwnership(
  accountRepository: IAccountRepository,
  accountId: string,
  userId: string,
): Promise<void> {
  const existsForUser = await accountRepository.existsForUser(accountId, userId);

  if (existsForUser) return;

  // Distinguish "not found" from "wrong user" for proper HTTP status
  const exists = await accountRepository.exists(accountId);

  if (!exists) {
    throw new NotFoundException('Account not found');
  }

  throw new ForbiddenException('Access denied');
}
