import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { IncomingMessage, ServerResponse } from 'http';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        // Synchronous read — ConfigService unavailable before DI container resolves
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        autoLogging: true,
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          censor: '[REDACTED]',
        },
        serializers: {
          req(req: IncomingMessage & { id?: string; remoteAddress?: string }) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              remoteAddress: req.remoteAddress,
            };
          },
          res(res: ServerResponse) {
            return { statusCode: res.statusCode };
          },
        },
      },
    }),
  ],
})
export class LoggingModule {}
