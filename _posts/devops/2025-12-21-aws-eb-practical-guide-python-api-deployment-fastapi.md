---
title: "AWS Elastic Beanstalk Practical Guide for Deploying Python APIs (FastAPI)"
date: 2025-12-21 12:00:00 +0900
tags: [aws, elastic-beanstalk, fastapi, deployment]
---


## What Elastic Beanstalk is

AWS Elastic Beanstalk is a managed service that helps you **deploy, run, and scale** applications on AWS by handling a lot of the “glue work” (provisioning, configuration, health monitoring, deployments) while still letting you customize underlying AWS resources when needed. ([AWS Documentation][1])

**Typical workflow:** create an **application**, upload an **application version** (your code as a source bundle), and Elastic Beanstalk launches an **environment** with the AWS resources required to run it. ([AWS Documentation][1])

---

## Core concepts (EB vocabulary)

* **Application**: A logical container for EB components (environments + versions).
* **Environment**: The running infrastructure for one version of your app (e.g., dev, staging, prod). ([AWS Documentation][1])
* **Application version**: A specific uploaded build of your code; EB creates one whenever you upload/deploy source code. ([AWS Documentation][2])
* **Platform**: The runtime stack (e.g., Python on Amazon Linux) that EB provisions/maintains. ([AWS Documentation][3])

---

## Environment types (how your app runs)

Elastic Beanstalk lets you choose an environment style based on your needs:

* **Single-instance**: simplest, lowest cost for dev/test.
* **Load-balanced, scalable**: uses a load balancer + Auto Scaling for production workloads. ([AWS Documentation][4])

---

## Pricing (what you pay for)

Elastic Beanstalk has **no additional service charge**—you pay for the AWS resources it provisions (EC2, load balancer, S3, etc.). ([Amazon Web Services, Inc.][5])

---

## How deployments work in EB

### Source bundle (your deployable artifact)

When deploying via the console (and often in automation), you upload your app as a **source bundle** (typically a `.zip`) with a specific structure and requirements described in the EB docs. ([AWS Documentation][6])

### Deployment policies

EB supports different deployment behaviors (rolling, etc.), and each deployment gets a **deployment ID** (useful for troubleshooting when updates fail). ([AWS Documentation][7])

### Blue/green deployments (near-zero downtime)

A common safe approach is:

1. clone or create a **new environment** (green),
2. deploy the new version there,
3. test it,
4. **swap** the environment URLs/CNAMEs to shift traffic quickly. ([AWS Documentation][8])

---

## Installing and using the EB CLI (recommended for developers)

The **EB CLI** provides interactive commands to create/update/monitor EB environments from your terminal. ([AWS Documentation][9])

Useful docs:

* Setup overview (EB CLI) ([AWS Documentation][9])
* Command reference ([AWS Documentation][10])
* `eb init` behavior ([AWS Documentation][11])
* `eb deploy` ([AWS Documentation][12])
* `eb logs` ([AWS Documentation][13])

---

## Configuration & customization (the EB way)

### 1) Environment variables (Environment properties)

You can define environment properties (environment variables) to pass config like database URLs, API keys, debug flags, etc. ([AWS Documentation][14])
You can set them in the console under your environment’s configuration screens. ([AWS Documentation][15])

### 2) `.ebextensions` configuration files (advanced customization)

You can place YAML/JSON `.config` files under a folder named `.ebextensions/` to customize your environment and even underlying AWS resources. ([AWS Documentation][16])

You can also use `option_settings` in these files to modify EB configuration and define variables that become environment variables for your app. ([AWS Documentation][17])

### 3) Procfile (Python web process command)

On the EB **Python** platform, you can use a `Procfile` to configure the command that starts your web server (the EB docs describe this for WSGI servers). The default listening port is **8000**. ([AWS Documentation][18])

> FastAPI is **ASGI**, not WSGI. A common pattern is to run **Gunicorn** with an **ASGI worker** (Uvicorn worker) from a Procfile—this usually works well on EB’s Python platform because EB is really just starting the process you specify.

