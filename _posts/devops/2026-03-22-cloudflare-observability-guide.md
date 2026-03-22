---
title: "Cloudflare Observability Guide"
date: 2026-03-22 11:24:00 +0900
tags: [cloudflare, observability, workers, logpush, otel, devops]
---


# Cloudflare Observability Guide
_Last reviewed: 2026-03-22_

This guide explains what Cloudflare Observability includes today, how each part works, and how to apply it to your own programs and services.

---

## 1. What “Observability” means in Cloudflare

In Cloudflare, **Observability** is not one single feature. It is a collection of tools for answering questions like:

- Is my service healthy?
- Are users getting errors?
- Where is latency coming from?
- Did a deployment break something?
- Is Cloudflare blocking traffic or is my origin failing?
- Who changed a setting in the account?
- How do I export telemetry into Grafana, Datadog, Honeycomb, Sentry, Splunk, or my own pipeline?

Depending on which Cloudflare products you use, the **Observability** or related menus usually include some combination of:

- **Analytics dashboards**
- **Workers metrics**
- **Workers logs**
- **Real-time logs / `wrangler tail`**
- **Workers traces**
- **OpenTelemetry export**
- **Tail Workers**
- **Workers Logpush**
- **Cloudflare Logs / Logpush**
- **Health Checks**
- **Notifications**
- **Audit Logs**
- **GraphQL Analytics API**
- **Tunnel (`cloudflared`) metrics**
- **Workers Analytics Engine** for custom application metrics

The most important idea is this:

> Cloudflare gives you both **native dashboards** and **export/programmatic paths**.  
> Use native dashboards for fast diagnosis, and exports/APIs for long-term operations, alerting, compliance, and cross-system correlation.

---

## 2. The Cloudflare observability toolbox at a glance

| Need | Best Cloudflare feature |
|---|---|
| See traffic, status codes, bandwidth, cache behavior | Analytics dashboards / GraphQL Analytics API |
| Debug a Worker right now | Real-time logs / `wrangler tail` |
| Store and query Worker logs in Cloudflare | Workers Logs |
| Export Worker logs/traces to external platforms | OpenTelemetry export or Workers Logpush |
| Build custom, per-tenant or per-feature app metrics | Workers Analytics Engine |
| Monitor origin uptime and latency | Health Checks + Health Checks Analytics |
| Monitor Cloudflare Tunnel health | `cloudflared` Prometheus metrics |
| Export edge/security/HTTP/Zero Trust logs | Logpush |
| Alert on incidents | Notifications |
| See who changed account settings | Audit Logs |

---

## 3. What is included in Cloudflare Observability

## 3.1 Workers Observability

If your program runs on **Cloudflare Workers**, this is the most important area.

Cloudflare Workers observability includes:

- **Metrics and analytics**
- **Workers Logs**
- **Real-time logs**
- **Tail Workers**
- **Workers Logpush**
- **Traces**
- **Source maps and stack traces**
- **OpenTelemetry export**

Cloudflare says Workers observability is designed to help you understand application performance, diagnose issues, and inspect request flows, either inside Cloudflare or in your existing observability stack. Newly created Workers have observability enabled by default for Workers Logs. Cloudflare also documents native support for exporting Workers traces and logs to OpenTelemetry-compatible destinations.  
Source docs:
- https://developers.cloudflare.com/workers/observability/
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- https://developers.cloudflare.com/workers/observability/traces/
- https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/

### What to use when

- Use **Metrics** when you want request volume, CPU, duration, errors, and trend graphs.
- Use **Workers Logs** when you want persisted logs in Cloudflare.
- Use **Real-time logs / `wrangler tail`** when you are actively debugging.
- Use **Traces** when you want request flow visibility and latency breakdowns.
- Use **OpenTelemetry export** when you already use Grafana Cloud, Honeycomb, Sentry, Axiom, or another OTel backend.
- Use **Tail Workers** when you want to transform or route Worker telemetry yourself.
- Use **Workers Analytics Engine** when you want **custom application metrics**, not raw logs.

---

## 3.2 Analytics dashboards

Cloudflare has several built-in dashboards for request/traffic analytics.

These dashboards are good for:

- traffic volume
- status codes
- subrequests
- bandwidth
- product-specific breakdowns
- historical trends

For Workers specifically, Cloudflare documents two graphical sources:

- **Workers metrics**
- **zone-based Workers analytics**

Workers metrics show performance and usage for your Worker. Zone analytics can help you inspect subrequests, bandwidth, status codes, and total requests. Cloudflare also notes that the Workers tab in Analytics is especially useful for spotting origin-side issues such as spikes in 500s and understanding traffic going to origin.  
Source docs:
- https://developers.cloudflare.com/workers/observability/metrics-and-analytics/
- https://developers.cloudflare.com/analytics/account-and-zone-analytics/analytics-with-workers/

### Good use cases
- “Did requests spike after deploy?”
- “Are 5xx errors coming from the Worker runtime or the origin?”
- “Is my Worker making too many subrequests?”
- “Is cache helping origin load?”

