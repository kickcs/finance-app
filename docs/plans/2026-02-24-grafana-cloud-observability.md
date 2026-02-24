# Grafana Cloud Observability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full observability (metrics, logs, traces) to the finance app via Grafana Cloud with Grafana Alloy agent and Telegram alerting.

**Architecture:** NestJS instrumented with prom-client (metrics), nestjs-pino (structured logs), OpenTelemetry (traces). Grafana Alloy sidecar in Docker collects all signals and pushes to Grafana Cloud. Alerts route to Telegram.

**Tech Stack:** `@willsoto/nestjs-prometheus`, `nestjs-pino`, `pino-http`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, Grafana Alloy, Grafana Cloud Free tier.

**Design doc:** `docs/plans/2026-02-24-grafana-cloud-observability-design.md`

---

### Task 1: Install metrics dependencies and create PrometheusModule

**Files:**
- Modify: `backend/package.json` (add dependencies)
- Create: `backend/src/observability/metrics/metrics.module.ts`
- Create: `backend/src/observability/metrics/metrics.interceptor.ts`
- Create: `backend/src/observability/observability.module.ts`
- Create: `backend/src/observability/index.ts`

**Step 1: Install dependencies**

```bash
cd backend && bun add @willsoto/nestjs-prometheus prom-client
```

**Step 2: Create metrics interceptor**

Create `backend/src/observability/metrics/metrics.interceptor.ts`:

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
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

  private record(method: string, path: string, statusCode: number, start: bigint) {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    this.requestsInFlight.dec();
    this.requestsTotal.inc({ method, path, status_code: statusCode });
    this.requestDuration.observe({ method, path, status_code: statusCode }, duration);
  }
}
```

**Step 3: Create metrics module**

Create `backend/src/observability/metrics/metrics.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsInterceptor } from './metrics.interceptor';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',        // exposed at /api/metrics due to global prefix
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    makeGaugeProvider({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
    }),
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class MetricsModule {}
```

**Step 4: Create observability barrel module**

Create `backend/src/observability/observability.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [MetricsModule],
})
export class ObservabilityModule {}
```

Create `backend/src/observability/index.ts`:

```typescript
export { ObservabilityModule } from './observability.module';
```

**Step 5: Register in AppModule**

Modify `backend/src/app.module.ts` — add `ObservabilityModule` to imports array:

```typescript
import { ObservabilityModule } from './observability';
// ... in imports array:
ObservabilityModule,
```

**Step 6: Verify locally**

```bash
cd backend && bun run build
cd backend && bun run start:dev
# In another terminal:
curl http://localhost:3000/api/metrics
```

Expected: Prometheus text format output with `http_requests_total`, `http_request_duration_seconds`, default `process_*` and `nodejs_*` metrics.

**Step 7: Commit**

```bash
git add backend/src/observability/ backend/package.json backend/bun.lock* backend/src/app.module.ts
git commit -m "feat(observability): add Prometheus metrics with HTTP interceptor"
```

---

### Task 2: Add structured logging with nestjs-pino

**Files:**
- Modify: `backend/package.json` (add dependencies)
- Create: `backend/src/observability/logging/logging.module.ts`
- Modify: `backend/src/observability/observability.module.ts` (add LoggingModule)
- Modify: `backend/src/main.ts` (add pino logger to NestFactory)

**Step 1: Install dependencies**

```bash
cd backend && bun add nestjs-pino pino-http pino
```

**Step 2: Create logging module**

Create `backend/src/observability/logging/logging.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
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
          req(req) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              query: req.query,
              remoteAddress: req.remoteAddress,
            };
          },
          res(res) {
            return { statusCode: res.statusCode };
          },
        },
      },
    }),
  ],
})
export class LoggingModule {}
```

**Step 3: Add LoggingModule to ObservabilityModule**

Modify `backend/src/observability/observability.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { LoggingModule } from './logging/logging.module';

@Module({
  imports: [MetricsModule, LoggingModule],
})
export class ObservabilityModule {}
```

**Step 4: Use pino logger in NestFactory**

Modify `backend/src/main.ts` — add Logger from nestjs-pino:

```typescript
import { Logger } from 'nestjs-pino';

