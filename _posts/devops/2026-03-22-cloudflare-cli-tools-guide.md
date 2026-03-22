---
title: "Cloudflare CLI Tools Guide"
date: 2026-03-22 10:22:00 +0900
tags: [cloudflare, wrangler, cloudflared, r2, cli, devops]
---

# Cloudflare CLI Tools Guide

_Last reviewed: 2026-03-22_

This guide explains the main command-line tools you can use to work with Cloudflare services, what each tool is best for, how they fit together, and common command patterns for day-to-day operations.

## 1. Executive summary

Cloudflare does **not** use a single CLI for every product. In practice, there are four main CLI patterns:

1. **Wrangler** — the primary Cloudflare developer-platform CLI for Workers and related developer products.
2. **cloudflared** — the tunnel and secure-access connector CLI for Cloudflare Tunnel and Access.
3. **C3 (`create-cloudflare`)** — the project scaffolding CLI for starting new Cloudflare app projects.
4. **Generic API/S3-compatible CLIs** — tools such as `curl`, PowerShell, `AWS CLI`, and `rclone` for products exposed through the Cloudflare API or R2’s S3-compatible interface.

A good rule of thumb:

- Use **Wrangler** when you are building and deploying on Cloudflare’s developer platform.
- Use **cloudflared** when you are connecting infrastructure to Cloudflare or accessing resources protected by Cloudflare Access.
- Use **C3** when you are creating a new project.
- Use **curl/PowerShell/AWS CLI/rclone** when the job is API-first or object-storage-first.

## 2. The Cloudflare CLI landscape

### 2.1 Wrangler

**Wrangler** is Cloudflare’s main developer-platform CLI. Cloudflare describes it as the CLI that lets you manage Worker projects.

Use Wrangler for:

- creating, developing, and deploying Workers
- configuring project settings
- managing several developer-platform resources from the terminal
- handling R2, D1, KV, and other Workers-adjacent resources where Wrangler provides commands

Wrangler is the closest thing Cloudflare has to a “main” CLI, but it is mainly centered on the **Workers / developer platform**.

## 2.2 cloudflared

**cloudflared** is the connector daemon and CLI for **Cloudflare Tunnel** and related Access workflows.

Use `cloudflared` for:

- creating and running Cloudflare Tunnels
- exposing private web apps and TCP services through Cloudflare
- connecting to endpoints protected by Cloudflare Access from the CLI
- running tunnel connectors as a service on Linux, macOS, or Windows

This is the right tool when the problem is **networking, private origin exposure, or secure remote access**.

## 2.3 C3 (`create-cloudflare`)

**C3** is the bootstrapping CLI. Cloudflare positions it as the tool used to set up and deploy new applications using official templates and framework-specific setup guides.

Use C3 for:

- starting a new Workers or Pages-style project
- scaffolding framework apps using Cloudflare’s supported templates
- reducing setup friction for new projects

C3 is not the daily operations CLI. It is the **project-creation** CLI.

## 2.4 Generic API tooling: `curl` and PowerShell

Cloudflare’s REST API is still foundational. For many account, zone, DNS, rules, or platform operations, the most universal CLI path is a raw API call using:

- `curl` on Linux/macOS and modern Windows
- PowerShell on Windows
- `jq` to format JSON output for readability

Use this approach when:

- there is no first-class Cloudflare CLI command for the job
- you are scripting account or zone operations
- you want stable, explicit automation around Cloudflare’s API v4

## 2.5 R2-compatible object-storage CLIs: AWS CLI and `rclone`

For **R2**, Cloudflare officially documents the use of **AWS CLI** and **rclone** through the S3-compatible API.

Use these when:

- you need bulk object uploads/downloads
- you are migrating data into or out of R2
- you want directory sync operations
- you already have existing S3-compatible workflows

Cloudflare explicitly notes that `rclone` is ideal for bulk uploads, migrations, and syncing directories.

---

## 3. Choosing the right tool