---

## 3.3 Workers Logs

Workers Logs is Cloudflare’s persisted log storage and query interface for Worker-emitted logs.

Cloudflare states that Workers Logs automatically collects, stores, filters, and analyzes logging data emitted from Workers, including:

- invocation logs
- custom logs
- errors
- uncaught exceptions

Cloudflare also states:

- all newly created Workers have observability enabled by default
- the default `head_sampling_rate` is `1` (100%) if unspecified
- Workers Free has 3-day retention
- Workers Paid has 7-day retention
- max retention period is 7 days
- if account daily volume limits are exceeded, Cloudflare applies sampling for the remainder of the day

Source docs:
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/

### When to use Workers Logs
Use Workers Logs when:

- you want a simple built-in log viewer in Cloudflare
- you need persisted logs for debugging and short-term analysis
- your team does not yet need a full external logging platform
- you want structured logs from your Worker with query/filter support

### Basic Worker logging example

```js
export default {
  async fetch(request, env) {
    const start = Date.now();

    console.log(JSON.stringify({
      event: "request_started",
      method: request.method,
      path: new URL(request.url).pathname,
      colo: request.cf?.colo ?? "unknown"
    }));

    try {
      const response = await fetch(request);
      const durationMs = Date.now() - start;

      console.log(JSON.stringify({
        event: "request_finished",
        status: response.status,
        durationMs
      }));

      return response;
    } catch (err) {
      console.error(JSON.stringify({
        event: "request_failed",
        message: String(err)
      }));
      throw err;
    }
  }
};
```

### Best practice
Prefer **structured JSON logs** instead of free-form text. That makes filtering and later export much more useful.

### Control sampling in Wrangler

```jsonc
{
  "observability": {
    "enabled": true,
    "head_sampling_rate": 0.1
  }
}
```

or:

```toml
[observability]
enabled = true
head_sampling_rate = 0.1
```

Use lower sampling in high-volume production services if log cost or noise becomes a problem.

---

## 3.4 Real-time logs and `wrangler tail`

Cloudflare’s real-time log path is for **live debugging**.

You can:

- watch logs in the dashboard
- run `npx wrangler tail`
- pipe structured output into tools like `jq`

Cloudflare documents that real-time logs:

- are near-real-time
- do **not** store logs
- may enter sampling mode on high-volume Workers
- can be filtered
- support up to 10 simultaneous viewers
- show Durable Object logs in the dashboard as well

Source docs:
- https://developers.cloudflare.com/workers/observability/logs/real-time-logs/

### Example

```bash
npx wrangler tail
```

Pipe through `jq`:

```bash
npx wrangler tail | jq .event.request.url
```

Here, `jq` is a command-line JSON processor. It reads the JSON output from `wrangler tail` and extracts only the `.event.request.url` field, which is the request URL from each tailed event.

### When to use it
Use real-time logs when:

- you are reproducing a bug
- a new deploy looks wrong
- you need immediate feedback from a Worker
- you are iterating locally against a deployed Worker

### Do not use it as your main logging system
Because it is not a persisted log store, it is best for **debugging sessions**, not long-term operations.

---

## 3.5 Workers traces

Cloudflare Workers tracing is for request-flow visibility.

Cloudflare documents that Workers tracing follows **OpenTelemetry (OTel)** standards and that the default trace sampling rate is `1` when tracing is enabled.

Source docs:
- https://developers.cloudflare.com/workers/observability/traces/
- https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/

### When tracing is most useful
Use tracing when you want to answer:

- “Where is latency happening?”
- “Did the Worker runtime spend time on CPU or waiting on origin/API/database?”
- “Which downstream dependency is slow?”
- “How does one request flow across multiple services?”

### Enable traces in Wrangler

```jsonc
{
  "observability": {
    "traces": {
      "enabled": true,
      "head_sampling_rate": 0.05
    }
  }
}
```

or:

```toml
[observability.traces]
enabled = true
head_sampling_rate = 0.05
```

### Good production pattern
- start with **5% or 10% trace sampling**
- increase sampling for critical endpoints temporarily during an incident
- combine traces with logs for root-cause analysis

---

## 3.6 OpenTelemetry export

This is one of the most important integrations if you already have an observability stack.

Cloudflare documents that Workers can export OTel-compliant telemetry to any destination with an OTel endpoint, including examples like Honeycomb, Grafana Cloud, Axiom, and Sentry-compatible setups. Cloudflare also documents the `persist` option, which can be set to `false` if you want to export without storing in Cloudflare’s own dashboard-backed persistence.  
Source docs:
- https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/
- https://developers.cloudflare.com/workers/observability/traces/

### Example configuration

```jsonc
{
  "observability": {
    "traces": {
      "enabled": true,
      "destinations": ["tracing-destination-name"],
      "head_sampling_rate": 0.05,
      "persist": false
    },
    "logs": {
      "enabled": true,
      "destinations": ["logs-destination-name"],
      "head_sampling_rate": 0.2,
      "persist": false
    }
  }
}
```

