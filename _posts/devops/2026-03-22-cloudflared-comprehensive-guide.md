---
title: "cloudflared Comprehensive Guide"
date: 2026-03-22 10:16:00 +0900
tags: [cloudflare, cloudflared, tunnel, zero-trust, devops]
---

# `cloudflared` Comprehensive Guide

> Last reviewed: 2026-03-22  
> Primary sources: Cloudflare official docs and the `cloudflare/cloudflared` GitHub releases page.

## 1. What `cloudflared` is

`cloudflared` is Cloudflare’s lightweight connector daemon for **Cloudflare Tunnel**. You run it inside your infrastructure, and it creates **outbound-only**, persistent connections from your host or network to Cloudflare’s edge. That lets you publish internal services through Cloudflare **without exposing a public origin IP** or opening inbound firewall ports. Cloudflare applies features like CDN, WAF, DDoS protection, and Access policies at the edge before traffic reaches your origin. :contentReference[oaicite:0]{index=0}

In practice, `cloudflared` is used for three main jobs:

1. **Publishing internal apps to the Internet** through Cloudflare Tunnel.
2. **Providing secure client access** to protected services such as SSH, RDP, and arbitrary TCP apps.
3. **Running and managing tunnel connectors** with local or remote configuration. :contentReference[oaicite:1]{index=1}

## 2. Where `cloudflared` fits in Cloudflare

A simple mental model:

- Your app runs on `localhost` or a private IP.
- `cloudflared` dials out to Cloudflare.
- Cloudflare maps a hostname to that tunnel.
- Requests hit Cloudflare first, then get proxied back through the tunnel to your origin. :contentReference[oaicite:2]{index=2}

This is different from traditional reverse proxy exposure, where you open inbound ports or publish your server directly.

## 3. Key concepts

### Tunnel
A Tunnel is the logical object in Cloudflare that represents a connection path from Cloudflare to your infrastructure. The tunnel persists independently of a single connector process. :contentReference[oaicite:3]{index=3}

### Connector
A connector is a running `cloudflared` process attached to a tunnel. You can run multiple connectors for the same tunnel for high availability. :contentReference[oaicite:4]{index=4}

### Ingress rule
An ingress rule tells `cloudflared` how to map an incoming hostname or path to a local service such as `http://localhost:8080` or `ssh://localhost:22`. Rules are matched in order, and a catch-all rule is typically placed last. :contentReference[oaicite:5]{index=5}

### Quick Tunnel
A temporary Tunnel on `trycloudflare.com` meant for testing and development. It does not require you to onboard a zone into Cloudflare DNS. Cloudflare explicitly says Quick Tunnels are **not for production**. :contentReference[oaicite:6]{index=6}

### Locally-managed vs remotely-managed
Cloudflare’s current docs distinguish between management approaches. For production, Cloudflare recommends using a standard managed tunnel rather than a Quick Tunnel, and operational docs increasingly favor remotely-managed tunnels in some environments such as Docker. :contentReference[oaicite:7]{index=7}

## 4. Main use cases

### Publish an internal web app
Expose a local web app like `http://localhost:8080` as `app.example.com` through Cloudflare without opening inbound ports. :contentReference[oaicite:8]{index=8}

### Protect SSH, RDP, or TCP apps with Cloudflare Access
`cloudflared` can proxy non-HTTP apps and combine that with Cloudflare Access authentication and identity policies. Cloudflare documents flows for arbitrary TCP, where the server-side connector is paired with `cloudflared access tcp` on the client side. :contentReference[oaicite:9]{index=9}

### Private network connectivity
For private network routing to users running the Cloudflare One client, the config enables `warp-routing`. :contentReference[oaicite:10]{index=10}

### High-availability ingress
A single tunnel already opens four outbound connections to at least two Cloudflare data centers. You can add more `cloudflared` replicas to increase availability. Cloudflare currently documents up to **25 replicas (100 connections) per tunnel**. :contentReference[oaicite:11]{index=11}

## 5. Installation

Cloudflare provides platform-specific install methods and direct downloads. The official docs point to package repositories, GitHub releases, Windows `winget`, and Docker images. `cloudflared` is open source and maintained in the `cloudflare/cloudflared` repository. :contentReference[oaicite:12]{index=12}

### Linux
Use Cloudflare’s package repository or download the binary/package directly. :contentReference[oaicite:13]{index=13}

### macOS
Install from the official package/downloads listed in Cloudflare docs or GitHub releases. :contentReference[oaicite:14]{index=14}

### Windows
Cloudflare documents installation via:

```bash
winget install --id Cloudflare.cloudflared
````

Windows instances do **not** auto-update automatically, so you need a manual update process. ([Cloudflare Docs][1])

### Docker

Cloudflare publishes an official Docker image. For Docker, Cloudflare specifically recommends remotely-managed tunnels. ([Cloudflare Docs][1])

## 6. First steps: the common production workflow

A typical named-tunnel setup looks like this:

1. Install `cloudflared`.
2. Authenticate it to your Cloudflare account.
3. Create a named tunnel.
4. Create/configure a `config.yml`.
5. Route a public hostname to a local service.
6. Run it as a service. ([Cloudflare Docs][2])

Cloudflare’s docs explicitly note that to create and manage tunnels, you install and authenticate `cloudflared` on the origin server. ([Cloudflare Docs][2])

## 7. Authentication and setup basics

For CLI-authenticated setups, Cloudflare documents:

```bash
cloudflared tunnel login
```

This opens a browser for Cloudflare account authentication and downloads credentials that let `cloudflared` manage DNS or tunnel resources for the selected zone. On headless systems, you can copy the login URL to another machine. ([Cloudflare Docs][3])

## 8. Quick Tunnel: fastest way to test

For temporary testing, run:

```bash
cloudflared tunnel --url http://localhost:8080
```

This creates a random public URL on `trycloudflare.com` and forwards traffic to your local service. Quick Tunnels are for testing/development only, have no SLA, and Cloudflare notes some limitations, including that they are not supported when a `.cloudflared/config.yaml` file is present unless you rename it temporarily. ([Cloudflare Docs][4])

### When to use Quick Tunnels

Use them for:

* demos
* temporary previews
* browser/device testing
* sharing a dev environment quickly

Do **not** use them as your long-term production exposure layer. ([Cloudflare Docs][4])

## 9. Configuration file structure

For locally-managed tunnels, Cloudflare documents a YAML configuration file. A published-app example looks like this:

```yaml
tunnel: <Tunnel-UUID>
credentials-file: /root/.cloudflared/<Tunnel-UUID>.json

ingress:
  - hostname: app.example.com
    service: http://localhost:8080

  - hostname: ssh.example.com
    service: ssh://localhost:22

  - service: http_status:404
```

Cloudflare’s docs show the same structure and emphasize that the configuration file is especially useful when routing multiple services or setting origin-specific options. Quick Tunnels do not need a config file. ([Cloudflare Docs][5])

### Important notes

* Without a configuration file, `cloudflared` proxies outbound traffic through port `8080`. ([Cloudflare Docs][5])
* For private-network routing, enable:

```yaml
warp-routing:
  enabled: true
```

([Cloudflare Docs][5])

## 10. Ingress rules: how routing works

Ingress rules tell `cloudflared` which local service to use for each hostname/path. Cloudflare’s published example includes both HTTP and SSH services, then ends with a catch-all `http_status:404`. ([Cloudflare Docs][5])

A practical pattern is:

```yaml
ingress:
  - hostname: app.example.com
    service: http://localhost:8080

  - hostname: api.example.com
    service: http://localhost:9000

  - hostname: ssh.example.com
    service: ssh://localhost:22

  - service: http_status:404