| Task | Best CLI | Why |
|---|---|---|
| Create a new Cloudflare app project | C3 | Fastest scaffold with official templates |
| Develop and deploy Workers | Wrangler | First-party developer-platform workflow |
| Manage tunnel connectivity and private origins | cloudflared | Built specifically for Tunnel and Access |
| Access a Cloudflare Access-protected API from terminal | cloudflared | Native Access login/token flow |
| Manage R2 buckets and some object operations in dev workflows | Wrangler | First-party Cloudflare workflow |
| Bulk copy/sync objects to R2 | AWS CLI or rclone | Better fit for storage-heavy tasks |
| Script unsupported account/zone operations | curl / PowerShell | Works against the full API surface |

---

## 4. Wrangler: the main Cloudflare developer CLI

### 4.1 What Wrangler is

Cloudflare describes Wrangler as the **Cloudflare Developer Platform CLI**. It is the first-party tool for creating, developing, and deploying Workers.

### 4.2 What Wrangler is best at

Wrangler is the best default when you work with:

- **Workers**
- **Pages/Workers-style application deployment flows**
- **R2** integrations in developer workflows
- **D1** database management
- **KV** namespace operations
- other resources that live inside the Workers ecosystem

### 4.3 Installation

Cloudflare docs commonly show Wrangler being installed with a Node package manager:

```bash
npm i -D wrangler
```

You can also use `yarn` or `pnpm`.

### 4.4 Authentication

Typical interactive login:

```bash
wrangler login
```

For CI/CD, Cloudflare documents using an **API token** and **account ID** instead of an interactive login.

### 4.5 Configuration files

Cloudflare currently recommends **`wrangler.jsonc`** for new projects. Wrangler also supports `wrangler.json` and `wrangler.toml`, but Cloudflare notes that newer features may only be available to projects using JSON config.

Cloudflare also recommends treating the Wrangler configuration file as the **source of truth** for Worker configuration.

### 4.6 Core workflow

A normal Wrangler workflow looks like:

```bash
# create or bootstrap a project first (often with C3)
# then run local development
wrangler dev

# deploy
wrangler deploy
```

### 4.7 Examples of service-specific command families

#### Workers KV
Cloudflare documents Wrangler `kv` commands for managing Workers KV resources.

#### D1
Cloudflare documents D1 Wrangler commands and notes that these commands use REST APIs to interact with the control plane.

Example pattern:

```bash
wrangler d1 create my-db
```

#### R2
Cloudflare documents Wrangler commands for R2 bucket operations and notes that Wrangler can manage buckets and perform basic object operations.

Example pattern:

```bash
wrangler r2 bucket create my-bucket
```

### 4.8 When **not** to use Wrangler

Wrangler is not the right primary tool when:

- you are setting up network tunnels to private infrastructure
- you are doing bulk object sync/migration for R2
- the Cloudflare API endpoint you need is not surfaced in Wrangler

In those cases, use `cloudflared`, `rclone`/AWS CLI, or raw API calls.

### 4.9 Strengths

- first-party and well integrated with the developer platform
- handles local dev + deploy + config in one tool
- supports multiple Cloudflare developer products
- good fit for CI/CD

### 4.10 Caveats

- centered on the developer platform, not every Cloudflare product
- some advanced account-wide operations still require direct API calls
- requires Node-based tooling in most workflows

---

## 5. `cloudflared`: tunnels, connectors, and CLI access

### 5.1 What `cloudflared` is

Cloudflare documents `cloudflared` as the lightweight server-side daemon required for **Cloudflare Tunnel**. It connects your infrastructure to Cloudflare using outbound-only connections.

### 5.2 What it is best at

Use `cloudflared` when you need to:

- publish a private web app through Cloudflare Tunnel
- expose internal SSH/TCP services via Cloudflare
- authenticate to Cloudflare Access from the terminal
- run tunnel connectors as a service

### 5.3 Installation

Cloudflare provides installation/download instructions for Linux, macOS, Windows, and Docker.

### 5.4 Common tunnel commands