### When you should use OTel export
Use OTel export if:

- you already run Grafana Cloud / Honeycomb / Axiom / Sentry / another OTel backend
- you want a single observability backend for Cloudflare plus non-Cloudflare services
- your incident process already relies on central dashboards and alerts
- you want cross-service traces beyond Cloudflare-only views

### Recommended architecture
- Cloudflare Worker emits logs/traces
- Cloudflare exports OTel telemetry
- external backend handles:
  - retention
  - alerting
  - long-term dashboards
  - correlation with database/app/server metrics

---

## 3.7 Source maps and stack traces

If your Worker is bundled, transpiled, or minified, source maps are critical.

Cloudflare documents that source maps let stack traces point back to your original code, and that Wrangler can upload them automatically during deployment.

Source docs:
- https://developers.cloudflare.com/workers/observability/source-maps/

### Enable source maps

```jsonc
{
  "upload_source_maps": true
}
```

or:

```toml
upload_source_maps = true
```

### Why this matters
Without source maps, production stack traces often point to minified bundles and useless line numbers.  
With source maps, incidents become much faster to debug.

### Recommendation
Turn this on for every serious Worker application.

---

## 3.8 Tail Workers

A Tail Worker receives telemetry about execution of another Worker and can process it.

Cloudflare documents that Tail Workers can process logs for alerts, debugging, or analytics, and that they are available on Workers Paid and Enterprise plans.

Source docs:
- https://developers.cloudflare.com/workers/observability/logs/tail-workers/

### When Tail Workers are useful
Use Tail Workers when you want to:

- transform telemetry before forwarding it
- filter noise before sending to external systems
- build your own alerting or analytics pipeline
- route telemetry to an HTTP endpoint you control

### Producer configuration example

```jsonc
{
  "tail_consumers": [
    {
      "service": "my-tail-worker"
    }
  ]
}
```

or:

```toml
[[tail_consumers]]
service = "my-tail-worker"
```

### Conceptual pattern
- Your main Worker handles production traffic
- Cloudflare forwards execution telemetry to a Tail Worker
- The Tail Worker:
  - filters by route/status/error type
  - sends selected events to Slack, a webhook, or storage
  - creates lightweight custom analytics

### Good use cases
- alert only on 5xx + specific routes
- redact sensitive fields before forwarding logs
- sample noisy endpoints differently from critical endpoints

---

## 3.9 Workers Logpush

Workers Logpush is for exporting Worker trace event logs to a supported destination.

Cloudflare documents dashboard setup and cURL/API setup for Workers trace events, including export to R2 and other supported destinations.

Source docs:
- https://developers.cloudflare.com/workers/observability/logs/logpush/
- https://developers.cloudflare.com/logs/logpush/
- https://developers.cloudflare.com/logs/logpush/logpush-job/api-configuration/

### When to use Workers Logpush vs OTel export

Use **Workers Logpush** when:

- you want raw Worker trace event logs delivered to storage/SIEM
- your log pipeline is file/object-storage based
- you want low-friction delivery into R2/S3/SIEM destinations

Use **OTel export** when:

- you want first-class observability in an OTel-native platform
- you care more about traces and live dashboards than object-delivered log batches

### Example cURL pattern
Cloudflare documents creating Logpush jobs via API. In practice, the flow is:

1. choose account or zone scope
2. choose destination
3. verify destination ownership
4. choose dataset
5. create the job
6. monitor job health

### Important operational note
Cloudflare’s Logpush Health Dashboards docs explicitly warn that Logpush **cannot backfill** dropped data. If logs are dropped because a job is disabled or failing, that data is gone.  
Source:
- https://developers.cloudflare.com/logs/logpush/logpush-health/

That means Logpush health alerting is not optional for important environments.

---

## 3.10 Cloudflare Logs / Logpush (beyond Workers)

Cloudflare Logs is the broader log export family across Cloudflare products.

Cloudflare documents that Logpush delivers logs in batches as quickly as possible and supports many datasets. Dataset availability depends on plan and product. Zone-scoped `http_requests` is available in both Logpush and legacy Logpull, while most other datasets are Logpush-only.

Source docs:
- https://developers.cloudflare.com/logs/
- https://developers.cloudflare.com/logs/logpush/
- https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/

### Examples of useful datasets
Depending on your plan/products, common datasets include:

- HTTP requests
- firewall events
- audit logs
- Workers trace events
- Zero Trust / Cloudflare One logs
- DNS logs
- other product-specific datasets

### Use Logpush when you need
- central retention
- SIEM ingestion
- compliance copies
- correlation with origin/app logs
- advanced search and dashboards outside Cloudflare

### Strong recommendation
If your services matter in production, send the important datasets to long-term storage or a SIEM.

---

## 3.11 Logpush health dashboards and notifications

Cloudflare provides health dashboards for Logpush jobs.

Cloudflare documents that the dashboard helps you monitor delivery status, diagnose issues, and understand data volume being sent to destinations. It also warns that once Logpush data is dropped, it is permanently lost because Logpush cannot backfill it.

