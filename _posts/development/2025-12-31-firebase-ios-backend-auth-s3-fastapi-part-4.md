---
title: "Firebase iOS Backend with Auth, AWS S3 Files, and Optional FastAPI API (Part 4)"
date: 2025-12-31 09:20:00 +0900
tags: [firebase, ios, fastapi, aws, s3, auth, docker]
---


> You wrote “folly integrated” — I’m assuming you meant **fully integrated**. This section is designed to be copy‑pasted at the end of your existing Markdown doc.

---

### What “fully integrated” means here

You’ll have:

* **iOS app** using **Firebase Authentication** for login.
* A **Python (FastAPI) backend** that:

  * verifies Firebase **ID tokens** (so every request is tied to a real user)
  * reads/writes **Firestore** (your “source of truth” for app data)
  * issues **S3 presigned URLs** (so the app uploads/downloads files *directly* to/from S3 without exposing AWS credentials)
* A **containerized deployment** path:

  * Option A: **Google Cloud Run** (nice fit if you’re already on Firebase/Firestore)
  * Option B: **AWS ECS/Fargate** (nice fit if your infra is mostly AWS)

Cloud Run container requirements (notably: listen on `$PORT`) come from Cloud Run’s container model docs. ([Google Cloud Documentation][1])

---

### End-to-end request flows

#### 1) Login + API call flow (Firebase Auth → FastAPI)

1. User signs in on iOS (Email/Password, Sign in with Apple, etc.).
2. iOS gets a **Firebase ID token** and sends it to your API:

   * `Authorization: Bearer <FIREBASE_ID_TOKEN>`
3. FastAPI verifies the token using Firebase Admin SDK and extracts `uid`.
4. FastAPI authorizes the request (role checks, org membership, etc.) and serves the API response.

Firebase Admin SDK setup and Python requirements are described in Firebase’s Admin SDK docs. ([Firebase][2])

#### 2) Upload flow (FastAPI → presigned PUT → S3)

1. iOS asks your API: “I want to upload a file with content-type X”
2. FastAPI:

   * validates the user (Firebase ID token)
   * picks an S3 object key like `users/{uid}/uploads/{uuid}.jpg`
   * returns a **presigned URL** for `PUT`
3. iOS uploads directly to S3 with `PUT <presigned_url>`
4. iOS calls your API to “confirm upload” (optional but recommended)
5. FastAPI records/updates Firestore metadata (`status=ready`, `size`, `contentType`, etc.)

Presigned URLs grant temporary access using the credentials of the IAM principal that created them; the creator must have permissions for the operation. ([AWS Docs][3])

---

### Opinionated architecture choice (Cloud Run vs ECS/Fargate)

**My opinionated default if you’re using Firebase/Firestore:** deploy the FastAPI container to **Cloud Run**.

* It reduces “cross-cloud gravity” for the database path (Firestore ↔ backend).
* You can use a **service identity** (service account) cleanly for Google APIs. ([Google Cloud Documentation][4])
* You still can call AWS S3 from Cloud Run; you just manage AWS creds carefully (secrets).

**When I’d pick ECS/Fargate instead:**

* You already run most services on AWS (logging/metrics/networking/ops are standardized there).
* You want to use **task roles** for S3 (no static AWS keys anywhere).
* Your org’s security team prefers “AWS-native identity” for AWS access.

On ECS: keep **task execution role** separate from **task role**. Execution role is for ECS agent needs (pull images, logs); task role is what your container uses to call AWS APIs. ([AWS Docs][5])

---

### Minimal repo layout (practical + scalable)

```text
backend/
  app/
    main.py
    auth.py
    firestore.py
    s3.py
  requirements.txt
  Dockerfile
  .dockerignore
```

---

### Dockerfile (production-ready, works on Cloud Run and ECS)

Key requirements for Cloud Run:

* Bind to `0.0.0.0`
* Listen on the port provided by the `PORT` env var (Cloud Run injects it) ([Google Cloud Documentation][1])

```dockerfile
FROM python:3.11-slim

## Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

## System deps (keep minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app /app/app

## Cloud Run will set PORT; ECS can set it too (or just use 8080)
ENV PORT=8080

## Uvicorn is fine for many APIs; if you expect high CPU concurrency,
## consider Gunicorn+UvicornWorker later.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
```

