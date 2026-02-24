import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap, finalize } from 'rxjs';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';
import { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,
    @InjectMetric('http_requests_in_flight')
    private readonly requestsInFlight: Gauge<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;
    const path = req.route?.path ? String(req.route.path) : this.sanitizePath(req.url);

    this.requestsInFlight.inc();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.record(method, path, res.statusCode, start);
        },
        error: (err: { status?: number; getStatus?: () => number }) => {
          const status = err?.status ?? err?.getStatus?.() ?? 500;
          this.record(method, path, status, start);
        },
      }),
      finalize(() => {
        this.requestsInFlight.dec();
      }),
    );
  }

  private sanitizePath(url: string): string {
    const withoutQuery = url.split('?')[0];
    return withoutQuery.length > 100 ? withoutQuery.slice(0, 100) : withoutQuery;
  }

  private record(method: string, path: string, statusCode: number, start: bigint) {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    this.requestsTotal.inc({ method, path, status_code: statusCode });
    this.requestDuration.observe({ method, path, status_code: statusCode }, duration);
  }
}