Source docs:
- https://developers.cloudflare.com/logs/logpush/logpush-health/
- https://developers.cloudflare.com/logs/logpush/alerts-and-analytics/

### Operational advice
For every important Logpush job:

- enable health notifications
- create a named owner/team
- document destination credentials
- test the destination regularly
- treat job failure as a production issue

---

## 3.12 GraphQL Analytics API

Cloudflare’s GraphQL Analytics API is the main programmatic analytics interface for many Cloudflare datasets.

Cloudflare states that the GraphQL Analytics API provides data about HTTP requests passing through Cloudflare and data from specific products like Firewall and Load Balancing, and lets you select datasets, filter, aggregate, and integrate results with other applications.

Source docs:
- https://developers.cloudflare.com/analytics/graphql-api/
- https://developers.cloudflare.com/analytics/graphql-api/get-started/
- https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/

### Use GraphQL Analytics API when
- you want dashboards outside Cloudflare
- you need scheduled reporting
- you want to compute your own aggregates
- you want to join Cloudflare analytics with your own systems
- you want to build custom internal tools

### Example: Workers metrics via GraphQL
Cloudflare documents querying Workers metrics over a specified period, with metrics like requests, errors, subrequests, and quantiles such as CPU time.

Conceptually, use GraphQL to ask:
- requests over time
- errors over time
- CPU p50 / p99
- subrequests
- grouped by script / datetime / status

### Endpoint
Cloudflare documents this GraphQL endpoint:

```text
https://api.cloudflare.com/client/v4/graphql
```

### Example request shape

```bash
curl https://api.cloudflare.com/client/v4/graphql   -H "Authorization: Bearer <API_TOKEN>"   -H "Content-Type: application/json"   --data '{
    "query": "query($accountTag: string, $scriptName: string, $datetimeStart: string, $datetimeEnd: string) { viewer { accounts(filter: {accountTag: $accountTag}) { workersInvocationsAdaptive(limit: 100, filter: {scriptName: $scriptName, datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd}) { sum { requests errors subrequests } quantiles { cpuTimeP50 cpuTimeP99 } dimensions { datetime scriptName status } } } } }",
    "variables": {
      "accountTag": "<ACCOUNT_ID>",
      "scriptName": "<WORKER_NAME>",
      "datetimeStart": "2026-03-21T00:00:00Z",
      "datetimeEnd": "2026-03-22T00:00:00Z"
    }
  }'
```

### When GraphQL is the right tool
Use GraphQL when dashboard screenshots are not enough and you need data to drive:
- daily reports
- custom alerting jobs
- chargeback dashboards
- executive availability summaries
- team-level scorecards

---

## 3.13 Notifications

Cloudflare Notifications is the native alerting system for many Cloudflare product events.

Cloudflare documents:
- notifications are available on all plans
- free plans can set up email notifications
- business and higher can use PagerDuty
- professional and higher can use webhooks
- webhook destinations can be created in the dashboard
- generic webhooks send JSON payloads with fields like `name`, `text`, `data`, `ts`, `account_id`, `policy_id`, and `alert_type`

Source docs:
- https://developers.cloudflare.com/notifications/
- https://developers.cloudflare.com/notifications/get-started/
- https://developers.cloudflare.com/notifications/get-started/configure-webhooks/
- https://developers.cloudflare.com/notifications/reference/webhook-payload-schema/

### Why notifications matter
Dashboards are passive. Alerts are active.

Use Notifications for:
- Logpush job failures
- origin health failures
- DDoS/security signals
- certificate issues
- plan/product-specific incidents you need to react to

### Recommended destinations
- email for basic safety net
- webhook to Slack/Teams/incident router
- PagerDuty for serious production systems

### Example webhook receiver idea
Create a small service or Worker that accepts Cloudflare webhook JSON and:

- routes critical alerts to PagerDuty
- suppresses known maintenance windows
- enriches the payload with service owner info
- logs alerts into your incident database

---

## 3.14 Audit Logs

Audit Logs are for **change tracking**, not request telemetry.

Cloudflare documents that Audit Logs v2 is account-based and captures:

- user-initiated actions from dashboard and API
- system-initiated actions
- actor, method, interface, resources, timestamp
- 18 months retention
- dashboard queries limited to 90 days in the UI for performance
- full retention available via API or Logpush
- Logpush can keep logs beyond 18 months for Enterprise customers

Source docs:
- https://developers.cloudflare.com/fundamentals/account/account-security/audit-logs/
- https://developers.cloudflare.com/api/resources/audit_logs/

### When Audit Logs help
Use Audit Logs to answer:
- “Who changed this zone setting?”
- “Was this configuration changed by dashboard or API?”
- “When did a token or member action happen?”
- “Did Cloudflare or a human trigger this?”
- “Can we prove change history for compliance?”

### Example API endpoint from docs

```text
https://api.cloudflare.com/client/v4/accounts/{account_id}/logs/audit
```

### Why every production team should care
A lot of “outages” are actually config changes.  
Audit Logs are essential for:
- root-cause analysis
- change control
- security investigations
- compliance evidence