```

That last rule is important so unmatched requests fail closed instead of behaving unpredictably.

## 11. Running `cloudflared` as a service

For Linux, Cloudflare documents installing `cloudflared` as a system service:

```bash
cloudflared service install
systemctl start cloudflared
systemctl status cloudflared
```

If you install with `sudo`, `$HOME` may resolve to `/root`, so Cloudflare recommends passing `--config` explicitly when needed:

```bash
sudo cloudflared --config /home/<USER>/.cloudflared/config.yml service install
```

After config changes, restart the service:

```bash
systemctl restart cloudflared
```

Cloudflare states that at minimum the service config must include `tunnel` and `credentials-file`. ([Cloudflare Docs][6])

## 12. High availability and replicas

Each running tunnel establishes **four outbound-only connections** to at least **two distinct Cloudflare data centers**. This gives built-in redundancy even before you add extra replicas. ([Cloudflare Docs][7])

For more availability, you can run multiple `cloudflared` instances against the same tunnel. Cloudflare says:

* each replica adds four more connections
* traffic routes to the geographically closest replica
* up to 25 replicas are supported per tunnel ([Cloudflare Docs][8])

This makes it practical to run connectors on multiple hosts, VMs, or nodes.

## 13. Firewall and network model

One of the biggest benefits of `cloudflared` is the **outbound-only connection model**. Your origin initiates the connection to Cloudflare, and once established, traffic can flow in both directions over the tunnel. Cloudflare notes that this works well with most firewalls because outbound traffic is usually already allowed. ([Cloudflare Docs][9])

For some client/server Access examples, Cloudflare specifically calls out permitting egress on ports **80 and 443**; otherwise `cloudflared` may fail. ([Cloudflare Docs][3])

Operationally, many teams pair `cloudflared` with a stricter firewall posture:

* allow outbound to Cloudflare
* deny public inbound to the origin
* rely on Cloudflare for edge exposure and policy enforcement

## 14. TCP, SSH, and non-HTTP access

Cloudflare documents an arbitrary TCP flow where `cloudflared` runs both on the protected host and on the client machine.

### Server-side example

```bash
cloudflared tunnel --hostname tcp.site.com --url tcp://localhost:7870
```

### Client-side example

```bash
cloudflared access tcp --hostname tcp.site.com --url localhost:9210
```

When the client connects, `cloudflared` opens a browser for authentication with the configured identity provider, then forwards local traffic to the protected remote service through Cloudflare Access. Cloudflare’s docs present this as the pattern for arbitrary TCP services and note that it can be wrapped in shortcuts for end users. ([Cloudflare Docs][3])

This general model also underpins secure SSH/RDP exposure through Cloudflare.

## 15. Observability and metrics

When a tunnel runs, `cloudflared` exposes a **Prometheus-format metrics endpoint**. Cloudflare documents the default metrics bind behavior as:

* **non-containerized**: `127.0.0.1:<PORT>/metrics`
* **containerized**: `0.0.0.0:<PORT>/metrics`

The default port is the first available port from **20241 to 20245**; if all are unavailable, `cloudflared` picks a random port. ([Cloudflare Docs][10])

### Example custom metrics binding

```bash
cloudflared tunnel --metrics 127.0.0.1:60123 run my-tunnel
```

Then check:

```text
http://localhost:60123/metrics
```

Cloudflare suggests checking startup logs to see which metrics address/port was selected. ([Cloudflare Docs][10])

## 16. Updating `cloudflared`

Cloudflare’s official support policy says it supports `cloudflared` versions that are **within one year of the most recent release**. Older versions may encounter breaking changes. ([Cloudflare Docs][1])

### Current release snapshot

The GitHub releases page currently shows **2026.3.0** as the latest release, published on **2026-03-09**. ([GitHub][11])

### Update methods

Cloudflare documents:

* if installed from GitHub binaries or source:

```bash
cloudflared update
```

* if installed via package manager: update using that same package manager
* for Docker: pull a newer image and recreate the container with the documented tunnel command ([Cloudflare Docs][12])

### Zero-downtime update guidance

Cloudflare documents two main approaches:

* use Cloudflare Load Balancer
* use multiple `cloudflared` instances and shift traffic

Cloudflare also warns that stopping an old replica drops long-lived HTTP requests, TCP sessions, and UDP flows; new traffic goes to the new replica once connected. ([Cloudflare Docs][12])

## 17. Common deployment patterns

### Pattern A: Single internal web app

* `app.example.com` → `http://localhost:8080`
* simplest named tunnel use case
* easy to run as a systemd service

### Pattern B: Multiple services behind one tunnel

Use multiple ingress rules in one config file:

* `app.example.com` → app
* `api.example.com` → API
* `ssh.example.com` → SSH ([Cloudflare Docs][5])

### Pattern C: Private network access

Enable:

```yaml
warp-routing:
  enabled: true
```

This is for routing private IP ranges to users running the Cloudflare One client. ([Cloudflare Docs][5])

### Pattern D: Protected TCP app

* server runs a tunnel to a TCP service
* clients run `cloudflared access tcp`
* authentication is enforced by Cloudflare Access ([Cloudflare Docs][3])

## 18. Security advantages

`cloudflared` improves origin security in several ways:

* no public origin IP required
* no inbound ports need to be opened for the service
* Cloudflare sits in front of the app before requests hit origin
* Access policies can gate who reaches the application
* the tunnel uses outbound-only, post-quantum encrypted connections according to Cloudflare’s docs ([Cloudflare Docs][7])

For many teams, this is the simplest path to “private origin, public edge.”

## 19. Limitations and caveats

### Quick Tunnels

Cloudflare says Quick Tunnels:

* are for testing/development only
* have no SLA
* should not be used for production
* can conflict with an existing local config file
* have feature limitations such as lack of SSE support noted in the docs/search preview ([Cloudflare Docs][4])

### Long-lived connections during upgrades

Stopping an old connector can interrupt WebSocket, SSH, TCP, and UDP flows. Plan rolling upgrades carefully. ([Cloudflare Docs][12])

### Windows updates

Cloudflare notes Windows installs do not auto-update, so patching must be explicit. ([Cloudflare Docs][1])

## 20. Troubleshooting checklist

### Tunnel will not connect

Check:

* outbound access is allowed
* the host can reach Cloudflare over required egress paths
* you are on a supported `cloudflared` version ([Cloudflare Docs][3])

### Service starts manually but not via systemd

Common issue: `sudo` changes `$HOME` to `/root`, so the service cannot find the config file in your user home. Use an explicit config path when installing the service. ([Cloudflare Docs][6])