### 4) Managed platform updates (keep runtimes patched)

EB regularly releases platform updates (fixes, security updates, features). You can enable **managed platform updates** to upgrade automatically during a scheduled maintenance window. ([AWS Documentation][19])

---

## Observability: health + logs

### Enhanced health

Enhanced health reporting gives a better picture of environment health and helps identify issues that could cause unavailability. In many newer environments it’s enabled by default, and newer platform versions include a health agent. ([AWS Documentation][20])

### Logs

You can retrieve logs via the console or EB CLI, and you can also publish logs to S3 or stream to CloudWatch Logs. ([AWS Documentation][21])

---

## Step-by-step example: Deploy a FastAPI app to Elastic Beanstalk (Python platform + Procfile)

This walkthrough uses:

* **FastAPI** for the API
* **Gunicorn + Uvicorn worker** to serve ASGI
* **EB CLI** to create and deploy the environment

## 0) Prerequisites

* AWS account and credentials configured locally (via standard AWS auth methods)
* Python 3.x locally
* EB CLI installed and working (EB CLI setup guide) ([AWS Documentation][9])

---

## 1) Create a minimal FastAPI project

**Folder structure**

```
fastapi-eb-demo/
  main.py
  requirements.txt
  Procfile
```

**main.py**

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/hello")
def hello(name: str = "world"):
    return {"message": f"Hello, {name}!"}
```

**requirements.txt**

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
gunicorn==22.0.0
```

**Procfile**

Elastic Beanstalk’s Python platform expects your web process to listen on port **8000** by default. ([AWS Documentation][18])

```procfile
web: gunicorn -k uvicorn.workers.UvicornWorker --bind :8000 --workers 2 main:app
```

> Notes:
>
> * `main:app` means “import `app` from `main.py`”.
> * Increase `--workers` as needed (start small).

---

## 2) Test locally (recommended)

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Visit:

* `http://127.0.0.1:8000/health`
* `http://127.0.0.1:8000/hello?name=Ryan`

---

## 3) Initialize Elastic Beanstalk in the project

From inside the project directory:

```bash
eb init
```

`eb init` sets defaults for your project directory and creates an Elastic Beanstalk application in your account; you typically create the environment afterward with `eb create`. ([AWS Documentation][11])

During prompts:

* Choose a **region**
* Choose the **Python** platform
* (Optional) Set up SSH keypair if you want to SSH into instances

---

## 4) Create an environment

For a first deployment, a single-instance environment is fine; for production you’ll usually want load-balanced/scalable. ([AWS Documentation][4])

```bash
eb create fastapi-eb-demo-dev
```

(EB CLI overview mentions creating environments with a single command like `eb create ...`.) ([AWS Documentation][9])

---

## 5) Deploy your FastAPI app

```bash
eb deploy
```

`eb deploy` deploys code changes to your environment’s instances. ([AWS Documentation][12])

When it finishes:

```bash
eb open
```

Try:

* `/health`
* `/hello?name=beanstalk`

---

## 6) Set environment variables (optional but common)

Use environment properties (environment variables) for configuration values. ([AWS Documentation][14])

### Option A: Console

Go to your environment → **Configuration** and update runtime environment variables in the settings UI. ([AWS Documentation][15])

### Option B: `.ebextensions` (version-controlled)

Create `.ebextensions/01-env.config`:

```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    APP_ENV: "dev"
    LOG_LEVEL: "info"
```

`option_settings` can modify EB configuration and define variables retrievable as environment variables. ([AWS Documentation][17])
`.ebextensions` files live in a `.ebextensions/` directory and are deployed with your source bundle. ([AWS Documentation][16])

Deploy again:

```bash
eb deploy
```

---

## 7) View health and logs (debugging basics)

### Health

Enhanced health can help identify problems that could make your app unavailable. ([AWS Documentation][20])

You can view health in the console, and also:

```bash
eb health
```

### Logs

```bash
eb logs
```

`eb logs` retrieves logs (tail logs by default unless you request full logs). ([AWS Documentation][13])
You can also retrieve/download logs in the console and publish to S3 or stream to CloudWatch Logs. ([AWS Documentation][21])

