---
title: "Amazon ECS Express Mode"
date: 2026-04-06 15:54:00 +0900
tags: [aws, ecs, fargate, containers, devops]
---

# Amazon ECS Express Mode

_A practical guide with Mermaid diagrams and hands-on examples_

Updated: 2026-04-06

---

## 1) What it is

Amazon ECS Express Mode is AWS's simplified path for deploying **containerized web applications and APIs** on top of **Amazon ECS + AWS Fargate**.

Instead of manually creating an ECS service, Application Load Balancer, target groups, security groups, scaling policies, log groups, and certificates, you provide a **container image** plus two IAM roles:

- **Task execution role**
- **Infrastructure role**

Express Mode then provisions and wires up the rest for you.

A good mental model is:

> **App Runner-like simplicity, but built as normal ECS/Fargate infrastructure inside your own AWS account.**

---

## 2) The 30-second mental model

```mermaid
flowchart LR
    A[You provide<br/>Container image<br/>Execution role<br/>Infrastructure role] --> B[Amazon ECS Express Mode]
    B --> C[ECS Service on Fargate]
    B --> D[Application Load Balancer]
    B --> E[HTTPS / TLS]
    B --> F[Auto Scaling]
    B --> G[CloudWatch Logs]
    B --> H[Networking + Security Groups]
    C --> I[Your running web app / API]
```

**What this means in practice:**
- You still end up with standard AWS resources.
- You can inspect and customize them later.
- You avoid the initial ECS setup tax.

---

## 3) Where it fits in AWS

```mermaid
flowchart TD
    A[Need to run a containerized app] --> B{What do you want?}
    B -->|Simplest ECS path for HTTP app/API| C[ECS Express Mode]
    B -->|Full control from day one| D[ECS on Fargate]
    B -->|Kubernetes| E[EKS]
    B -->|Function-style event processing| F[AWS Lambda]
```

### Best fit
Use Express Mode when:
- Your workload is a **web app or HTTP API**.
- You want **production-shaped defaults** quickly.
- You want the option to **grow into normal ECS later**.

### Weaker fit
It is less ideal when:
- The workload is not mainly HTTP traffic.
- You already know you need advanced ECS customization from day one.
- You want a source-code build service like old App Runner workflows. Express Mode is **image-first**.

---

## 4) Why AWS is pushing it now

AWS has announced that **AWS App Runner is closed to new customers starting April 30, 2026**, and AWS recommends **Amazon ECS Express Mode** for migrations and similar use cases. That makes Express Mode the current AWS answer for people who want a simpler container deployment experience without leaving the ECS ecosystem.

```mermaid
flowchart LR
    A[App Runner-style simplicity] --> B[ECS Express Mode]
    B --> C[Standard ECS service]
    B --> D[Fargate tasks]
    B --> E[ALB + HTTPS]
    B --> F[Scaling + Logs + Networking]
```

---

## 5) What Express Mode creates for you

When you create an Express Mode service, AWS creates a bundle of standard resources in your account.

```mermaid
flowchart TD
    A[ECS Express Mode Service] --> B[ECS Cluster]
    A --> C[Task Definition]
    A --> D[ECS Service]
    A --> E[Application Load Balancer]
    A --> F[Target Group]
    A --> G[HTTPS Listener + ACM Certificate]
    A --> H[Security Groups]
    A --> I[CloudWatch Log Group]
    A --> J[Auto Scaling Policies]
    A --> K[Deployment Alarm]
```

This is the most important conceptual difference from App Runner:

- **App Runner** felt like a higher-level managed product boundary.
- **Express Mode** creates **normal ECS/Fargate resources in your account**.

That means there is no separate "graduation path" later. You are already on ECS.

---

## 6) Core inputs you must provide

### Required
1. **Container image**
2. **Task execution role**
3. **Infrastructure role**

### Often also needed
4. **Task role** if your app needs AWS API access, such as S3, DynamoDB, or Secrets Manager.
5. **Environment variables / secrets**
6. **Container port** and optionally a health-check path

```mermaid
flowchart LR
    A[Container image] --> D[Express Mode service]
    B[Task execution role] --> D
    C[Infrastructure role] --> D
    E[Optional: task role] --> D
    F[Optional: env vars / secrets] --> D
```

### Practical example
You already have a Docker image in ECR:

```text
123456789012.dkr.ecr.us-east-1.amazonaws.com/my-api:2026-04-06
```