`requirements.txt` (baseline)

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6

firebase-admin==6.5.0
google-cloud-firestore==2.16.1

boto3==1.34.162
pydantic==2.8.2
```

Firebase Admin Python SDK requires Python 3.9+ (3.10+ recommended). ([Firebase][2])

---

### FastAPI code: Firebase auth + Firestore + S3 presigning

#### `app/auth.py` (verify Firebase ID tokens)

```python
from fastapi import Header, HTTPException
from firebase_admin import auth as firebase_auth

def get_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Authorization must be Bearer token")
    return authorization[len(prefix):].strip()

def verify_firebase_user(authorization: str | None = Header(default=None)) -> dict:
    token = get_bearer_token(authorization)
    try:
        decoded = firebase_auth.verify_id_token(token)
        # decoded contains uid, auth_time, exp, etc.
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token")
```

#### `app/firestore.py` (init Firestore safely)

If you run on **Cloud Run with a service identity**, you can typically rely on default credentials (no JSON key file baked into the image). Firebase Admin supports initializing with project options, and also discusses default credentials scenarios. ([Firebase][2])

```python
import os
import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore

def init_firebase_admin():
    # If GOOGLE_APPLICATION_CREDENTIALS is set (local dev or AWS),
    # use it. Otherwise (Cloud Run + service identity), rely on ADC.
    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path:
            firebase_admin.initialize_app(credentials.Certificate(cred_path))
        else:
            # Application Default Credentials environment
            firebase_admin.initialize_app()

def get_firestore_client() -> firestore.Client:
    return firestore.Client()
```

#### `app/s3.py` (presign helpers)

Presigned URL behavior: generated by a principal with access, and temporary access is granted using that principal’s credentials. ([Boto3][6])

```python
import os
import uuid
import boto3

s3 = boto3.client("s3")
BUCKET = os.environ["S3_BUCKET"]
REGION = os.getenv("AWS_REGION", "us-east-1")

def make_upload_key(uid: str, ext: str | None = None) -> str:
    # Keep keys deterministic & partitioned by user
    suffix = f".{ext.lstrip('.')}" if ext else ""
    return f"users/{uid}/uploads/{uuid.uuid4().hex}{suffix}"

def presign_put_object(key: str, content_type: str, expires_seconds: int = 900) -> str:
    return s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=expires_seconds,
    )

def presign_get_object(key: str, expires_seconds: int = 900) -> str:
    return s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=expires_seconds,
    )
```

#### `app/main.py` (endpoints)

```python
from fastapi import FastAPI, Depends
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from app.auth import verify_firebase_user
from app.firestore import init_firebase_admin, get_firestore_client
from app.s3 import make_upload_key, presign_put_object, presign_get_object

app = FastAPI(title="Firebase+Firestore+S3 Backend")

@app.on_event("startup")
def startup():
    init_firebase_admin()

class PresignUploadRequest(BaseModel):
    contentType: str = Field(min_length=3, max_length=200)
    fileExt: str | None = Field(default=None, max_length=10)
    expiresSeconds: int = Field(default=900, ge=60, le=3600)

class PresignUploadResponse(BaseModel):
    key: str
    putUrl: str
    expiresSeconds: int

@app.post("/v1/uploads/presign", response_model=PresignUploadResponse)
def presign_upload(
    body: PresignUploadRequest,
    user=Depends(verify_firebase_user),
):
    uid = user["uid"]
    key = make_upload_key(uid=uid, ext=body.fileExt)
    put_url = presign_put_object(key=key, content_type=body.contentType, expires_seconds=body.expiresSeconds)

    # Record an upload session in Firestore (recommended)
    db = get_firestore_client()
    db.collection("uploadSessions").document().set({
        "uid": uid,
        "key": key,
        "contentType": body.contentType,
        "status": "issued",
        "createdAt": datetime.now(timezone.utc),
    })

    return PresignUploadResponse(key=key, putUrl=put_url, expiresSeconds=body.expiresSeconds)

class PresignDownloadResponse(BaseModel):
    getUrl: str
    expiresSeconds: int