// Inside bootstrap(), after NestFactory.create:
app.useLogger(app.get(Logger));
```

And replace the `console.log` lines at the bottom with:

```typescript
const logger = app.get(Logger);
logger.log(`Application is running on: http://localhost:${port}`);
logger.log(`Swagger docs: http://localhost:${port}/docs`);
```

**Step 5: Install pino-pretty for dev**

```bash
cd backend && bun add -D pino-pretty
```

**Step 6: Verify locally**

```bash
cd backend && bun run build
cd backend && bun run start:dev
# Hit any endpoint, check structured JSON in logs
curl http://localhost:3000/api/health
```

Expected: Pretty-printed logs in dev with request ID, method, URL, status code, response time.

**Step 7: Commit**

```bash
git add backend/src/observability/logging/ backend/src/observability/observability.module.ts backend/src/main.ts backend/package.json backend/bun.lock*
git commit -m "feat(observability): add structured logging with nestjs-pino"
```

---

### Task 3: Add OpenTelemetry tracing

**Files:**
- Modify: `backend/package.json` (add dependencies)
- Create: `backend/src/observability/tracing/tracing.ts` (OTel SDK bootstrap)
- Modify: `backend/src/main.ts` (import tracing before anything else)

**Step 1: Install dependencies**

```bash
cd backend && bun add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-grpc @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/sdk-trace-base
```

**Step 2: Create tracing bootstrap**

Create `backend/src/observability/tracing/tracing.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
const OTEL_SAMPLE_RATE = parseFloat(process.env.OTEL_SAMPLE_RATE || '0.1');

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'finance-backend',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(OTEL_SAMPLE_RATE),
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().catch(console.error);
});
```

**Step 3: Import tracing first in main.ts**

Modify `backend/src/main.ts` — add as the very first import:

```typescript
import './observability/tracing/tracing';
```

This must be the first line before any NestJS imports so OTel can patch modules.

**Step 4: Verify build**

```bash
cd backend && bun run build
```

Expected: Clean build. Tracing won't connect in dev (no Alloy running), but should not crash — OTel gracefully handles missing collector.

**Step 5: Commit**

```bash
git add backend/src/observability/tracing/ backend/src/main.ts backend/package.json backend/bun.lock*
git commit -m "feat(observability): add OpenTelemetry tracing with OTLP export"
```

---

### Task 4: Create Grafana Alloy configuration

**Files:**
- Create: `docker/alloy/config.alloy` (Alloy pipeline config)

**Step 1: Create Alloy config**

Create `docker/alloy/config.alloy`:

```hcl
// ============================================
// Grafana Alloy Configuration for Finance App
// ============================================

// ---- Prometheus: scrape NestJS metrics ----
prometheus.scrape "backend" {
  targets = [{
    __address__ = "finance-backend:3000",
  }]
  metrics_path = "/api/metrics"
  scrape_interval = "15s"
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

// ---- Prometheus: node/system metrics ----
prometheus.exporter.unix "node" {
  set_collectors     = ["cpu", "meminfo", "diskstats", "filesystem", "loadavg", "netdev"]
  filesystem_mount_points_exclude = "^/(sys|proc|dev|host|etc)($|/)"
}

prometheus.scrape "node" {
  targets    = prometheus.exporter.unix.node.targets
  scrape_interval = "15s"
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

// ---- Prometheus: remote write to Grafana Cloud ----
prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_PROMETHEUS_URL")
    basic_auth {
      username = env("GRAFANA_CLOUD_PROMETHEUS_USER")
      password = env("GRAFANA_CLOUD_API_KEY")
    }
  }
}

// ---- Loki: collect Docker container logs ----
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "docker_logs" {
  targets = discovery.docker.containers.targets

  rule {
    source_labels = ["__meta_docker_container_name"]
    target_label  = "container"
    regex         = "/(.*)"
  }
}

loki.source.docker "containers" {
  host       = "unix:///var/run/docker.sock"
  targets    = discovery.relabel.docker_logs.output
  forward_to = [loki.write.grafana_cloud.receiver]
}

loki.write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_LOKI_URL")
    basic_auth {
      username = env("GRAFANA_CLOUD_LOKI_USER")
      password = env("GRAFANA_CLOUD_API_KEY")
    }
  }
}

// ---- Tempo: receive OTLP traces from NestJS ----
otelcol.receiver.otlp "default" {
  grpc {
    endpoint = "0.0.0.0:4317"
  }
}