---

## 3.15 Health Checks and Health Checks Analytics

Health Checks monitor origin availability from Cloudflare’s edge.

Cloudflare documents that standalone Health Checks monitor an IP or hostname, notify you in near real-time when there is a problem, and support configuration options like response codes, protocol types, intervals, and request path targeting. Health Checks Analytics can show uptime, latency, failure reason, and detailed event logs.  
Source docs:
- https://developers.cloudflare.com/health-checks/
- https://developers.cloudflare.com/smart-shield/configuration/health-checks/analytics/
- https://developers.cloudflare.com/health-checks/how-to/health-checks-notifications/

### Use Health Checks when
your app is behind Cloudflare but the real failure point may be:
- your origin server
- your upstream API
- your load balancer
- your network path
- a firewall issue

### Health Checks are especially useful for
- APIs behind Cloudflare
- websites with origin clusters
- services where uptime and latency matter
- proving whether the origin was unhealthy before users complained

### Good configuration pattern
- check a **real health endpoint**, not `/`
- use a path like `/healthz` or `/ready`
- validate expected response code(s)
- choose intervals based on service criticality
- enable notifications

### What analytics can tell you
Cloudflare documents:
- uptime percentage
- latency over time
- failure reason breakdown
- event log details including round trip time, status code, and waterfall data

### Important distinction
Health Checks are not the same thing as general app logs or traces. They answer:
**“Is the origin reachable and responding correctly?”**

---

## 3.16 Cloudflare Tunnel / `cloudflared` metrics

If your service is exposed through **Cloudflare Tunnel**, you also need connector-side metrics.

Cloudflare documents that when `cloudflared` runs, it starts an HTTP metrics endpoint that exposes metrics in Prometheus format. In non-container environments the default address is typically `127.0.0.1:<PORT>/metrics`, with ports commonly chosen from 20241 to 20245 unless unavailable.

Source docs:
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/monitor-tunnels/metrics/
- https://developers.cloudflare.com/cloudflare-one/tutorials/grafana/

### Example

```bash
cloudflared tunnel --metrics 127.0.0.1:60123 run my-tunnel
```

Then scrape:

```text
http://127.0.0.1:60123/metrics
```

### When to monitor tunnel metrics
Use these metrics when:
- your app is healthy locally but unreachable externally
- you need to distinguish connector problems from app problems
- you run multiple tunnel replicas
- you want Grafana dashboards for tunnel health

### Recommended setup
- scrape `cloudflared` with Prometheus
- graph in Grafana
- alert on connector instability / missing targets / unusual throughput patterns

---

## 3.17 Zero Trust logs

If you use Cloudflare One / Zero Trust features, Cloudflare documents that Zero Trust logs can be exported with Logpush to third-party storage or SIEMs, and notes that this is Enterprise-only. Cloudflare also notes a dashboard limitation: R2 is not supported as a destination for Zero Trust logs in the dashboard, but can be configured via API.

Source docs:
- https://developers.cloudflare.com/cloudflare-one/insights/logs/logpush/

### Use cases
- Access login audit trails
- DNS activity review
- secure access investigations
- device/user security workflows
- SIEM integration

---

## 3.18 Web Analytics

Cloudflare Web Analytics is more website analytics than operational observability, but it is still useful for frontend visibility.

Cloudflare documents that Web Analytics is privacy-first and helps you understand the performance of web pages as experienced by visitors, without requiring Cloudflare proxying for all sites.

Source docs:
- https://developers.cloudflare.com/web-analytics/
- https://developers.cloudflare.com/web-analytics/about/

### Use it for
- page-level performance trends
- frontend experience visibility
- simple audience and page behavior signals

### Do not confuse it with
- backend/service health
- origin telemetry
- Worker logs
- incident forensics

---

## 3.19 Workers Analytics Engine

Workers Analytics Engine (WAE) is one of the best tools for “observability with my programs” when you mean **custom application telemetry**.

Cloudflare documents that WAE provides unlimited-cardinality analytics at scale, with a built-in API to write data points from Workers and a SQL API to query them. Cloudflare specifically calls out use cases like exposing analytics to your own customers, building usage-based billing, and understanding service health on a per-customer basis.  
Source docs:
- https://developers.cloudflare.com/analytics/analytics-engine/
- https://developers.cloudflare.com/analytics/analytics-engine/get-started/
- https://developers.cloudflare.com/workers/examples/analytics-engine/

### This is different from logs
Use **logs** for detailed event-by-event debugging.  
Use **Analytics Engine** for fast aggregate queries like:
- requests per tenant
- errors per customer
- p95 latency by endpoint
- model usage per API key
- daily usage for billing

### Configure a dataset binding

```jsonc
{
  "analytics_engine_datasets": [
    {
      "binding": "ANALYTICS",
      "dataset": "service_metrics"
    }
  ]
}
```