Examples commonly used in Cloudflare docs:

```bash
# authenticate cloudflared with your Cloudflare account
cloudflared tunnel login

# quick development tunnel
cloudflared tunnel --url http://localhost:8080

# inspect subcommand help
cloudflared tunnel help
```

Cloudflare’s current “Useful commands” page says it lists the most commonly used commands for managing local tunnels and recommends using CLI help text for full command coverage.

### 5.5 Running as a service

Cloudflare recommends running `cloudflared` as a service in most cases so it starts at boot and remains available while the origin is online.

### 5.6 Access-protected APIs from a CLI

Cloudflare documents CLI-based authentication flows for protected endpoints. A common pattern is:

```bash
cloudflared access login https://example.com
```

This is the right tool when you want a terminal-based way to authenticate as a user to a Cloudflare Access-protected API or application.

### 5.7 When **not** to use `cloudflared`

Do not treat `cloudflared` as a general Cloudflare account automation CLI. It is specialized for:

- tunnel connectivity
- secure access patterns
- related client/server tunnel operations

If you are deploying Workers, use Wrangler. If you are editing DNS or account configuration broadly, use the API or product-specific tooling.

### 5.8 Strengths

- solves origin exposure without public inbound ports
- fits Cloudflare Access and Tunnel workflows naturally
- useful both for server-side connectors and user-side CLI access

### 5.9 Caveats

- not a general-purpose Cloudflare administration tool
- focused on connectivity, access, and tunnel lifecycle

---

## 6. C3 (`create-cloudflare`): project scaffolding

### 6.1 What it is

Cloudflare documents **C3** (`create-cloudflare`) as the CLI designed to help you set up and deploy new applications using official templates and framework-specific setup guides.

### 6.2 What it is best for

Use C3 when you are at the **very beginning** of a project:

- creating a new Worker app
- starting a framework app intended for Cloudflare deployment
- generating a recommended base structure

### 6.3 Common command

Cloudflare’s docs commonly show:

```bash
npm create cloudflare@latest
```

### 6.4 Role in the toolchain

Think of C3 as a **front door** into Cloudflare development:

- **C3** creates the project
- **Wrangler** becomes the day-to-day tool afterward

### 6.5 When not to use it

Once a project already exists, you usually move to Wrangler. C3 is mainly for initial creation and guided setup.

---

## 7. Raw API operations with `curl`, PowerShell, and `jq`

### 7.1 Why this still matters

Cloudflare’s API is broad. Even with first-party CLIs, direct API usage remains important because it gives you access to the complete API surface.

Cloudflare’s docs say API requests are authorized with:

```http
Authorization: Bearer <API_TOKEN>
```

The stable base URL for API v4 is:

```text
https://api.cloudflare.com/client/v4/
```