Your app listens on port `8080` and needs to read a secret and write to S3.

That usually means:
- execution role: pull image + write logs
- infrastructure role: let Express Mode create ALB, ECS service, scaling, and related resources
- task role: let your application call S3 and Secrets Manager

---

## 7) Basic request flow

```mermaid
sequenceDiagram
    participant U as User / Client
    participant ALB as HTTPS Load Balancer
    participant ECS as ECS Service
    participant T as Fargate Task
    U->>ALB: HTTPS request
    ALB->>ECS: Route to target group
    ECS->>T: Forward request to healthy task
    T-->>ALB: HTTP response
    ALB-->>U: HTTPS response
```

### What to remember
- The **ALB is the front door**.
- Your container does **not** terminate public TLS directly; the load balancer handles that path.
- Health checks determine which tasks are considered ready for traffic.

---

## 8) Public vs private service patterns

### Public service
Use this when the app should be reachable from the public internet.

```mermaid
flowchart LR
    A[Internet Users] --> B[Internet-facing ALB]
    B --> C[Fargate Tasks in ECS Service]
    C --> D[Optional AWS services / databases]
```

Typical examples:
- public API
- SaaS frontend
- partner-facing webhook receiver

### Private service
Use this when the app should only be reachable inside your VPC or internal network path.

```mermaid
flowchart LR
    A[Internal clients / VPC] --> B[Internal ALB]
    B --> C[Fargate Tasks in ECS Service]
    C --> D[Private RDS / Redis / internal services]
```

Typical examples:
- internal admin dashboard
- back-office API
- service reachable only through VPN, Direct Connect, or internal network routing

---

## 9) Deployment lifecycle

```mermaid
flowchart TD
    A[Build container image] --> B[Push image to ECR or another registry]
    B --> C[Create or update Express Mode service]
    C --> D[Provision / update ECS + ALB + scaling + logs]
    D --> E[Health checks pass]
    E --> F[Traffic reaches new tasks]
```

### Practical example: normal developer workflow
1. Change application code.
2. Rebuild image.
3. Push image to ECR.
4. Update Express Mode service to the new image tag.
5. Watch logs, health checks, and traffic.

This is different from App Runner's source-code mode. Express Mode expects you to already have a built image.

---

## 10) First practical example: deploy a simple API

### Example application
Imagine a small Node.js API with one endpoint:

```javascript
import express from 'express';

const app = express();
const port = process.env.PORT || 8080;

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

app.get('/hello', (_req, res) => {
  res.json({ message: 'Hello from ECS Express Mode' });
});

app.listen(port, () => {
  console.log(`Listening on ${port}`);
});
```

### Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

### Build and push image

```bash
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

docker build -t my-api:2026-04-06 .
docker tag my-api:2026-04-06 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-api:2026-04-06

docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-api:2026-04-06
```

### Create the Express Mode service

```bash
aws ecs create-express-gateway-service \
  --service-name my-api \
  --execution-role-arn arn:aws:iam::123456789012:role/ecsTaskExecutionRole \
  --infrastructure-role-arn arn:aws:iam::123456789012:role/ecsInfrastructureRoleForExpressServices \
  --primary-container '{
    "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-api:2026-04-06",
    "containerPort": 8080,
    "environment": [
      {"name": "NODE_ENV", "value": "production"}
    ]
  }' \
  --health-check-path /health \
  --cpu 1024 \
  --memory 2048 \
  --scaling-target '{
    "minTaskCount": 1,
    "maxTaskCount": 4,
    "autoScalingMetric": "AVERAGE_CPU",
    "autoScalingTargetValue": 60
  }'
```

### What happens after this command

```mermaid
flowchart LR
    A[CLI create-express-gateway-service] --> B[Provision ECS service]
    A --> C[Provision ALB + target group]
    A --> D[Configure HTTPS + security groups]
    A --> E[Create scaling policy + logs]
    B --> F[Tasks start on Fargate]
    F --> G[Health checks pass]
    G --> H[Service URL becomes usable]
```

---

## 11) Second practical example: internal service with private dependencies

Suppose you are deploying an internal billing API that must:
- stay private
- reach a private RDS database
- be accessible only from inside the VPC

### Architecture

```mermaid
flowchart LR
    A[Internal users / apps] --> B[Internal ALB]
    B --> C[ECS Express Mode service on Fargate]
    C --> D[Private RDS]
    C --> E[Secrets Manager]
```

