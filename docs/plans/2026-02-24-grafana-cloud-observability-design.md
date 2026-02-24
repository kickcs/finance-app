# Grafana Cloud Observability Design

**Date**: 2026-02-24
**Status**: Approved

## Goal

Full observability for the finance app: errors, performance, infrastructure health. Alerts via Telegram.

## Scope

Backend (NestJS) + server infrastructure. Frontend monitoring excluded (can be added later via Grafana Faro).

## Architecture

```
VPS (prod)
├── Frontend (nginx)
├── PostgreSQL
├── NestJS Backend
│   ├── GET /api/metrics    (Prometheus)
│   ├── OTLP traces         (OpenTelemetry → Tempo)
│   └── Structured JSON logs (pino → stdout → Docker)
│
└── Grafana Alloy (sidecar)
    ├── scrape /api/metrics     → Grafana Cloud Prometheus
    ├── collect Docker logs      → Grafana Cloud Loki
    ├── receive OTLP traces      → Grafana Cloud Tempo
    └── node_exporter built-in   → Grafana Cloud Prometheus
```

All data pushed to Grafana Cloud over HTTPS. No inbound ports required.

## Approach: Grafana Alloy

Single agent handles all three signals (metrics, logs, traces) plus infrastructure metrics. Chosen over:
- **OTel Collector**: more complex config, no built-in node_exporter
- **Direct push**: no infrastructure metrics, no Docker log collection

## NestJS Instrumentation

### Metrics (Prometheus)

Library: `@willsoto/nestjs-prometheus` (wraps `prom-client`)

Endpoint: `GET /api/metrics`

| Metric | Type | Purpose |
|--------|------|---------|
| `http_requests_total` | Counter | Total requests by route/method/status |
| `http_request_duration_seconds` | Histogram | Latency per endpoint |
| `http_requests_in_flight` | Gauge | Current active requests |
| `db_query_duration_seconds` | Histogram | SQL query duration |
| `process_*` | Default | Node.js heap, GC, event loop lag |

Implementation: Global `MetricsInterceptor` captures HTTP request duration and status.

### Logs (Structured JSON)

Library: `nestjs-pino` + `pino`

Every request auto-logged with: `requestId`, `method`, `url`, `statusCode`, `responseTime`.

Format:
```json
{"level":"info","time":1708790400,"requestId":"abc-123","method":"POST","url":"/api/transactions","statusCode":201,"responseTime":45}
```

Replaces all `console.log` with structured pino logger. Errors include stack traces.

### Traces (OpenTelemetry)

Libraries: `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`

Auto-instrumentation covers:
- HTTP incoming/outgoing requests
- PostgreSQL queries (pg driver)
- Express middleware chain

Sampling: 10% (sufficient for diagnostics, keeps costs low).

OTLP export to Alloy on `localhost:4317` (gRPC).

## Grafana Alloy Configuration

Docker sidecar in `docker-compose.prod.yml`:
- Image: `grafana/alloy:latest`
- Mounts: Docker socket (for log collection), config file
- ~50-100MB RAM overhead

Config components:
1. `prometheus.scrape` → NestJS `/api/metrics` every 15s
2. `loki.source.docker` → tail all container logs, label by container name
3. `otelcol.receiver.otlp` → gRPC :4317 for traces
4. `prometheus.exporter.unix` → CPU, RAM, disk, network
5. Remote write to Grafana Cloud endpoints (Prometheus, Loki, Tempo)

## Grafana Cloud Setup

- Free tier: 10k metrics, 50GB logs/month, 50GB traces/month
- Credentials stored in `.env` on server: `GRAFANA_CLOUD_API_KEY`, `GRAFANA_CLOUD_PROMETHEUS_URL`, `GRAFANA_CLOUD_LOKI_URL`, `GRAFANA_CLOUD_TEMPO_URL`, `GRAFANA_CLOUD_USER`
- Passed to Alloy via Docker environment variables

## Dashboards

Three dashboards provisioned in Grafana Cloud:

1. **Overview**: request rate, error rate, latency p50/p95/p99, active connections
2. **Infrastructure**: CPU, RAM, disk usage, container status, postgres connections
3. **Errors**: error logs timeline, top error messages, error rate by endpoint

## Alerting → Telegram

Contact point: Telegram Bot (BotFather → bot token + chat_id in Grafana Cloud).

| Alert | Condition | Severity |
|-------|-----------|----------|
| High error rate | >5% 5xx over 5 min | Critical |
| Service down | Health check fail 3x | Critical |
| High latency | p95 > 2s over 5 min | Warning |
| Disk full | >85% usage | Warning |
| High memory | >90% RAM over 10 min | Warning |

## Environment Variables (new)

```bash
# Added to server .env
GRAFANA_CLOUD_API_KEY=
GRAFANA_CLOUD_PROMETHEUS_URL=
GRAFANA_CLOUD_PROMETHEUS_USER=
GRAFANA_CLOUD_LOKI_URL=
GRAFANA_CLOUD_LOKI_USER=
GRAFANA_CLOUD_TEMPO_URL=
GRAFANA_CLOUD_TEMPO_USER=
TELEGRAM_BOT_TOKEN=       # for alerting
TELEGRAM_CHAT_ID=         # for alerting
```

## Security

- `/api/metrics` endpoint: only accessible internally (not exposed in Docker ports)
- Alloy communicates with NestJS over internal Docker network
- Grafana Cloud auth via API key (not basic auth)
- Docker socket mount is read-only

## Impact

- ~50-100MB additional RAM on VPS (Alloy)
- No changes to frontend
- NestJS port remains 3000 (no conflict — Grafana is in cloud)
- Deployment pipeline unchanged (Alloy pulls config on restart)