or:

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "service_metrics"
```

### Example Worker instrumentation

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const started = Date.now();

    let status = 500;

    try {
      const response = await fetch(request);
      status = response.status;

      return response;
    } finally {
      const duration = Date.now() - started;

      env.ANALYTICS.writeDataPoint({
        blobs: [
          url.pathname,
          String(status),
          request.headers.get("cf-connecting-country") ?? "unknown"
        ],
        doubles: [duration, 1],
        indexes: [url.hostname]
      });
    }
  }
};
```

### Query it with SQL API

```bash
curl "https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql"   --header "Authorization: Bearer <API_TOKEN>"   --data "SELECT blob1 AS path, blob2 AS status, AVG(double1) AS avg_duration_ms, SUM(double2) AS requests FROM service_metrics GROUP BY path, status ORDER BY requests DESC LIMIT 50"
```

### Why this matters for your programs
WAE is ideal when you want:
- **per-customer usage analytics**
- **billing metrics**
- **business KPIs**
- **fast aggregate monitoring**
- **high-cardinality dimensions** without shipping every event to an external APM

---

## 4. How to use Cloudflare Observability for your services

This section is the practical answer to:  
**“How should I use this for my services?”**

## 4.1 If your program runs on Cloudflare Workers

Recommended baseline:

1. Enable **Workers Logs**
2. Turn on **source maps**
3. Use **real-time logs / `wrangler tail`** during development and incident response
4. Enable **traces**
5. Export to **OTel** if you already use an external platform
6. Add **Workers Analytics Engine** for custom business/application metrics

### Recommended minimal Wrangler config

```jsonc
{
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-03-22",
  "upload_source_maps": true,
  "observability": {
    "enabled": true,
    "head_sampling_rate": 0.2,
    "traces": {
      "enabled": true,
      "head_sampling_rate": 0.05
    }
  }
}
```

### What to log
In your Worker, log:
- request id / Ray ID if available to you in context
- route/path
- upstream target
- status
- latency
- customer/tenant id where appropriate
- feature flag / deployment version when useful

Do **not** log secrets, auth tokens, raw cookies, or sensitive personal data.

### What to measure with Analytics Engine
Create custom metrics for:
- requests per tenant
- error count per API key
- latency by route
- cache bypass rate
- model/tool usage for AI endpoints
- billable events

---

## 4.2 If your program is an API or web service behind Cloudflare, but runs on your own servers

Recommended stack:

- **Cloudflare Analytics dashboards** for edge traffic patterns
- **Health Checks** for origin uptime and latency
- **Logpush** for HTTP requests / firewall events / security logs
- **Audit Logs** for configuration changes
- your own origin logs + APM for application internals

### Why this combination works
Cloudflare sees the edge side:
- requests
- caching
- WAF behavior
- security actions
- user-facing status codes

Your origin sees:
- app exceptions
- DB latency
- background jobs
- business logic failures

You need both.

### Recommended architecture
- Cloudflare in front of app
- Logpush sends HTTP/firewall logs to storage or SIEM
- origin logs go to your log platform
- dashboards correlate Cloudflare edge events with origin app errors

### Example questions this setup answers
- “Were users blocked by WAF or rate limiting?”
- “Did origin start timing out?”
- “Did status codes worsen before or after a deploy?”
- “Was there attack traffic during the incident?”

---

## 4.3 If you use Cloudflare Tunnel (`cloudflared`)

Recommended stack:

- `cloudflared` **Prometheus metrics**
- your application logs
- Health Checks for the app/origin if applicable
- dashboard analytics for user-facing traffic
- Notifications for failures

### Why this matters
Tunnel issues can look like application issues.  
Scraping `cloudflared` metrics helps you distinguish:

- app healthy, connector unhealthy
- connector healthy, origin unhealthy
- origin healthy, security/routing issue elsewhere

### Best practice
Put tunnel metrics into the same Grafana/Prometheus environment as:
- node/container metrics
- app metrics
- reverse proxy metrics
- origin latency metrics

That gives you one place to diagnose edge-to-origin path health.

---

## 4.4 If you already use Grafana / Datadog / Honeycomb / Sentry / Splunk

Use Cloudflare as a telemetry source, not a silo.

### Preferred approach
- export **Workers traces/logs** using **OTel**
- export Cloudflare edge/security logs using **Logpush**
- pull analytics through **GraphQL API** where needed
- ingest everything into your existing platform

### Suggested mapping
- **OTel export** → traces and Worker logs
- **Logpush** → edge/security/request datasets
- **GraphQL** → aggregates for dashboards/reports
- **Audit Logs** → security/compliance stream

### Why this is the strongest setup
You get:
- centralized retention
- organization-wide alerting
- cross-service traces
- unified incident dashboards
- better correlation with database and application metrics

---

## 4.5 If you need customer-facing analytics or usage-based billing

Use **Workers Analytics Engine**.

### Why not plain logs?
Because billing and per-customer usage questions are aggregate queries, not raw log inspection.

### Good WAE dimensions
Use `blobs` for:
- customer id
- endpoint
- plan
- region
- model/feature name

Use `doubles` for:
- requests
- bytes
- duration
- billable units
- token counts
- cost estimate