### What you would configure
- choose **private subnets**
- make the ALB **internal**
- attach a **task role** for Secrets Manager access
- pass DB connection info through **environment variables / secrets**
- ensure security groups allow app-to-database traffic

### Why this matters
This is a good example of Express Mode being simple **without** being limited to internet-facing apps.

---

## 12) Third practical example: custom domain

Suppose your service should be available at:

```text
api.example.com
```

AWS's customization guidance shows the rough flow:

```mermaid
flowchart LR
    A[api.example.com] --> B[Route 53 alias record]
    B --> C[ALB HTTPS listener]
    C --> D[Listener rule for host header api.example.com]
    D --> E[Target group]
    E --> F[Fargate tasks]
```

### What you do conceptually
1. Create or use an ACM certificate for `api.example.com`.
2. Attach that certificate to the ALB HTTPS listener.
3. Add a host-based listener rule for `api.example.com`.
4. Point DNS to the ALB.

### Why it matters
This shows the key Express Mode tradeoff:
- simpler initial deployment,
- but custom domain behavior is still grounded in standard ALB + ACM + DNS building blocks.

---

## 13) Scaling model

Express Mode uses ECS/Fargate tasks behind an ALB and can scale based on metrics such as CPU, memory, or request count per target.

```mermaid
flowchart TD
    A[Incoming traffic rises] --> B{Scaling metric exceeds target?}
    B -->|Yes| C[Increase task count]
    C --> D[More healthy targets behind ALB]
    B -->|No| E[Keep current task count]
```

### Documented defaults
- **min tasks:** 1
- **max tasks:** 20
- **metric:** CPU utilization
- **target value:** 60

### Practical example
Your API receives bursty daytime traffic.

You might set:
- min tasks: `2`
- max tasks: `10`
- metric: `REQUEST_COUNT_PER_TARGET`
- target: based on acceptable latency and task capacity

Use CPU-based scaling when CPU is the main bottleneck. Use request-count-based scaling when each request has similar cost and you want scaling behavior tied more directly to HTTP traffic.

---

## 14) Update and rollout behavior

AWS documents canary-style deployments for Express Mode updates.

```mermaid
flowchart LR
    A[Current service revision] --> B[Create new revision]
    B --> C[Shift small portion of traffic]
    C --> D{Errors / alarms?}
    D -->|Yes| E[Rollback]
    D -->|No| F[Shift remaining traffic]
    F --> G[Retire old revision]
```

### Practical example
You deploy image tag `my-api:2026-04-10`.

If the new version starts failing health checks or triggering rollback alarms, ECS can stop promotion and keep the older revision serving traffic. That gives you a safer update path than a single all-at-once switch.

### Operational takeaway
Treat every update like a small release event:
- watch health checks
- watch 4xx/5xx metrics
- watch logs during rollout

---

## 15) Logging, debugging, and troubleshooting

### Debugging flow

```mermaid
flowchart TD
    A[Service not working] --> B{Did tasks start?}
    B -->|No| C[Check IAM, image pull, quotas, networking]
    B -->|Yes| D{Are health checks passing?}
    D -->|No| E[Check container port, path, app startup]
    D -->|Yes| F{Requests still failing?}
    F -->|Yes| G[Check app logs, ALB routing, downstream dependencies]
    F -->|No| H[Service is healthy]
```

### Common problems
1. **Image pull failure**
   - wrong image URI
   - missing registry access
   - bad execution-role permissions

2. **Health check failure**
   - wrong container port
   - wrong health-check path
   - app is listening only on localhost instead of the container interface
   - startup time is too slow

3. **Dependency connectivity problems**
   - security groups block DB access
   - missing private networking or endpoints
   - secrets or env vars missing

4. **Quota / capacity issues**
   - account limits reached
   - Fargate capacity unavailable in selected setup

### A useful troubleshooting checklist
- Is the image accessible?
- Is the container listening on the configured port?
- Does `/health` actually return `200`?
- Did the ALB target group mark tasks healthy?
- Are CloudWatch logs showing startup errors?
- Can the task reach the database / secret / external endpoint it needs?

---

## 16) How it differs from App Runner