@app.get("/v1/files/{key:path}/download", response_model=PresignDownloadResponse)
def presign_download(
    key: str,
    expiresSeconds: int = 900,
    user=Depends(verify_firebase_user),
):
    # IMPORTANT: enforce authorization here (e.g., only allow if key starts with users/{uid}/)
    uid = user["uid"]
    if not key.startswith(f"users/{uid}/"):
        # Replace with your real authorization rules
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not allowed")

    url = presign_get_object(key=key, expires_seconds=expiresSeconds)
    return PresignDownloadResponse(getUrl=url, expiresSeconds=expiresSeconds)
```

---

## Deployment option A: Google Cloud Run

### Cloud Run “gotchas” that matter (so you don’t waste hours)

* Your container must listen on the port provided by **`PORT`** (Cloud Run injects it). ([Google Cloud Documentation][1])
* If it doesn’t, you’ll hit the classic “failed to start and listen on the port defined by the PORT env var” error. ([Google Cloud Documentation][7])
* You can configure health checks if startup behavior needs tuning. ([Google Cloud Documentation][8])

### Recommended identity approach

Use a **Cloud Run service identity (service account)** when the service needs Google APIs (Firestore is a Google API). ([Google Cloud Documentation][4])

### Secret handling (recommended)

For AWS credentials (if you use static keys on Cloud Run), store them in **Secret Manager** and expose them as env vars or mounted files. ([Google Cloud Documentation][9])

### Practical deployment steps (high level)

Google’s FastAPI-on-Cloud-Run quickstart is the most direct “canonical” path. ([Google Cloud][10])

My opinionated steps:

1. Build container image (Cloud Build or local Docker).
2. Deploy to Cloud Run.
3. Set env vars / secrets:

   * `S3_BUCKET`
   * `AWS_REGION`
   * `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or a better auth approach)
   * (Optional) `GOOGLE_APPLICATION_CREDENTIALS` only if you’re not using Cloud Run identity

---

## Deployment option B: AWS ECS/Fargate

### Roles: execution role vs task role (don’t mix them)

* **Task execution role**: used by ECS to pull images, write logs, etc. ([AWS Docs][5])
* **Task role**: IAM permissions your *application code* uses (S3 presign, S3 HEAD checks, etc.). ([AWS Docs][11])

**My opinion:** Put *all S3 permissions* on the **task role**, not on user access keys stored in env vars. That’s one of the biggest wins of ECS/Fargate.

---

## IAM policy example for the “presigning” principal (least privilege)

### What permissions do you actually need?

* Upload presign (`PUT`): needs **`s3:PutObject`** ([AWS Docs][12])
* Download/metadata presign (`GET` / `HEAD`): needs **`s3:GetObject`** (and you’ll commonly use `GET` and/or `HEAD` as the HTTP method) ([AWS Docs][3])

AWS also explicitly notes presigned URLs rely on the permissions of the IAM principal that generated them. ([AWS Docs][3])

### Example IAM policy (restrict to a user prefix)

Replace:

* `YOUR_BUCKET`
* adjust the prefix strategy if you don’t want `users/*`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowUploadDownloadWithinBucketPrefix",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET/users/*"
      ]
    }
  ]
}
```

#### Opinionated hardening ideas

* Keep presigned URL expirations short (5–15 minutes is common).
* Consider a **bucket policy** to reject overly old signatures / tighten URL usage. AWS shows mechanisms like denying requests when a signature is older than a threshold. ([AWS Docs][3])
* If you use SSE-KMS on the bucket, you’ll also need `kms:Encrypt`/`kms:Decrypt` permissions (not shown above).

---

## Firestore index planning for common “feed” queries

Firestore requires an index for every query; basic indexes are created automatically, and when you hit a missing index Firestore provides an error message that links you to create it. ([Firebase][13])

### Opinionated strategy: plan the “top 5 queries,” then let errors drive the rest

In most apps, **a handful of query shapes** dominate:

1. **Org feed**

* Query: `posts where orgId == X orderBy createdAt desc limit 50`
* Likely needs composite index: `(orgId ASC, createdAt DESC)`

2. **User’s own posts**

* Query: `posts where authorId == uid orderBy createdAt desc`
* Index: `(authorId ASC, createdAt DESC)`

3. **Visible posts**

* Query: `posts where visibility == "public" orderBy createdAt desc`
* Index: `(visibility ASC, createdAt DESC)` (depending on your other filters)

4. **Tag feed**

* Query: `posts where tags array-contains "swift" orderBy createdAt desc`
* Index: `(tags CONTAINS, createdAt DESC)`

5. **Notification inbox**

* Query: `notifications where uid == X and read == false orderBy createdAt desc`
* Index: `(uid ASC, read ASC, createdAt DESC)`

### Why I recommend explicitly versioning indexes

You can manage indexes via console, but I strongly prefer keeping them **in repo** so environments stay consistent. Firebase supports generating and deploying Firestore index definitions using the Firebase CLI (`firebase init firestore`, then deploy). ([Firebase][13])

### Example `firestore.indexes.json` snippet

```json
{
  "indexes": [
    {
      "collectionGroup": "posts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "orgId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "posts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "authorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "posts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "read", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### Index cost + performance (my take)

* Composite indexes are *worth it* because they keep queries predictable at scale.
* But don’t create indexes for “maybe someday” queries—each index has storage/write overhead.
* Design your UI around a small number of query shapes (this also makes caching easier).

---

### Final “integration sanity checklist” (things that prevent real production pain)

* [ ] Cloud Run container listens on `$PORT` (not hardcoded) ([Google Cloud Documentation][1])
* [ ] Backend verifies Firebase ID token on every request
* [ ] S3 uploads go via presigned URLs; app never sees AWS credentials ([AWS Docs][3])
* [ ] IAM policy is prefix-scoped (avoid `arn:aws:s3:::bucket/*` unless you truly need it)
* [ ] Firestore composite indexes are checked into repo and deployed via CLI ([Firebase][13])

If you want, I can also add a **single, end-to-end iOS Swift example** for:

1. getting the Firebase ID token
2. calling `/v1/uploads/presign`
3. uploading to S3 via `URLSession` PUT
4. writing a Firestore document that references the uploaded S3 object key

[1]: https://docs.cloud.google.com/run/docs/configuring/services/containers?utm_source=chatgpt.com "Configure containers for services - Cloud Run"
[2]: https://firebase.google.com/docs/admin/setup?hl=ja "サーバーに Firebase Admin SDK を追加する"
[3]: https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/using-presigned-url.html?utm_source=chatgpt.com "署名付き URL を使用したオブジェクトのダウンロードおよび ..."
[4]: https://docs.cloud.google.com/run/docs/configuring/services/service-identity?hl=ja&utm_source=chatgpt.com "サービスのサービス ID を構成する | Cloud Run | Google Cloud ..."
[5]: https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/task_execution_IAM_role.html?utm_source=chatgpt.com "Amazon ECS タスク実行IAM ロール - Amazon Elastic ..."
[6]: https://boto3.amazonaws.com/v1/documentation/api/latest/guide/s3-presigned-urls.html "Presigned URLs - Boto3 1.42.18 documentation"
[7]: https://docs.cloud.google.com/run/docs/troubleshooting?utm_source=chatgpt.com "Troubleshoot Cloud Run issues | Google Cloud Documentation"
[8]: https://docs.cloud.google.com/run/docs/configuring/healthchecks?hl=ja&utm_source=chatgpt.com "サービスにコンテナのヘルスチェックを構成する | Cloud Run ..."
[9]: https://docs.cloud.google.com/run/docs/configuring/services/secrets?hl=ja&utm_source=chatgpt.com "サービスのシークレットを構成する | Cloud Run | Google Cloud ..."
[10]: https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-python-fastapi-service?hl=ja "クイックスタート: Cloud Run を使用して Python（FastAPI）ウェブアプリを Google Cloud にデプロイする"
[11]: https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/task-iam-roles.html "Amazon ECS タスクの IAM ロール - Amazon Elastic Container Service"
[12]: https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html?utm_source=chatgpt.com "PutObject - Amazon Simple Storage Service"
[13]: https://firebase.google.com/docs/firestore/query-data/indexing "Manage indexes in Cloud Firestore  |  Firebase"