otelcol.exporter.otlphttp "grafana_cloud" {
  client {
    endpoint = env("GRAFANA_CLOUD_TEMPO_URL")
    auth     = otelcol.auth.basic.grafana_cloud.handler
  }
}

otelcol.auth.basic "grafana_cloud" {
  username = env("GRAFANA_CLOUD_TEMPO_USER")
  password = env("GRAFANA_CLOUD_API_KEY")
}

otelcol.processor.batch "default" {
  output {
    traces = [otelcol.exporter.otlphttp.grafana_cloud.input]
  }
}

otelcol.receiver.otlp.default.output {
  traces = [otelcol.processor.batch.default.input]
}
```

**Step 2: Commit**

```bash
git add docker/alloy/
git commit -m "feat(observability): add Grafana Alloy configuration"
```

---

### Task 5: Add Alloy to Docker Compose and update deployment

**Files:**
- Modify: `docker-compose.prod.yml` (add alloy service + env vars)
- Modify: `.github/workflows/deploy.yml` (add Grafana Cloud env vars, copy alloy config)

**Step 1: Add alloy service to docker-compose.prod.yml**

Add after the frontend service, before `volumes:`:

```yaml
  # Grafana Alloy (observability agent)
  alloy:
    image: grafana/alloy:latest
    container_name: finance-alloy
    restart: always
    volumes:
      - ./docker/alloy/config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
    environment:
      GRAFANA_CLOUD_API_KEY: ${GRAFANA_CLOUD_API_KEY:-}
      GRAFANA_CLOUD_PROMETHEUS_URL: ${GRAFANA_CLOUD_PROMETHEUS_URL:-}
      GRAFANA_CLOUD_PROMETHEUS_USER: ${GRAFANA_CLOUD_PROMETHEUS_USER:-}
      GRAFANA_CLOUD_LOKI_URL: ${GRAFANA_CLOUD_LOKI_URL:-}
      GRAFANA_CLOUD_LOKI_USER: ${GRAFANA_CLOUD_LOKI_USER:-}
      GRAFANA_CLOUD_TEMPO_URL: ${GRAFANA_CLOUD_TEMPO_URL:-}
      GRAFANA_CLOUD_TEMPO_USER: ${GRAFANA_CLOUD_TEMPO_USER:-}
    command:
      - run
      - /etc/alloy/config.alloy
      - --storage.path=/var/lib/alloy/data
    depends_on:
      backend:
        condition: service_healthy
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - finance-network
```

Add `OTEL_EXPORTER_OTLP_ENDPOINT: http://finance-alloy:4317` to backend service environment.

**Step 2: Update deploy.yml**

Add to the `envs` list in the SSH action: `GRAFANA_CLOUD_API_KEY,GRAFANA_CLOUD_PROMETHEUS_URL,GRAFANA_CLOUD_PROMETHEUS_USER,GRAFANA_CLOUD_LOKI_URL,GRAFANA_CLOUD_LOKI_USER,GRAFANA_CLOUD_TEMPO_URL,GRAFANA_CLOUD_TEMPO_USER`

Add corresponding env vars in the `env:` block (from secrets):

```yaml
GRAFANA_CLOUD_API_KEY: ${{ secrets.GRAFANA_CLOUD_API_KEY }}
GRAFANA_CLOUD_PROMETHEUS_URL: ${{ secrets.GRAFANA_CLOUD_PROMETHEUS_URL }}
GRAFANA_CLOUD_PROMETHEUS_USER: ${{ secrets.GRAFANA_CLOUD_PROMETHEUS_USER }}
GRAFANA_CLOUD_LOKI_URL: ${{ secrets.GRAFANA_CLOUD_LOKI_URL }}
GRAFANA_CLOUD_LOKI_USER: ${{ secrets.GRAFANA_CLOUD_LOKI_USER }}
GRAFANA_CLOUD_TEMPO_URL: ${{ secrets.GRAFANA_CLOUD_TEMPO_URL }}
GRAFANA_CLOUD_TEMPO_USER: ${{ secrets.GRAFANA_CLOUD_TEMPO_USER }}
```

Add these to the `.env` heredoc in the deploy script.

Update `scp-action` source to include `docker/alloy/config.alloy`.

Update `docker compose pull` and `up -d` to include `alloy`.

**Step 3: Commit**

```bash
git add docker-compose.prod.yml .github/workflows/deploy.yml
git commit -m "feat(observability): add Grafana Alloy to Docker Compose and CI/CD"
```