```mermaid
flowchart TB
    A[App Runner] --> A1[Could deploy from source code or image]
    A --> A2[Higher-level product boundary]
    A --> A3[Closed to new customers after 2026-04-30]

    B[ECS Express Mode] --> B1[Deploys container image]
    B --> B2[Creates standard ECS/Fargate infrastructure]
    B --> B3[Can customize underlying resources later]
```

### Simple comparison
| Topic | App Runner | ECS Express Mode |
|---|---|---|
| Input | Source code or image | Image |
| Under the hood | Managed service abstraction | ECS service on Fargate + ALB + scaling |
| Long-term AWS direction | Closed to new customers after 2026-04-30 | Recommended by AWS for similar use cases |
| Customization later | More bounded | Broader ECS customization available |

---

## 17) How it differs from plain ECS on Fargate

```mermaid
flowchart LR
    A[Plain ECS on Fargate] --> A1[You wire up more pieces yourself]
    A --> A2[Maximum flexibility]

    B[ECS Express Mode] --> B1[AWS wires up common pieces]
    B --> B2[Faster path to production-shaped defaults]
```

### Rule of thumb
- Pick **Express Mode** when you want a **fast, safe default** for a web app/API.
- Pick **plain ECS/Fargate** when you already know you need deep custom configuration immediately.

---

## 18) Cost model

Express Mode itself has **no extra service charge**. You pay for the underlying resources it creates, such as:
- Fargate compute
- Application Load Balancer
- CloudWatch logs and metrics
- data transfer

### Practical implication
This is not a separate pricing model like a standalone serverless product. Think of the bill as:

```text
ECS/Fargate + ALB + observability + network-related charges
```

### Example cost intuition
A tiny internal API may cost more than expected if the ALB is always running, even when traffic is low. That is one reason Express Mode is simplest operationally, but not always the absolute cheapest for every tiny workload shape.

---

## 19) Safe production practices

### Image tagging
Avoid floating tags like `latest` in production.

Better:
```text
my-api:2026-04-06
my-api:git-sha-abc1234
```

### Health checks
Keep a lightweight endpoint such as:
```text
/health
```
that returns `200` when the app is ready to serve traffic.

### Statelesness
Design the service so tasks can be replaced safely.
Store durable state in managed services such as databases, caches, or object storage.

### IAM separation
- execution role: pull image, write logs
- task role: application permissions
- infrastructure role: Express Mode provisioning permissions

### Observability
At minimum, monitor:
- task count
- health-check status
- 4xx/5xx error rate
- latency
- application logs

---

## 20) A practical CI/CD example

If your team uses GitHub Actions, the high-level flow usually looks like this:

```mermaid
flowchart LR
    A[Push to GitHub] --> B[GitHub Actions build]
    B --> C[Docker image]
    C --> D[Push to Amazon ECR]
    D --> E[Update ECS Express Mode service]
    E --> F[Canary rollout]
    F --> G[Production traffic]
```

### Why this matters
This is the closest replacement for App Runner's old "push code, get deployment" feeling.

The difference is that now your pipeline builds the image explicitly and then Express Mode deploys that image.

---

## 21) Minimal learning path for a new user

If you want to learn Express Mode without getting lost, use this order:

1. Build a tiny HTTP app that exposes `/health`.
2. Push the image to ECR.
3. Create an Express Mode service with the default VPC.
4. Confirm the generated service URL works.
5. Inspect the created ECS service, ALB, target group, and log group.
6. Update the image tag and watch a rollout.
7. Add a custom domain.
8. Try a private/internal service later.

This path teaches both the simplified front door **and** the ECS resources that Express Mode actually creates.

---

## 22) Bottom line

Amazon ECS Express Mode is AWS's simplest current path to run a **containerized web app or API** on **ECS + Fargate** with **HTTPS, load balancing, autoscaling, and logging** already wired together.

Its biggest strengths are:
- fast setup
- production-shaped defaults
- standard ECS infrastructure underneath
- a smooth path into deeper ECS customization later

Its biggest constraint is also its design center:
- it is optimized primarily for **image-based HTTP services**, not every possible container workload.

If you liked the idea of App Runner but want something aligned with AWS's current direction, Express Mode is the service to learn.

---

## 23) Official AWS references

- Amazon ECS Express Mode overview
- Resources created by Amazon ECS Express Mode services
- Creating an Amazon ECS Express Mode service
- Updating an Amazon ECS Express Mode service
- Troubleshooting Amazon ECS Express Mode services
- create-express-gateway-service (AWS CLI)
- AWS App Runner availability change