### Metrics endpoint missing

Check startup logs for the actual bound address/port. `cloudflared` may choose 20241–20245 or a random port if those are occupied. ([Cloudflare Docs][10])

### Quick Tunnel fails unexpectedly

If `.cloudflared/config.yaml` is present, Quick Tunnel mode may not work until you rename the config temporarily. ([Cloudflare Docs][4])

### TCP app works on server but not on client

Check:

* Access policy exists and matches the hostname
* client is using `cloudflared access tcp`
* the local client app points to the local forwarded port
* egress on ports 80/443 is allowed ([Cloudflare Docs][3])

## 21. Practical best practices

### Use named tunnels for production

Quick Tunnels are for short-lived testing only. Use a managed tunnel for production services. ([Cloudflare Docs][4])

### Keep `cloudflared` current

Stay within Cloudflare’s one-year support window and maintain a regular update cadence. ([Cloudflare Docs][1])

### Run multiple replicas for important services

This improves resilience and simplifies rolling upgrades. ([Cloudflare Docs][8])

### Expose metrics

Bind a known metrics address and scrape it with Prometheus or your monitoring stack. ([Cloudflare Docs][10])

### Prefer explicit config files for multi-service setups

They are easier to audit, version-control, and operate than ad hoc CLI flags. ([Cloudflare Docs][5])

### Lock down the origin

Once the tunnel is working, avoid leaving legacy public exposure paths open. The main security value comes from making Cloudflare the enforced ingress path. ([Cloudflare Docs][9])

## 22. Minimal example configs

### Web app only

```yaml
tunnel: <Tunnel-UUID>
credentials-file: /etc/cloudflared/<Tunnel-UUID>.json

ingress:
  - hostname: app.example.com
    service: http://localhost:8080
  - service: http_status:404
```

### Web app + SSH

```yaml
tunnel: <Tunnel-UUID>
credentials-file: /etc/cloudflared/<Tunnel-UUID>.json

ingress:
  - hostname: app.example.com
    service: http://localhost:8080
  - hostname: ssh.example.com
    service: ssh://localhost:22
  - service: http_status:404
```

### Private routing

```yaml
tunnel: <Tunnel-UUID>
credentials-file: /etc/cloudflared/<Tunnel-UUID>.json

warp-routing:
  enabled: true
```

These are aligned with the structures Cloudflare documents. ([Cloudflare Docs][5])

## 23. Command cheat sheet

```bash
# Quick test tunnel
cloudflared tunnel --url http://localhost:8080

# Authenticate CLI to Cloudflare
cloudflared tunnel login

# Install as Linux service
cloudflared service install

# Install as Linux service with explicit config
sudo cloudflared --config /home/<USER>/.cloudflared/config.yml service install

# Start/restart service
systemctl start cloudflared
systemctl restart cloudflared

# Run with custom metrics endpoint
cloudflared tunnel --metrics 127.0.0.1:60123 run my-tunnel

# Client-side TCP access
cloudflared access tcp --hostname tcp.site.com --url localhost:9210

# Update binary/source install
cloudflared update
```

These commands are drawn from Cloudflare’s current docs. ([Cloudflare Docs][4])

## 24. Summary

`cloudflared` is the connector that makes Cloudflare Tunnel work. Its core value is straightforward:

* keep origins private
* avoid inbound port exposure
* publish apps and services through Cloudflare
* add identity-aware access controls
* scale availability by adding replicas
* observe and maintain the connector like any other production daemon ([Cloudflare Docs][7])

For experimentation, use a Quick Tunnel. For production, use a named managed tunnel, run `cloudflared` as a service, monitor it, and keep it updated within Cloudflare’s supported release window. ([Cloudflare Docs][4])

[1]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/ "Downloads · Cloudflare One docs"
[2]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/ "Set up your first tunnel · Cloudflare One docs"
[3]: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/non-http/cloudflared-authentication/arbitrary-tcp/ "Arbitrary TCP · Cloudflare One docs"
[4]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/ "Quick Tunnels · Cloudflare One docs"
[5]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/ "Configuration file · Cloudflare One docs"
[6]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/linux/ "Run as a service on Linux · Cloudflare One docs"
[7]: https://developers.cloudflare.com/tunnel/ "Cloudflare Tunnel · Cloudflare Docs"
[8]: https://developers.cloudflare.com/tunnel/configuration/ "Configuration · Cloudflare Docs"
[9]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/ "Cloudflare Tunnel · Cloudflare One docs"
[10]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/monitor-tunnels/metrics/ "Tunnel metrics · Cloudflare One docs"
[11]: https://github.com/cloudflare/cloudflared/releases "Releases · cloudflare/cloudflared · GitHub"
[12]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/update-cloudflared/ "Update cloudflared · Cloudflare One docs"
