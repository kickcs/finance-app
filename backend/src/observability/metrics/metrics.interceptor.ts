import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';

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
    const req = context.switchToHttp().getRequest();
    const { method, route } = req;
    const path = route?.path || req.url;

    this.requestsInFlight.inc();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.record(method, path, res.statusCode, start);
        },
        error: (err) => {
          const status = err?.status || err?.getStatus?.() || 500;
          this.record(method, path, status, start);
        },
      }),
    );
  }

  private record(
    method: string,
    path: string,
    statusCode: number,
    start: bigint,
  ) {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    this.requestsInFlight.dec();
    this.requestsTotal.inc({ method, path, status_code: statusCode });
    this.requestDuration.observe(
      { method, path, status_code: statusCode },
      duration,
    );
  }
}