### Example data model
- `blob1` = customer_id
- `blob2` = endpoint
- `blob3` = status
- `double1` = latency_ms
- `double2` = request_count
- `double3` = tokens_used

Then query:
- top customers by usage
- p95 latency by customer
- errors by plan
- billable units per day

---

## 4.6 If you just need a good baseline and do not want to overbuild

Use this starter package:

### For Workers
- Workers Logs
- source maps
- traces at 5%
- `wrangler tail` during incidents

### For origin services
- Health Checks
- Notifications
- one or two Logpush jobs for critical datasets

### For governance
- Audit Logs
- one Slack/webhook destination for important notifications

### For later growth
- OTel export
- Workers Analytics Engine
- SIEM/Grafana integration

This gives you good practical coverage without building a huge telemetry platform immediately.

---

## 5. Recommended deployment patterns

## Pattern A — Small Worker API
Use:
- Workers Logs
- `wrangler tail`
- source maps
- traces at low sample rate

Best for:
- small APIs
- internal tools
- early-stage edge services

## Pattern B — Production SaaS on Workers
Use:
- Workers Logs
- traces
- OTel export to external platform
- Analytics Engine for tenant usage metrics
- Notifications
- Audit Logs

Best for:
- serious production services
- multi-tenant systems
- teams with SRE/incident workflows

## Pattern C — Traditional app behind Cloudflare
Use:
- Logpush for HTTP/firewall events
- Health Checks
- Notifications
- Audit Logs
- origin APM/logging stack

Best for:
- web apps on VMs/containers/Kubernetes
- APIs behind Cloudflare proxy
- services where Cloudflare is edge layer, not runtime

## Pattern D — Tunnel-based private service exposure
Use:
- `cloudflared` metrics → Prometheus/Grafana
- Health Checks
- app logs
- Notifications
- optionally Logpush/GraphQL for edge context

Best for:
- self-hosted apps
- internal dashboards
- services exposed through Cloudflare Tunnel

---

## 6. A practical rollout plan

## Phase 1 — Visibility basics
- turn on Workers Logs or basic dashboards
- enable Health Checks for origins
- enable Notifications
- turn on source maps for Workers

## Phase 2 — Better incident response
- add traces
- connect real-time logs / `wrangler tail`
- instrument app logs consistently
- define ownership for alert destinations

## Phase 3 — Centralization
- configure OTel export or Logpush
- connect to Grafana/SIEM/log platform
- add Logpush health monitoring
- review retention strategy

## Phase 4 — Custom service analytics
- add Workers Analytics Engine
- build per-customer or per-feature dashboards
- automate GraphQL or SQL reports
- connect billing/compliance workflows if needed

---

## 7. Suggested KPIs and dashboards

## For Worker-based APIs
Track:
- request rate
- error rate
- CPU p50/p95/p99
- duration p50/p95/p99
- traces sampled
- top failing routes
- exceptions by release/version
- upstream latency

## For origin-backed apps
Track:
- total requests
- 4xx and 5xx by hostname/path
- firewall actions
- cache hit ratio
- health check uptime
- origin latency
- top geographies / ASNs during incidents

## For Tunnel deployments
Track:
- `cloudflared` scrape health
- connector throughput
- connector resource usage
- app health endpoint
- request failure spikes

## For governance/security
Track:
- critical notification count
- failed Logpush jobs
- audit log changes by actor/action
- risky config changes
- identity/login related signals where applicable

---

## 8. Best practices

### 1. Use native dashboards first, exports second
The dashboard is usually the fastest way to answer “what just broke?”  
Then use exports/APIs for automation and longer retention.

### 2. Separate logs, traces, and metrics mentally
- logs = event detail
- traces = request flow
- metrics = trends and alertable aggregates

### 3. Turn on source maps for all serious Workers
This is one of the highest-value, lowest-effort improvements.

### 4. Use structured logs
JSON logs are much easier to search, filter, export, and route.

### 5. Do not rely on one signal
A healthy dashboard does not guarantee a healthy origin.  
Use Cloudflare analytics + app logs + health checks together.

### 6. Alert on pipeline failure, not just app failure
If Logpush fails, you may silently lose the very data you need during incidents.

### 7. Keep sensitive data out of logs
Avoid tokens, cookies, raw auth headers, full PII, or customer secrets.

### 8. Sample intentionally
100% sampling is useful during early development but may be noisy or expensive later.

### 9. Add custom metrics for your actual business questions
Request counts and 5xx rates are not enough for:
- tenant health
- usage billing
- feature adoption
- AI/model consumption

### 10. Correlate config changes with incidents
Audit Logs often explain mysterious behavior changes.

---

## 9. Common mistakes

- using `wrangler tail` as if it were a long-term log store
- shipping free-form text logs instead of structured JSON
- enabling Logpush but not monitoring Logpush health
- having edge analytics but no origin health checks
- having origin metrics but no Cloudflare-side logs
- forgetting source maps
- trying to use logs for billing/tenant analytics instead of Analytics Engine
- not centralizing telemetry when multiple systems are involved
- ignoring Audit Logs during incident review

