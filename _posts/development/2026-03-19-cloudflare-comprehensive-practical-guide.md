---
title: "Cloudflare: A Comprehensive Practical Guide"
date: 2026-03-19 20:07:00 +0900
tags: [cloudflare, dns, cdn, security, zero-trust, workers, pages, r2]
---

# Cloudflare: A Comprehensive Practical Guide

_Last updated: 2026-03-19_

## Table of contents

1. [What Cloudflare is](#what-cloudflare-is)
2. [How Cloudflare works](#how-cloudflare-works)
3. [Cloudflare product map](#cloudflare-product-map)
4. [Who should use Cloudflare](#who-should-use-cloudflare)
5. [Common ways to start using Cloudflare](#common-ways-to-start-using-cloudflare)
6. [Path A: Put an existing website behind Cloudflare](#path-a-put-an-existing-website-behind-cloudflare)
7. [Path B: Publish a local or private service with Cloudflare Tunnel](#path-b-publish-a-local-or-private-service-with-cloudflare-tunnel)
8. [Path C: Deploy a frontend or full-stack app on Cloudflare Pages / Workers](#path-c-deploy-a-frontend-or-full-stack-app-on-cloudflare-pages--workers)
9. [Path D: Use Cloudflare R2 object storage](#path-d-use-cloudflare-r2-object-storage)
10. [Path E: Use Cloudflare Zero Trust for internal access](#path-e-use-cloudflare-zero-trust-for-internal-access)
11. [Path F: Use 1.1.1.1 / WARP as an individual](#path-f-use-1111--warp-as-an-individual)
12. [Security fundamentals and best practices](#security-fundamentals-and-best-practices)
13. [Performance and caching fundamentals](#performance-and-caching-fundamentals)
14. [Developer platform overview](#developer-platform-overview)
15. [Pricing and plan selection guidance](#pricing-and-plan-selection-guidance)
16. [When Cloudflare is a good fit and when it is not](#when-cloudflare-is-a-good-fit-and-when-it-is-not)
17. [Troubleshooting checklist](#troubleshooting-checklist)
18. [Suggested learning path](#suggested-learning-path)
19. [Glossary](#glossary)
20. [Official references](#official-references)

---

## What Cloudflare is

Cloudflare is an edge network and application platform that sits between users and Internet services, or directly hosts code and content on its own platform.

Depending on what you enable, Cloudflare can act as:

- an authoritative DNS provider
- a reverse proxy in front of your website or API
- a CDN and cache
- a DDoS mitigation and web security layer
- a Zero Trust access layer for internal apps and networks
- a serverless compute platform for apps and APIs
- an object storage and data platform for cloud-native workloads
- a consumer network privacy tool through 1.1.1.1 and WARP

The easiest way to think about Cloudflare is this:

> Cloudflare gives you a globally distributed control plane and data plane for traffic, security, performance, and application delivery.

---

## How Cloudflare works

At a high level, Cloudflare usually fits into one of four models:

### 1. DNS only
You use Cloudflare as your DNS provider, but traffic goes directly to your origin.

Use this when you want:

- fast authoritative DNS
- central record management
- DNSSEC and DNS analytics
- no reverse proxy behavior yet

### 2. Reverse proxy for web traffic
You point your domain to Cloudflare and enable proxying for HTTP/HTTPS records. Users connect to Cloudflare first, and Cloudflare forwards requests to your origin.

This enables:

- CDN caching
- SSL/TLS management
- WAF
- bot and DDoS protection
- rules and edge behavior
- origin shielding and IP masking in some setups

### 3. Edge-hosted applications
Instead of only protecting an origin, you deploy code directly on Cloudflare using Workers, Pages, or related products.

This enables:

- serverless APIs
- full-stack apps
- static and dynamic sites
- background jobs, queues, stateful coordination, and storage integrations

### 4. Private connectivity and Zero Trust
Instead of exposing an origin publicly, you connect private apps, networks, or devices to Cloudflare using Tunnel, WARP, Access, Gateway, and related Zero Trust features.

This enables:

- replacing VPNs for many use cases
- identity-aware access to internal apps
- outbound-only connectors instead of inbound public exposure
- filtering and securing user Internet traffic

---

## Cloudflare product map

Cloudflare has a wide product surface. The easiest way to understand it is by category.

### Core website and network services

#### Cloudflare DNS
Authoritative DNS for your domain. Often the first product people use.

Best for:

- moving DNS management to Cloudflare
- gaining DNS analytics
- preparing to proxy traffic through Cloudflare

#### Proxy / CDN / Cache
When a DNS record is proxied, Cloudflare responds with anycast IPs and applies edge delivery and protection for HTTP/S traffic.

Best for:

- faster global content delivery
- reduced origin load
- cacheable static assets
- edge caching policies

#### SSL/TLS
Cloudflare can provide certificates to users and can also secure the connection between Cloudflare and your origin.

Best for:

- automatic HTTPS
- certificate management simplification
- stronger origin encryption using Origin CA in many setups

#### WAF and rules
Cloudflare WAF checks requests against managed and custom rulesets. You can also use rate limiting and other rule engines.

Best for:

- blocking common web attacks
- reducing attack surface for websites and APIs
- creating policy-based request handling

#### DDoS protection
Cloudflare provides network and application-layer protections across its edge.

Best for:

- absorbing volumetric attacks
- protecting websites, APIs, and edge applications

### Zero Trust and private connectivity

#### Cloudflare Access
Identity-aware access control for internal apps.

Best for:

- protecting admin panels, staging sites, dashboards, SSH, and internal tools
- requiring login through an IdP before users can access an application

#### Cloudflare Tunnel
A lightweight connector (`cloudflared`) creates outbound-only connections to Cloudflare so you do not need a publicly reachable origin IP.

Best for:

- exposing a local web app securely
- publishing internal services without opening inbound firewall ports
- hiding your public origin

#### Cloudflare Gateway
Secure web gateway and filtering for user egress traffic.

Best for:

- DNS filtering
- HTTP inspection and policy control
- secure Internet access for teams

#### WARP for Zero Trust
Endpoint client for routing device traffic through Cloudflare policies.

Best for:

- device-aware access control
- replacing or reducing dependency on traditional VPNs

### Developer platform

#### Workers
Serverless compute on Cloudflare’s edge.

Best for:

- APIs
- request/response manipulation
- edge authentication and routing
- full-stack applications
- cron jobs and background logic

#### Pages
Static hosting and front-end deployment platform, often with Git integration and preview deployments.

Best for:

- JAMstack and frontend apps
- framework-based deployments
- rapid iteration with previews per pull request

#### Storage and data products

- **R2**: object storage for files, media, uploads, backups, artifacts
- **KV**: globally distributed key-value reads for configuration/session-like patterns
- **Durable Objects**: strongly coordinated stateful compute
- **D1**: serverless SQL database for app workloads
- **Hyperdrive**: acceleration layer for existing databases accessed from Workers
- **Queues / Workflows**: async processing and orchestration

### Consumer networking

#### 1.1.1.1
Cloudflare public resolver for faster and more private DNS resolution.

#### WARP
Client app that routes device traffic in a way intended to improve security and privacy, with multiple connection modes.

---

## Who should use Cloudflare

Cloudflare can be useful for several very different audiences.

### Website owners
You have a site or API on a VPS, cloud VM, PaaS, or managed hosting platform and want:

- better speed globally
- HTTPS and certificates
- WAF and bot protection
- DNS management
- DDoS mitigation

### Developers and startups
You want to build with edge compute, serverless APIs, static hosting, and managed storage.

### IT and security teams
You want to secure private applications, reduce public exposure, filter traffic, and replace VPN-heavy patterns.

### Individuals
You want better DNS privacy or to use the WARP client on your personal device.

---

## Common ways to start using Cloudflare

Most people should begin with one of these paths:

1. **Website path**: move DNS and proxy your domain through Cloudflare.
2. **Private service path**: expose an internal or local app through Cloudflare Tunnel.
3. **Developer path**: deploy a site or API with Pages or Workers.
4. **Storage path**: create an R2 bucket for assets or uploads.
5. **Zero Trust path**: protect internal apps behind Access.
6. **Personal path**: install 1.1.1.1 / WARP on a device.

If you are unsure where to begin, choose the one closest to your immediate goal:

- “I want to speed up and protect my website” → Path A
- “I want to access a private/local app from the Internet safely” → Path B
- “I want to deploy a new app” → Path C
- “I need cloud object storage” → Path D
- “I want SSO-gated access to internal apps” → Path E
- “I want private DNS / safer browsing on my laptop or phone” → Path F

---

## Path A: Put an existing website behind Cloudflare

This is the most common entry point.

### What you need

- a Cloudflare account
- a domain you control
- access to your registrar or nameserver settings
- a working origin server or hosting provider

### What happens during setup

1. Add your domain to Cloudflare.
2. Cloudflare scans common DNS records.
3. Review and fix DNS records.
4. Update nameservers at your registrar to the ones Cloudflare provides.
5. Decide which DNS records should be proxied.
6. Configure SSL/TLS mode.
7. Test the site.
8. Enable security and caching features gradually.

### Proxy vs DNS-only records

A DNS record that is **proxied** sends web traffic through Cloudflare’s network. This is where CDN, WAF, DDoS mitigation, and many rules apply.

A **DNS-only** record resolves directly to your origin and does not receive reverse-proxy features.

### Recommended first settings

For a normal website:

- keep your main `A`, `AAAA`, or `CNAME` for `www` proxied
- use **Full (strict)** SSL/TLS if your origin has a valid certificate or Cloudflare Origin CA setup
- turn on automatic HTTPS redirects if appropriate
- enable WAF managed rules
- start with conservative caching rules
- set up DNSSEC if your registrar supports it cleanly

### SSL/TLS mode guidance

- **Flexible**: avoid unless you have no other option; Cloudflare to origin is not properly encrypted
- **Full**: encrypted to the origin, but certificate validation is looser
- **Full (strict)**: best default for production if your origin cert is valid

### Important caution

If you proxy your app through Cloudflare but still leave the origin publicly reachable, attackers may bypass some protections by hitting the origin directly. Consider:

- firewall rules that allow only Cloudflare IP ranges
- using Tunnel where possible
- restricting admin paths with Access

### Good first-week rollout plan

Day 1:

- add domain
- confirm DNS records
- set SSL/TLS to Full (strict)
- validate site loading

Day 2:

- enable WAF managed rules
- add basic rate limiting for login/API hotspots
- review bot and security events

Day 3:

- add caching rules for static assets
- review headers, redirects, compression, and image optimization options

Day 4:

- lock down origin exposure
- add Access in front of admin or staging routes

---

## Path B: Publish a local or private service with Cloudflare Tunnel

Cloudflare Tunnel is one of the easiest and most useful Cloudflare products.

### Why use it

Instead of opening inbound firewall ports and exposing your origin directly, you run `cloudflared` on your server or local machine. It makes outbound-only connections to Cloudflare, and Cloudflare routes traffic to your service.

This is excellent for:

- home lab dashboards
- internal web tools
- SSH or RDP access patterns
- staging apps
- internal APIs

### Basic concept

- your service runs locally, for example on `http://localhost:8080`
- `cloudflared` connects outward to Cloudflare
- users connect to a hostname you control
- Cloudflare forwards traffic through the tunnel to your local service

### Typical setup flow

1. Create or select a domain in Cloudflare.
2. Install `cloudflared` on the machine hosting the service.
3. Authenticate `cloudflared`.
4. Create a tunnel.
5. Map a hostname like `app.example.com` to your local service.
6. Start the tunnel.
7. Optionally protect the hostname with Access.

### When Tunnel is especially strong

Use Tunnel when you want:

- no public inbound ports
- a quick secure way to expose a development or internal app
- simpler origin security than a directly exposed server

### Best practice

For sensitive services, combine:

- **Tunnel** for connectivity
- **Access** for identity checks
- optional **WARP** for device posture and private routing

---

## Path C: Deploy a frontend or full-stack app on Cloudflare Pages / Workers

This is the best path when you are building something new.

### Use Pages when

- you have a static site or framework frontend
- you want Git-based deploys and preview URLs
- you want simple hosting with optional functions

### Use Workers when

- you need request handlers or APIs
- you want edge logic close to users
- you need bindings to storage, queues, databases, or AI features
- you are building full-stack behavior directly on Cloudflare

### Typical Pages workflow

1. Create a repository.
2. Connect it to Cloudflare Pages, or use direct upload/C3.
3. Configure build command and output directory.
4. Deploy to a `*.pages.dev` subdomain.
5. Attach your custom domain.
6. Enable previews for pull requests.

### Typical Workers workflow

1. Install Node.js.
2. Use the Cloudflare CLI workflow to create a project.
3. Run locally.
4. Configure bindings and secrets.
5. Deploy with the CLI.

### Example use cases

#### Pages only
- docs site
- marketing site
- frontend SPA

#### Workers only
- webhook endpoint
- API gateway
- signed image URL service
- edge auth layer

#### Pages + Workers + data
- SaaS app frontend on Pages
- API routes on Workers
- uploads in R2
- app state in D1 / Durable Objects / KV depending on pattern

### Key advantage

Workers and Pages are not just hosting products. They are tightly integrated with a broader runtime and data ecosystem, which makes Cloudflare attractive for globally distributed apps.

---

## Path D: Use Cloudflare R2 object storage

R2 is Cloudflare’s object storage service.

### Good use cases

- user uploads
- images and media assets
- build artifacts
- backups and archives
- application content storage
- storage behind CDN-delivered apps

### Why people choose it

The biggest appeal is usually cost structure and Cloudflare ecosystem fit, especially for public content delivery and application integration.

### Typical setup flow

1. Create an R2 bucket.
2. Decide whether objects are private or public.
3. Upload via dashboard, CLI, S3-compatible tools, or Workers.
4. Optionally bind the bucket to a Worker.
5. Serve content through your application or through appropriate public delivery patterns.

### Design notes

- R2 is object storage, not a general-purpose file system
- bucket object naming matters for organization
- access control design matters early
- public delivery should be planned intentionally

### Good pairing patterns

- **R2 + Workers** for upload/download authorization
- **R2 + Pages** for app asset flows
- **R2 + Images/Stream** depending on media requirements and product choice

---

## Path E: Use Cloudflare Zero Trust for internal access

If you manage internal tools, Cloudflare Zero Trust may be the most valuable part of the platform.

### Main components

- **Access**: who can reach an app
- **Tunnel**: how the app connects to Cloudflare
- **Gateway**: what user traffic can reach on the Internet
- **WARP**: how devices route traffic into policy enforcement

### A very common first deployment

Protect an internal dashboard without opening it publicly.

#### Example pattern

- dashboard is on a private VM or local server
- `cloudflared` publishes it via Tunnel
- Access requires login through Google, Okta, Microsoft Entra ID, or another IdP
- only users in specific groups can access it

### Benefits over a traditional VPN-only model

- easier app-specific policies
- less broad network exposure
- identity-aware access at the application layer
- simpler user experience for many web apps

### Good first targets for Access

- `/admin`
- `/staging`
- Jenkins, Grafana, Kibana, internal wiki, BI dashboards
- SSH access patterns
- private APIs

### Zero Trust onboarding notes

During initial setup, you create a team domain such as `your-team.cloudflareaccess.com`, then connect an identity provider and define access policies.

---

## Path F: Use 1.1.1.1 / WARP as an individual

This is the simplest way for a non-admin to use Cloudflare.

### 1.1.1.1
A public DNS resolver intended to improve speed and privacy compared with many default ISP DNS configurations.

### WARP
A client that can route your device traffic in ways intended to improve privacy and security. It has different modes depending on how you want traffic handled.

### Good use cases

- safer browsing on public Wi‑Fi
- privacy-minded DNS usage
- simplified protection for a personal device

### Important caveat

WARP is not identical to a traditional “pick-a-country” consumer VPN product. Treat it as a Cloudflare network client focused on connectivity, privacy, and security characteristics rather than as a generic geo-unblocking tool.

---

## Security fundamentals and best practices

This is where many Cloudflare deployments either become excellent or remain half-finished.

### 1. Prefer Full (strict) SSL/TLS
Avoid insecure origin configurations.

### 2. Protect the origin, not just the edge
If your origin stays openly reachable, attackers may bypass Cloudflare controls.

Practical options:

- allowlist Cloudflare IP ranges at the firewall or LB
- use Tunnel instead of public ingress where possible
- require Access for sensitive paths/apps

### 3. Turn on managed WAF rules early
Start with managed protections before building lots of custom rules.

### 4. Add rate limiting to attack-prone endpoints
Especially:

- login
- signup
- password reset
- search
- contact forms
- token and OTP endpoints
- API endpoints vulnerable to abuse

### 5. Separate public, admin, and internal surfaces
A common good pattern is:

- public app proxied through Cloudflare
- admin routes protected with Access
- origin hidden or tightly filtered

### 6. Review logs and analytics after enabling protections
Security controls should be observed, not merely turned on.

### 7. Do not over-block on day one
Use staged rollout and monitoring to avoid breaking legitimate traffic.

---

## Performance and caching fundamentals

Cloudflare can improve speed, but only when caching and delivery are configured intentionally.

### What Cloudflare caches well

Usually easiest wins:

- images
- CSS
- JavaScript
- fonts
- static downloads
- versioned assets

### What requires thought

- dynamic HTML
- authenticated content
- personalized pages
- API responses

### Good performance practices

- use cache-friendly asset versioning
- enable compression where appropriate
- use image optimization workflows if relevant to your plan/product choice
- set sensible cache headers from the origin
- create cache rules deliberately instead of guessing

### Common mistake

People expect “putting a site behind Cloudflare” to automatically optimize everything. In reality, the best results come from good origin headers, selective edge caching, and measurement.

---

## Developer platform overview

Cloudflare’s developer platform is broad. Here is the practical summary.

### Workers
Use for execution at the edge, APIs, middleware, signed URLs, redirects, request transformation, and application backends.

### Pages
Use for frontend deployment and preview workflows.

### KV
Use for globally distributed read-heavy key-value data.

### Durable Objects
Use when you need strongly coordinated, stateful logic for rooms, sessions, counters, coordination, or real-time state.

### D1
Use when you want SQL-style application data with Cloudflare-native ergonomics.

### Hyperdrive
Use when you already have a database elsewhere and want better performance from Workers across geographies.

### R2
Use for object storage.

### Queues / Workflows
Use for asynchronous jobs, pipelines, delayed tasks, or orchestrated flows.

### Practical product selection shortcuts

- “I need object storage” → R2
- “I need a global config map or read-heavy key-value access” → KV
- “I need coordination and stateful behavior” → Durable Objects
- “I already have Postgres/MySQL elsewhere and want Workers to talk to it faster” → Hyperdrive
- “I want SQL in the platform” → D1

---

## Pricing and plan selection guidance

Cloudflare offers multiple plan tiers, with Free, Pro, Business, and Enterprise options across core website services, while developer and Zero Trust products may have their own pricing dimensions.

### Simple decision guide

#### Free plan
Good for:

- personal websites
- hobby projects
- very small production sites with modest needs
- learning Cloudflare

#### Pro plan
Good for:

- professional websites
- startups
- sites that need stronger security and more tuning than Free

#### Business plan
Good for:

- revenue-generating sites
- teams that need stronger support, more features, and more operational control

#### Enterprise
Good for:

- large organizations
- advanced contractual/support/compliance/performance requirements
- very custom security or network architecture

### Selection advice

Choose based on:

- traffic criticality
- support expectations
- WAF/rules complexity
- compliance needs
- operational risk tolerance
- whether downtime or false positives are expensive for you

### Practical recommendation

Start smaller unless your business risk clearly justifies more. Many teams can validate architecture on a lower plan and upgrade when operational needs become concrete.

---

## When Cloudflare is a good fit and when it is not

### Strong fit

Cloudflare is usually a strong fit when you want:

- a simple way to accelerate and protect a public website
- authoritative DNS plus reverse proxy in one platform
- app-level Zero Trust for internal resources
- edge/serverless deployment close to users
- object storage tightly integrated with edge compute
- fewer publicly exposed origins

### Less ideal or requires extra evaluation

Cloudflare may be a weaker fit when:

- you need highly specialized legacy networking patterns not well matched to its model
- your application architecture depends heavily on direct long-lived assumptions better served by a different platform design
- you want a traditional server-first hosting model rather than an edge/serverless-centric one
- your compliance, procurement, or regional data constraints require very specific architecture review

The right answer is often mixed architecture rather than all-or-nothing adoption.

---

## Troubleshooting checklist

### DNS problems

Check:

- nameservers are correctly updated at the registrar
- required records were imported correctly
- proxied vs DNS-only settings are intentional
- DNS propagation and TTL expectations are realistic

### SSL/TLS problems

Check:

- SSL/TLS mode matches origin cert reality
- origin certificate validity
- redirect loops from mismatched origin/app settings
- whether both the origin and Cloudflare are forcing redirects in conflicting ways

### Site works unproxied but fails when proxied

Check:

- origin firewall rules
- application reliance on client IP assumptions
- unsupported traffic type on a proxied hostname
- header handling and host validation at origin

### Tunnel problems

Check:

- `cloudflared` authentication and tunnel config
- local service actually listening on the expected port
- mapped hostname configuration
- local firewall or SELinux/AppArmor restrictions if relevant

### Access problems

Check:

- identity provider configuration
- group/user mapping
- policy order and precedence
- callback/redirect URI correctness

### Cache problems

Check:

- origin cache headers
- cache rules and bypass rules
- cookies or auth causing bypass
- asset URL versioning strategy

---

## Suggested learning path

If you want to really learn Cloudflare without getting overwhelmed, follow this order.

### Level 1: understand the edge model
Learn:

- DNS
- proxied vs DNS-only records
- SSL/TLS modes
- CDN/cache basics
- WAF basics

### Level 2: operate a public website safely
Do:

- onboard a domain
- enable Full (strict)
- turn on managed WAF rules
- add rate limiting
- review analytics and events

### Level 3: secure private resources
Do:

- publish a service through Tunnel
- put Access in front of it
- add identity provider integration

### Level 4: build on the platform
Do:

- deploy a site with Pages
- deploy an API with Workers
- add R2 or another data service

### Level 5: adopt platform-native architecture
Explore:

- Durable Objects
- D1 / KV / Hyperdrive choice tradeoffs
- Queues / Workflows
- observability and scaling patterns

---

## Example adoption blueprints

### Blueprint 1: small business website

Use:

- Cloudflare DNS
- proxied web records
- Full (strict)
- WAF managed rules
- basic caching rules
- Access for `/admin`

Outcome:

- faster site
- safer public exposure
- simpler HTTPS and basic hardening

### Blueprint 2: startup SaaS app

Use:

- DNS + proxy + WAF
- Pages for frontend
- Workers for APIs/middleware
- R2 for uploads
- Access for internal dashboards
- Tunnel for private internal tooling

Outcome:

- modern app stack with public and internal surfaces separated cleanly

### Blueprint 3: internal tool without VPN friction

Use:

- Tunnel
- Access
- IdP integration
- optional WARP for device-aware policies

Outcome:

- internal web app accessible securely without broad network exposure

### Blueprint 4: personal use

Use:

- 1.1.1.1
- WARP app

Outcome:

- quick privacy/security improvement without managing domains or servers

---

## Common mistakes to avoid

1. Using Flexible SSL in production when better options exist.
2. Turning on Cloudflare without restricting direct origin exposure.
3. Expecting automatic caching of dynamic or personalized content.
4. Creating too many custom rules before understanding default behavior.
5. Treating WARP like a generic consumer streaming VPN.
6. Publishing sensitive services with Tunnel but skipping Access.
7. Choosing data products without matching them to access patterns.
8. Migrating too many features at once instead of staged rollout.

---

## Glossary

### Anycast
A routing approach where users are directed to a nearby network location advertising the same IP range.

### Proxied record
A DNS record whose web traffic is routed through Cloudflare’s reverse proxy.

### Origin
The upstream server or service that actually serves your application or content.

### Edge
Cloudflare’s distributed network locations where traffic handling, caching, and code execution can occur.

### WAF
Web Application Firewall. Filters malicious or unwanted web requests.

### Tunnel
A secure outbound connector from your infrastructure to Cloudflare.

### Access
Identity-aware control over who can reach an application.

### Worker
A Cloudflare serverless program that handles requests or background tasks.

### R2 bucket
A container for storing objects in Cloudflare R2.

### Team domain
Your Zero Trust organization subdomain, such as `example.cloudflareaccess.com`.

---

## Recommended “first 30 minutes” checklist

If you want a practical first session with Cloudflare, do this:

### For a website owner

- create account
- add domain
- verify DNS import
- switch nameservers
- set SSL/TLS to Full (strict)
- proxy `www`
- test site
- enable WAF managed rules

### For a developer

- create account
- deploy a simple Pages project
- deploy a hello-world Worker
- create an R2 bucket
- read about storage bindings and environment secrets

### For an internal tool admin

- create account / Zero Trust org
- set up team domain
- connect IdP
- install `cloudflared`
- publish one internal app via Tunnel
- protect it with Access

### For an individual

- install the 1.1.1.1 / WARP app
- choose an appropriate mode
- verify connectivity and DNS behavior

---

## How to decide what to try first

Ask yourself one question:

### “What outcome do I want this week?”

- Faster and safer website → onboard your domain
- Safer way to expose an internal app → Tunnel + Access
- New app deployment workflow → Pages + Workers
- File/object storage → R2
- Personal privacy/security on device → WARP

That is the best way to avoid getting lost in the size of the platform.

---

## Official references

The guide above is based on Cloudflare’s official documentation and product pages.

- Cloudflare Docs home: https://developers.cloudflare.com/
- Fundamentals / getting started: https://developers.cloudflare.com/fundamentals/get-started/
- Cloudflare DNS: https://developers.cloudflare.com/dns/
- DNS getting started: https://developers.cloudflare.com/dns/get-started/
- Cloudflare WAF getting started: https://developers.cloudflare.com/waf/get-started/
- Cloudflare Tunnel: https://developers.cloudflare.com/tunnel/
- Tunnel setup: https://developers.cloudflare.com/tunnel/setup/
- Cloudflare One / Zero Trust setup: https://developers.cloudflare.com/cloudflare-one/setup/
- Zero Trust initial setup learning path: https://developers.cloudflare.com/learning-paths/secure-internet-traffic/initial-setup/
- Workers overview: https://developers.cloudflare.com/workers/
- Workers CLI getting started: https://developers.cloudflare.com/workers/get-started/guide/
- Pages overview: https://developers.cloudflare.com/pages/
- Pages getting started: https://developers.cloudflare.com/pages/get-started/
- R2 overview: https://developers.cloudflare.com/r2/
- R2 getting started: https://developers.cloudflare.com/r2/get-started/
- R2 how it works: https://developers.cloudflare.com/r2/how-r2-works/
- Storage options for Workers: https://developers.cloudflare.com/workers/platform/storage-options/
- Hyperdrive overview: https://developers.cloudflare.com/hyperdrive/
- Hyperdrive getting started: https://developers.cloudflare.com/hyperdrive/get-started/
- WARP client overview: https://developers.cloudflare.com/warp-client/
- WARP client getting started: https://developers.cloudflare.com/warp-client/get-started/
- Cloudflare plans: https://www.cloudflare.com/plans/
- Pro plan overview: https://www.cloudflare.com/plans/pro/
- Business plan overview: https://www.cloudflare.com/plans/business/

---

## Final advice

Cloudflare is easiest to adopt when you treat it as a toolbox, not a monolith.

Start with one concrete problem:

- protect a website
- expose a private app safely
- deploy a frontend
- build an API
- store files
- secure internal access

Then add features in layers. That approach lets you get real value quickly without getting buried in the platform’s breadth.