---

### Task 6: Set up Grafana Cloud account and configure secrets

**This task is manual (not code).**

**Step 1: Create Grafana Cloud account**

Go to https://grafana.com/products/cloud/ → Sign up for free tier.

**Step 2: Get connection details**

In Grafana Cloud portal → Your stack → Details:
- Prometheus remote write endpoint URL + user ID
- Loki push API endpoint URL + user ID
- Tempo OTLP endpoint URL + user ID
- Create an API key with `MetricsPublisher`, `LogsPublisher`, `TracesPublisher` roles

**Step 3: Create Telegram bot**

1. Message @BotFather on Telegram → `/newbot` → get bot token
2. Create a group/channel, add the bot, get chat_id
3. In Grafana Cloud → Alerting → Contact Points → New → Telegram → configure bot token + chat_id

**Step 4: Add GitHub Actions secrets**

In repo Settings → Secrets → Actions, add:
- `GRAFANA_CLOUD_API_KEY`
- `GRAFANA_CLOUD_PROMETHEUS_URL`
- `GRAFANA_CLOUD_PROMETHEUS_USER`
- `GRAFANA_CLOUD_LOKI_URL`
- `GRAFANA_CLOUD_LOKI_USER`
- `GRAFANA_CLOUD_TEMPO_URL`
- `GRAFANA_CLOUD_TEMPO_USER`

**Step 5: Verify by deploying**

Push to master, verify in Grafana Cloud → Explore:
- Prometheus: see `http_requests_total` metric
- Loki: see container logs
- Tempo: see traces (if sampling hits)

---

### Task 7: Create Grafana dashboards and alert rules

**This task is done in Grafana Cloud UI.**

**Step 1: Overview dashboard**

Create dashboard with panels:
- Request rate (requests/sec) — `rate(http_requests_total[5m])`
- Error rate (%) — `sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100`
- Latency p95 — `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
- Requests in flight — `http_requests_in_flight`

**Step 2: Infrastructure dashboard**

- CPU usage — from node exporter metrics
- Memory usage — `node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes`
- Disk usage — `node_filesystem_avail_bytes`
- Container status — Docker discovery labels

**Step 3: Errors dashboard**

- Log panel with Loki query: `{container="finance-backend"} |= "error" | json`
- Error log rate: `sum(count_over_time({container="finance-backend"} |= "error" [5m]))`
- Top error messages table

**Step 4: Configure alert rules**

In Grafana Cloud → Alerting → Alert Rules:

| Alert | Expression | For | Severity |
|-------|-----------|-----|----------|
| High Error Rate | `sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05` | 5m | Critical |
| Service Down | health check absence | 3 evals | Critical |
| High Latency | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2` | 5m | Warning |
| Disk Full | `node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.15` | 5m | Warning |
| High Memory | `(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9` | 10m | Warning |

Route all to Telegram contact point.

**Step 5: Commit docs update**

Update `CLAUDE.md` with observability section (metrics endpoint, env vars, Alloy config location).

```bash
git add CLAUDE.md
git commit -m "docs: add observability section to CLAUDE.md"
```

---

### Task 8: Verify end-to-end and update CLAUDE.md

**Step 1: Deploy and verify metrics**

After deployment, check Grafana Cloud → Explore → Prometheus:
```
http_requests_total
```

**Step 2: Verify logs**

Grafana Cloud → Explore → Loki:
```
{container="finance-backend"}
```

**Step 3: Verify traces**

Grafana Cloud → Explore → Tempo → Search for `finance-backend` service.

**Step 4: Trigger an alert test**

Verify Telegram bot receives test notification from Grafana Cloud.

**Step 5: Update CLAUDE.md**

Add to the root `CLAUDE.md` under Environment Variables:

```markdown
### Observability (Grafana Cloud)
- Metrics: `GET /api/metrics` (Prometheus format, scraped by Alloy)
- Logs: Structured JSON via `nestjs-pino` → Docker → Alloy → Loki
- Traces: OpenTelemetry SDK → OTLP → Alloy → Tempo
- Agent: Grafana Alloy sidecar in `docker-compose.prod.yml`
- Config: `docker/alloy/config.alloy`
- Dashboards & Alerts: Managed in Grafana Cloud UI
```

```bash
git add CLAUDE.md
git commit -m "docs: add observability details to CLAUDE.md"
```