---

## 10. Troubleshooting guide

## Symptom: users see errors, but Worker metrics look normal
Check:
- zone analytics
- subrequests / origin status breakdown
- origin health checks
- firewall/rate limit activity
- Logpush datasets for edge-side failure context

## Symptom: Worker errors are hard to debug
Check:
- source maps enabled?
- Workers Logs enabled?
- use `wrangler tail`
- traces enabled?
- are you logging structured context like route/version/tenant?

## Symptom: incident happened but logs are missing
Check:
- was sampling too aggressive?
- did Logpush fail?
- was retention too short?
- were you relying only on real-time logs instead of persisted logs?

## Symptom: service behind Tunnel is unstable
Check:
- `cloudflared` metrics endpoint
- connector resource pressure
- app health endpoint
- origin reachability
- any firewall issue between Cloudflare and origin

## Symptom: config changed unexpectedly
Check:
- Audit Logs
- whether action came via dashboard or API
- actor identity / token
- exact timestamp and resource type

---

## 11. Recommended default setups by service type

## A. Small Worker service
- Workers Logs
- source maps
- traces at 5%
- `wrangler tail` during incidents

## B. Critical Worker service
- Workers Logs
- traces + OTel export
- Analytics Engine for business metrics
- Notifications
- Audit Logs
- release/version fields in logs

## C. Origin-backed API
- Health Checks
- Notifications
- Logpush for HTTP requests and firewall events
- origin APM/logging
- Audit Logs

## D. Tunnel-exposed internal app
- `cloudflared` Prometheus metrics
- Health Checks
- app logs
- Notifications
- Grafana dashboard

---

## 12. My recommended opinionated setup

If I were setting up Cloudflare observability for a modern production service today, I would do this:

### For Workers apps
- enable Workers Logs
- enable source maps
- enable traces at low sample rate
- export telemetry via OTel to central observability platform
- use Analytics Engine for tenant and business metrics
- use Tail Workers only if custom filtering/routing is needed

### For origin services behind Cloudflare
- use Health Checks
- export edge datasets with Logpush
- keep app logs/APM in the origin stack
- use GraphQL for custom reports if needed

### For tunnel services
- scrape `cloudflared` with Prometheus
- monitor health endpoint of the protected app
- route critical alerts to Slack/PagerDuty
- keep connector and app metrics together in one dashboard

### For governance
- use Audit Logs
- keep alert webhooks configured
- monitor Logpush health
- document who owns each pipeline and dataset

---

## 13. References

Official Cloudflare docs referenced in this guide:

- Workers Observability  
  https://developers.cloudflare.com/workers/observability/

- Workers Logs  
  https://developers.cloudflare.com/workers/observability/logs/workers-logs/

- Real-time logs  
  https://developers.cloudflare.com/workers/observability/logs/real-time-logs/

- Tail Workers  
  https://developers.cloudflare.com/workers/observability/logs/tail-workers/

- Workers traces  
  https://developers.cloudflare.com/workers/observability/traces/

- Exporting OpenTelemetry Data  
  https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/

- Source maps and stack traces  
  https://developers.cloudflare.com/workers/observability/source-maps/

- Workers metrics and analytics  
  https://developers.cloudflare.com/workers/observability/metrics-and-analytics/

- Workers Logpush  
  https://developers.cloudflare.com/workers/observability/logs/logpush/

- Cloudflare Logs / Logpush  
  https://developers.cloudflare.com/logs/  
  https://developers.cloudflare.com/logs/logpush/  
  https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/  
  https://developers.cloudflare.com/logs/logpush/logpush-health/

- GraphQL Analytics API  
  https://developers.cloudflare.com/analytics/graphql-api/  
  https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/

- Workers Analytics Engine  
  https://developers.cloudflare.com/analytics/analytics-engine/  
  https://developers.cloudflare.com/analytics/analytics-engine/get-started/  
  https://developers.cloudflare.com/workers/examples/analytics-engine/

- Notifications  
  https://developers.cloudflare.com/notifications/  
  https://developers.cloudflare.com/notifications/get-started/  
  https://developers.cloudflare.com/notifications/get-started/configure-webhooks/  
  https://developers.cloudflare.com/notifications/reference/webhook-payload-schema/

- Audit Logs  
  https://developers.cloudflare.com/fundamentals/account/account-security/audit-logs/  
  https://developers.cloudflare.com/api/resources/audit_logs/

- Health Checks  
  https://developers.cloudflare.com/health-checks/  
  https://developers.cloudflare.com/smart-shield/configuration/health-checks/analytics/

- Cloudflare Tunnel metrics  
  https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/monitor-tunnels/metrics/  
  https://developers.cloudflare.com/cloudflare-one/tutorials/grafana/

- Cloudflare One Logpush integration  
  https://developers.cloudflare.com/cloudflare-one/insights/logs/logpush/

- Web Analytics  
  https://developers.cloudflare.com/web-analytics/  
  https://developers.cloudflare.com/web-analytics/about/
