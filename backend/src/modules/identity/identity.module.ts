import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

// Domain
import { PROFILE_REPOSITORY } from './domain/repositories/profile.repository.interface';

// Application
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { TokenService, DemoInitializationService, DemoCleanupService } from './application/services';

// Infrastructure
import { ProfileOrmEntity } from './infrastructure/persistence/typeorm';
import { ProfileRepository } from './infrastructure/persistence/repositories';
import { JwtStrategy } from './infrastructure/strategies';

// Presentation
import { AuthController, ProfilesController } from './presentation/controllers';

// External modules
import { AccountingModule } from '../accounting';
import { DebtModule } from '../debt';
import { PlanningModule } from '../planning';

// External ORM entities for cleanup service
import {
  AccountOrmEntity,
  TransactionOrmEntity,
} from '../accounting/infrastructure/persistence/typeorm';
import { DebtOrmEntity } from '../debt/infrastructure/persistence/typeorm';
import { ReminderOrmEntity } from '../planning/infrastructure/persistence/typeorm';

@Module({
  imports: [
    CqrsModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 20, // max 20 requests per minute by default
      },
    ]),
    TypeOrmModule.forFeature([
      ProfileOrmEntity,
      // For cleanup service
      AccountOrmEntity,
      TransactionOrmEntity,
      DebtOrmEntity,
      ReminderOrmEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    // Import other modules for demo initialization
    forwardRef(() => AccountingModule),
    forwardRef(() => DebtModule),
    forwardRef(() => PlanningModule),
  ],
  controllers: [AuthController, ProfilesController],
  providers: [
    // Services
    TokenService,
    DemoInitializationService,
    DemoCleanupService,

    // Strategies
    JwtStrategy,

    // Repositories
    {
      provide: PROFILE_REPOSITORY,
      useClass: ProfileRepository,
    },

    // Command Handlers
    ...CommandHandlers,

    // Query Handlers
    ...QueryHandlers,
  ],
  exports: [JwtModule, PassportModule, PROFILE_REPOSITORY],
})
export class IdentityModule {}