---

## Production checklist (practical recommendations)

* Use a **load-balanced, scalable** environment for production. ([AWS Documentation][4])
* Use **blue/green + CNAME swap** for safer releases. ([AWS Documentation][8])
* Enable **managed platform updates** on a maintenance window to keep the runtime patched. ([AWS Documentation][19])
* Keep secrets out of code; use **environment properties**. ([AWS Documentation][14])
* Centralize logs (S3/CloudWatch) for easier incident response. ([AWS Documentation][21])

---

## Quick reference (handy EB CLI commands)

* Initialize project: `eb init` ([AWS Documentation][11])
* Create env: `eb create <env-name>` ([AWS Documentation][9])
* Deploy: `eb deploy` ([AWS Documentation][12])
* Open in browser: `eb open`
* Status/health: `eb status`, `eb health`
* Logs: `eb logs` ([AWS Documentation][13])

---

If you tell me whether you want **single-instance** (cheap/dev) or **load-balanced/scalable** (prod), and whether you’ll use **RDS** (Postgres/MySQL), I can add a ready-to-copy `.ebextensions` set for common API needs (timeouts, log streaming, instance sizing, etc.).

[1]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/Welcome.html?utm_source=chatgpt.com "What is AWS Elastic Beanstalk? - AWS Elastic Beanstalk"
[2]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/applications-versions.html?utm_source=chatgpt.com "Managing application versions - AWS Elastic Beanstalk"
[3]: https://docs.aws.amazon.com/elastic-beanstalk/?utm_source=chatgpt.com "AWS Elastic Beanstalk Documentation"
[4]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features-managing-env-types.html?utm_source=chatgpt.com "Environment types - AWS Elastic Beanstalk"
[5]: https://aws.amazon.com/elasticbeanstalk/pricing/?utm_source=chatgpt.com "AWS Elastic Beanstalk Pricing - Amazon Web Services (AWS)"
[6]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/applications-sourcebundle.html?utm_source=chatgpt.com "Create an Elastic Beanstalk application source bundle"
[7]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.deploy-existing-version.html?utm_source=chatgpt.com "Deploying applications to Elastic Beanstalk environments"
[8]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.CNAMESwap.html?utm_source=chatgpt.com "Blue/Green deployments with Elastic Beanstalk"
[9]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html?utm_source=chatgpt.com "Setting up the EB command line interface (EB CLI) to manage Elastic ..."
[10]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb3-cmd-commands.html?utm_source=chatgpt.com "EB CLI command reference - AWS Elastic Beanstalk"
[11]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb3-init.html?utm_source=chatgpt.com "eb init - AWS Elastic Beanstalk"
[12]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb3-deploy.html?utm_source=chatgpt.com "eb deploy - AWS Elastic Beanstalk"
[13]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb3-logs.html?utm_source=chatgpt.com "eb logs - AWS Elastic Beanstalk"
[14]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/environments-cfg-softwaresettings.html?utm_source=chatgpt.com "Environment variables and other software settings - AWS Elastic Beanstalk"
[15]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/environments-cfg-console.html?utm_source=chatgpt.com "Environment configuration using the Elastic Beanstalk console"
[16]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/ebextensions.html?utm_source=chatgpt.com "Advanced environment customization with configuration files"
[17]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/ebextensions-optionsettings.html?utm_source=chatgpt.com "Option settings - AWS Elastic Beanstalk"
[18]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/python-configuration-procfile.html?utm_source=chatgpt.com "Configuring the WSGI server with a Procfile on Elastic Beanstalk"
[19]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/environment-platform-update-managed.html?utm_source=chatgpt.com "Managed platform updates - AWS Elastic Beanstalk"
[20]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/health-enhanced.html?utm_source=chatgpt.com "Enhanced health reporting and monitoring in Elastic Beanstalk"
[21]: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.logging.html?utm_source=chatgpt.com "Viewing logs from Amazon EC2 instances in your Elastic Beanstalk ..."