### 7.2 Linux/macOS example with `curl`

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq .
```

### 7.3 Windows / PowerShell

Cloudflare documents using PowerShell cmdlets such as `Invoke-RestMethod` and `ConvertFrom-Json` for REST API calls on Windows.

### 7.4 Best practices

- use **API tokens**, not legacy global API keys, whenever possible
- store secrets in environment variables
- never commit API tokens to source control
- use `jq` or PowerShell JSON tooling to make outputs readable

### 7.5 When to prefer raw API calls

Prefer raw API calls when:

- the Cloudflare CLI does not expose the operation you need
- you need explicit, scriptable control over account or zone resources
- you are automating outside a Node-based environment

### 7.6 Strengths

- full Cloudflare API coverage
- easy to automate in shell scripts and CI
- not tied to one product surface

### 7.7 Caveats

- less ergonomic than first-party CLIs
- you must manage endpoints, payloads, pagination, and error handling yourself

---

## 8. R2-focused CLI workflows: Wrangler vs AWS CLI vs `rclone`

### 8.1 The split

R2 is special because Cloudflare supports **two different styles** of CLI workflow:

1. **Wrangler** for Cloudflare-native developer workflows.
2. **AWS CLI / rclone** for S3-compatible storage workflows.

### 8.2 Wrangler for R2

Cloudflare docs say Wrangler can manage buckets and perform basic object operations.

Use Wrangler when:

- R2 is part of a Workers project
- you want one Cloudflare-native auth flow
- you are doing development-oriented bucket management

Typical examples:

```bash
wrangler r2 bucket create my-bucket
wrangler r2 object put my-bucket/path/to/file --file ./file
```

### 8.3 AWS CLI for R2

Cloudflare documents AWS CLI support by pointing it at R2’s custom S3 endpoint.

Use AWS CLI when:

- your team already uses S3 tooling
- you need familiar object-storage commands
- you want to reuse existing automation patterns

Typical workflow:

```bash
aws configure
aws s3 ls --endpoint-url https://<accountid>.r2.cloudflarestorage.com
```

### 8.4 `rclone` for R2

Cloudflare explicitly calls `rclone` ideal for bulk uploads, migrations, and syncing directories.

Typical setup flow:

```bash
rclone config
```

Then choose:

- storage type: Amazon S3 compatible
- provider: Cloudflare R2
- access key / secret key
- endpoint URL

### 8.5 Which one to pick

| Scenario | Best tool |
|---|---|
| App developer using R2 from Workers | Wrangler |
| Storage migration or mirroring | rclone |
| Existing S3 automation scripts | AWS CLI |
| Simple bucket management from Cloudflare-native workflow | Wrangler |

---

## 9. Recommended CLI stacks by persona

### 9.1 Application developer

Use:

- **C3** to start the project
- **Wrangler** for local dev, deploy, config, and Workers-adjacent resources
- **cloudflared** only if you also need tunnels/private connectivity

### 9.2 Infrastructure / platform engineer

Use:

- **cloudflared** for Tunnel and Access
- **curl/PowerShell** for account and zone automation not covered by first-party CLIs
- **Wrangler** only when managing developer-platform resources

### 9.3 Storage / data migration engineer

Use:

- **rclone** or **AWS CLI** for R2 bulk data work
- **Wrangler** for lightweight bucket/resource tasks tied to app development

### 9.4 CI/CD engineer

Use:

- **Wrangler** with API token + account ID for developer-platform deploys
- **curl** or PowerShell for broad API automation
- **cloudflared** where the pipeline needs private service connectivity or Access-aware flows

---

## 10. Security guidance across all Cloudflare CLI workflows

### 10.1 Prefer API tokens

Cloudflare recommends API tokens over older API keys because API keys have limitations and are less secure.

### 10.2 Store secrets safely

Use:

- environment variables
- secret managers
- CI secret stores

Do not:

- hardcode credentials in scripts
- commit tokens to repositories
- paste tokens into chat logs or ticket systems

### 10.3 Use least privilege

Create narrowly scoped tokens for:

- Wrangler CI
- R2 object access
- account or zone automation

### 10.4 Be deliberate about local config as source of truth

Cloudflare specifically recommends treating Wrangler config as the source of truth if you manage Workers with Wrangler.

---

## 11. Practical setup examples

### 11.1 Start a new app project

```bash
npm create cloudflare@latest
cd my-app
npm install
npx wrangler dev
npx wrangler deploy
```

### 11.2 Publish a private local app through Cloudflare

```bash
cloudflared tunnel login
cloudflared tunnel --url http://localhost:8080
```

### 11.3 Call the Cloudflare API directly

```bash
export CLOUDFLARE_API_TOKEN=...
export ZONE_ID=...

curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq .
```

### 11.4 Create an R2 bucket with Wrangler

```bash
wrangler r2 bucket create my-bucket
```

### 11.5 Configure `rclone` for R2 sync work

```bash
rclone config
rclone sync ./data r2:my-bucket/data
```

### 11.6 Access an Access-protected endpoint from terminal

```bash
cloudflared access login https://example.com
```

---

## 12. Anti-patterns to avoid

### Don’t use `cloudflared` as your main app deployment CLI
Use Wrangler for developer-platform deployments.

### Don’t use Wrangler for bulk object migration
Use `rclone` or AWS CLI for large R2 sync/copy/migration tasks.

### Don’t rely only on dashboard changes if Wrangler manages the project
Cloudflare warns that dashboard changes can be overridden by the next Wrangler deploy if your config file defines those settings.

### Don’t use legacy auth patterns unless you must
Prefer API tokens whenever possible.

---

## 13. Opinionated recommendations

If you want a practical default stack, use this:

### For most Cloudflare app teams
- `create-cloudflare` for bootstrap
- `wrangler` for everyday development and deploys
- `cloudflared` only where private networking or Access is needed

### For teams managing private services
- `cloudflared` for tunnels and Access
- `curl`/PowerShell for account-wide automation

### For teams using R2 heavily
- `wrangler` for app-adjacent resource management
- `rclone` for migrations and sync
- AWS CLI where your org already standardizes on S3 tooling

---

## 14. Quick reference cheat sheet

### New project
```bash
npm create cloudflare@latest
```

### Wrangler login
```bash
wrangler login
```

### Local Worker development
```bash
wrangler dev
```

### Deploy Worker
```bash
wrangler deploy
```

### Create R2 bucket
```bash
wrangler r2 bucket create my-bucket
```

### Create D1 database
```bash
wrangler d1 create my-db
```

### Tunnel login
```bash
cloudflared tunnel login
```

### Quick tunnel to local service
```bash
cloudflared tunnel --url http://localhost:8080
```

### CLI login to Access-protected app
```bash
cloudflared access login https://example.com
```

### Raw API call
```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq .
```

### R2 sync with rclone
```bash
rclone sync ./local-dir r2:my-bucket/path
```

---

## 15. Final takeaways

The best way to think about Cloudflare CLI tooling is:

- **Wrangler** = Cloudflare developer platform operations
- **cloudflared** = tunnels, private connectivity, and Access-aware CLI workflows
- **C3** = new-project bootstrap
- **curl/PowerShell** = universal fallback for the full Cloudflare API
- **AWS CLI / rclone** = best fit for heavy R2 object-storage workflows

If you standardize only one tool for app development, it should usually be **Wrangler**.
If you standardize only one tool for secure infrastructure exposure, it should usually be **cloudflared**.
If you need broad automation coverage across Cloudflare services, keep **raw API tooling** in your toolkit even when you use the first-party CLIs.

---

## 16. References

Official Cloudflare sources used for this guide:

- Cloudflare Workers — Wrangler overview: https://developers.cloudflare.com/workers/wrangler/
- Cloudflare Workers — Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/
- Cloudflare Workers — Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- Cloudflare Learning Paths — C3 & Wrangler: https://developers.cloudflare.com/learning-paths/workers/get-started/c3-and-wrangler/
- Cloudflare Pages — Create projects with C3 CLI: https://developers.cloudflare.com/pages/get-started/c3/
- Cloudflare Tunnel downloads (`cloudflared`): https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
- Cloudflare Tunnel useful commands: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/tunnel-useful-commands/
- Cloudflare Tunnel run as a service: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/
- Cloudflare Access CLI tutorial: https://developers.cloudflare.com/cloudflare-one/tutorials/cli/
- Cloudflare Fundamentals — Make API calls: https://developers.cloudflare.com/fundamentals/api/how-to/make-api-calls/
- Cloudflare API overview: https://developers.cloudflare.com/api/
- Cloudflare R2 — CLI: https://developers.cloudflare.com/r2/get-started/cli/
- Cloudflare R2 — Create new buckets: https://developers.cloudflare.com/r2/buckets/create-buckets/
- Cloudflare R2 — Wrangler commands: https://developers.cloudflare.com/r2/reference/wrangler-commands/
- Cloudflare D1 — Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Cloudflare KV — Wrangler KV commands: https://developers.cloudflare.com/kv/reference/kv-commands/
