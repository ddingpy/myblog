---
title: "Firebase iOS Backend with Auth, AWS S3 Files, and Optional FastAPI API (Part 3)"
date: 2025-12-31 09:15:00 +0900
tags: [firebase, ios, fastapi, aws, s3, auth]
---


Everything below is designed to be **copy/paste-able** into a real project, while staying **safe by default** (no AWS creds in the app, clear authorization boundaries, predictable data model).

---

## End-to-end design: Firebase Auth + Firestore metadata + S3 file bytes + FastAPI

This is the pattern I recommend when you want to keep Firebase as your identity + app-data layer, but you already have S3 or you want AWS-native file pipelines.

The core building block is **S3 presigned URLs**: they grant **time-limited** upload/download access to a specific object without giving the client AWS credentials. ([AWS Docs][1])

## Goals

* iOS client authenticates with **Firebase Auth**
* iOS client can upload/download file bytes to **S3** without AWS keys
* Firestore stores **metadata** and drives UI lists
* FastAPI handles **authorization + presigning + orchestration**
* You can later add CloudFront, background processing, virus scanning, etc.

---

## Data model: `files/{fileId}` (Firestore)

I strongly prefer a “file registry” collection in Firestore even if the bytes live in S3.

**Collection:** `files/{fileId}`

Suggested fields:

* `ownerUid: string` (required)
* `bucket: string` (required)
* `key: string` (required, e.g. `users/<uid>/uploads/<uuid>.jpg`)
* `contentType: string` (required)
* `sizeBytes: number` (optional until confirmed)
* `status: "pending" | "ready" | "failed"` (required)
* `createdAt: timestamp` (server-written if you can)
* `updatedAt: timestamp`

Opinion:

* Keep `status` explicit. It makes UI + debugging dramatically easier.
* Prefer server-authoritative metadata writes (details below).

---

## API contract (opinionated)

### 1) Request an upload URL

`POST /v1/files/presign-upload`

**Headers**

* `Authorization: Bearer <Firebase ID token>`
* (Optional but recommended) `X-Firebase-AppCheck: <App Check token>` (explained later)

**Body**

```json
{
  "contentType": "image/jpeg",
  "fileExtension": "jpg"
}
```

**Response**

```json
{
  "fileId": "01J...ULID",
  "bucket": "my-app-uploads",
  "key": "users/<uid>/uploads/<fileId>.jpg",
  "upload": {
    "method": "PUT",
    "url": "https://s3....",
    "headers": {
      "Content-Type": "image/jpeg"
    },
    "expiresInSeconds": 300
  }
}
```

### 2) Mark upload complete (server validates S3 object exists)

`POST /v1/files/{fileId}/complete`

**Response**

```json
{
  "fileId": "01J...",
  "status": "ready",
  "sizeBytes": 1234567
}
```

### 3) Request a download URL

`POST /v1/files/{fileId}/presign-download`

**Response**

```json
{
  "download": {
    "method": "GET",
    "url": "https://s3....",
    "expiresInSeconds": 300
  }
}
```

---

## FastAPI implementation (complete “starter-quality” skeleton)

### Project layout I actually like

```
app/
  main.py
  core/
    config.py
    firebase_admin.py
    auth.py
    appcheck.py
  services/
    s3.py
    firestore.py
  api/
    routes/
      files.py
```

This keeps “wiring” separate from “routes” and “services,” so it stays maintainable.

---

## `core/config.py`

Use environment variables so secrets never hit git.

```python
from pydantic import BaseModel
import os

class Settings(BaseModel):
    firebase_service_account_path: str = os.environ["FIREBASE_SERVICE_ACCOUNT_PATH"]

    aws_region: str = os.environ["AWS_REGION"]
    s3_bucket: str = os.environ["S3_BUCKET"]
    presign_exp_seconds: int = int(os.environ.get("PRESIGN_EXP_SECONDS", "300"))

settings = Settings()
```

---

## `core/firebase_admin.py`

Firebase Admin SDK is what lets FastAPI verify Firebase ID tokens. ([Firebase][2])

```python
import firebase_admin
from firebase_admin import credentials

from app.core.config import settings

def init_firebase_admin() -> None:
    if firebase_admin._apps:
        return
    cred = credentials.Certificate(settings.firebase_service_account_path)
    firebase_admin.initialize_app(cred)
```

---

## `core/auth.py` (verify Firebase ID token)

Firebase’s recommended backend pattern is: client sends ID token (JWT), backend verifies it with Admin SDK. ([Firebase][2])

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

bearer = HTTPBearer(auto_error=False)

def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        decoded = auth.verify_id_token(creds.credentials)
        # decoded contains 'uid' and other claims
        return decoded
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired Firebase ID token")
```

Opinion:

* Always standardize on `uid` as the server identity.
* Put this in a dependency so every endpoint is consistent.

---

## Optional but recommended: verify App Check tokens too

App Check helps ensure calls come from **your real app**, not scripts. ([Firebase][3])

Firebase provides backend verification guidance; it expects the client to send an App Check token and the backend to validate it with Admin SDK. ([Firebase][4])

### `core/appcheck.py`

```python
from fastapi import Header, HTTPException, status
from firebase_admin import app_check

def verify_app_check(
    x_firebase_appcheck: str | None = Header(default=None, alias="X-Firebase-AppCheck"),
) -> dict:
    if not x_firebase_appcheck:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing App Check token")

    try:
        claims = app_check.verify_token(x_firebase_appcheck)
        return claims
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid App Check token")
```

Opinion:

* I use App Check verification at least on:

  * `presign-upload`
  * `presign-download`
  * any “expensive” endpoints
* If you’re in early dev, you can make App Check optional, but plan to enforce it in production.

---

## `services/s3.py` (presigned PUT/GET)

Boto3 can generate presigned URLs with an `ExpiresIn` in seconds. ([Boto3][5])

```python
import boto3
from app.core.config import settings

_s3 = boto3.client("s3", region_name=settings.aws_region)

def presign_put_object(*, bucket: str, key: str, content_type: str) -> str:
    # generate_presigned_url: valid for ExpiresIn seconds 
    return _s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=settings.presign_exp_seconds,
        HttpMethod="PUT",
    )

def presign_get_object(*, bucket: str, key: str) -> str:
    return _s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=settings.presign_exp_seconds,
        HttpMethod="GET",
    )

def head_object(*, bucket: str, key: str) -> dict:
    return _s3.head_object(Bucket=bucket, Key=key)
```

Opinion:

* Default expiry: **300 seconds** (5 minutes) is a good starting point.
* Don’t let the client choose the key. The server constructs it from `uid`.

---

## Advanced option: Presigned POST (stricter constraints)

Presigned POST supports a **policy with conditions**, including things like `content-length-range` and `Content-Type` (good for enforcing max upload size). ([Boto3][6])

Boto3 supports `generate_presigned_post()` and documents the kinds of conditions you can include. ([Boto3][6])

Opinion:

* Presigned POST is great when you need strong upload constraints.
* It’s more annoying to implement on mobile than PUT (because it’s a form-style upload), so I usually start with PUT + server-side validation at `/complete`.

---

## `services/firestore.py` (metadata)

Use Admin SDK / server credentials to write metadata. **Important:** server libraries bypass Firestore Security Rules, so your server must implement authorization correctly. ([Firebase][7])

```python
from google.cloud import firestore

_db = firestore.Client()

def create_file_doc(*, file_id: str, doc: dict) -> None:
    _db.collection("files").document(file_id).set(doc)

def get_file_doc(file_id: str) -> dict | None:
    snap = _db.collection("files").document(file_id).get()
    if not snap.exists:
        return None
    return snap.to_dict()

def update_file_doc(file_id: str, patch: dict) -> None:
    _db.collection("files").document(file_id).update(patch)
```

Opinion:

* For consistency, I treat Firestore as the “truth” for the UI layer (status, list, ownership).
* S3 is for bytes only.

---

## `api/routes/files.py` (endpoints)

```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import ulid

from app.core.config import settings
from app.core.auth import get_current_user
from app.core.appcheck import verify_app_check
from app.services import s3 as s3svc
from app.services import firestore as fssvc

router = APIRouter(prefix="/v1/files", tags=["files"])

class PresignUploadRequest(BaseModel):
    contentType: str
    fileExtension: str

@router.post("/presign-upload")
def presign_upload(
    body: PresignUploadRequest,
    user=Depends(get_current_user),
    _appcheck=Depends(verify_app_check),  # remove if you want optional
):
    uid = user["uid"]
    file_id = str(ulid.new())
    key = f"users/{uid}/uploads/{file_id}.{body.fileExtension}"

    url = s3svc.presign_put_object(bucket=settings.s3_bucket, key=key, content_type=body.contentType)

    # Server writes metadata as pending
    fssvc.create_file_doc(
        file_id=file_id,
        doc={
            "ownerUid": uid,
            "bucket": settings.s3_bucket,
            "key": key,
            "contentType": body.contentType,
            "status": "pending",
        },
    )

    return {
        "fileId": file_id,
        "bucket": settings.s3_bucket,
        "key": key,
        "upload": {
            "method": "PUT",
            "url": url,
            "headers": {"Content-Type": body.contentType},
            "expiresInSeconds": settings.presign_exp_seconds,
        },
    }

@router.post("/{file_id}/complete")
def complete_upload(
    file_id: str,
    user=Depends(get_current_user),
    _appcheck=Depends(verify_app_check),
):
    uid = user["uid"]
    doc = fssvc.get_file_doc(file_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if doc.get("ownerUid") != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your file")

    # Confirm object exists in S3
    head = s3svc.head_object(bucket=doc["bucket"], key=doc["key"])
    size = int(head.get("ContentLength", 0))

    fssvc.update_file_doc(file_id, {"status": "ready", "sizeBytes": size})
    return {"fileId": file_id, "status": "ready", "sizeBytes": size}

@router.post("/{file_id}/presign-download")
def presign_download(
    file_id: str,
    user=Depends(get_current_user),
    _appcheck=Depends(verify_app_check),
):
    uid = user["uid"]
    doc = fssvc.get_file_doc(file_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if doc.get("ownerUid") != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your file")

    url = s3svc.presign_get_object(bucket=doc["bucket"], key=doc["key"])
    return {
        "download": {
            "method": "GET",
            "url": url,
            "expiresInSeconds": settings.presign_exp_seconds,
        }
    }
```

Opinionated notes:

* The server is the only thing deciding bucket/key.
* The client can’t “guess” someone else’s file because it can’t get a URL without passing auth checks.

---

## `main.py`

```python
from fastapi import FastAPI
from app.core.firebase_admin import init_firebase_admin
from app.api.routes.files import router as files_router

def create_app() -> FastAPI:
    init_firebase_admin()
    app = FastAPI()
    app.include_router(files_router)
    return app

app = create_app()
```

---

## iOS client: SwiftUI architecture that stays maintainable

I recommend separating “SDK calls” from “views” early. It’s the difference between a clean app at 10 screens vs a rewrite.

## Suggested client structure

* `AuthSession` (ObservableObject): login state + user
* `ApiClient`: calls FastAPI, attaches Firebase ID token (+ App Check token if used)
* `Repositories`: Firestore reads/writes that client is allowed to do
* `UploadManager`: requests presign → uploads to S3 → completes upload

---

## Firebase Auth setup reminder (practical note)

Firebase’s iOS Auth getting-started doc explicitly covers adding email/password sign-in and SDK installation steps. ([Firebase][8])

---

## `AuthSession` (minimal but effective)

```swift
import Foundation
import FirebaseAuth

@MainActor
final class AuthSession: ObservableObject {
    @Published var user: User? = nil
    private var handle: AuthStateDidChangeListenerHandle?

    func start() {
        handle = Auth.auth().addStateDidChangeListener { _, user in
            Task { @MainActor in
                self.user = user
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        _ = try await Auth.auth().signIn(withEmail: email, password: password)
    }

    func signUp(email: String, password: String) async throws {
        _ = try await Auth.auth().createUser(withEmail: email, password: password)
    }

    func signOut() throws {
        try Auth.auth().signOut()
    }
}
```

Opinion:

* You want **one** source of truth for “who is logged in.”

---

## `ApiClient`: attach Firebase ID token to every request

Firebase describes the general pattern: client obtains an ID token and sends it to your backend. ([Firebase][2])

```swift
import Foundation
import FirebaseAuth

struct ApiClient {
    let baseURL: URL

    func authedRequest(path: String, method: String) async throws -> URLRequest {
        guard let user = Auth.auth().currentUser else {
            throw URLError(.userAuthenticationRequired)
        }
        let token = try await user.getIDToken()
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return req
    }
}
```

Opinion:

* Centralize this logic so you never forget auth headers in random screens.

---

## Upload flow on iOS (presign → PUT to S3 → complete)

### Step 1: request presigned upload info

```swift
import Foundation

struct PresignUploadResponse: Decodable {
    struct Upload: Decodable {
        let method: String
        let url: String
        let headers: [String:String]
        let expiresInSeconds: Int
    }
    let fileId: String
    let bucket: String
    let key: String
    let upload: Upload
}

extension ApiClient {
    func presignUpload(contentType: String, fileExtension: String) async throws -> PresignUploadResponse {
        var req = try await authedRequest(path: "/v1/files/presign-upload", method: "POST")
        let body = ["contentType": contentType, "fileExtension": fileExtension]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(PresignUploadResponse.self, from: data)
    }

    func completeUpload(fileId: String) async throws {
        let req = try await authedRequest(path: "/v1/files/\(fileId)/complete", method: "POST")
        _ = try await URLSession.shared.data(for: req)
    }
}
```

### Step 2: upload bytes to S3 using presigned URL (PUT)

```swift
import Foundation

struct UploadManager {
    let api: ApiClient

    func uploadFile(data: Data, contentType: String, fileExtension: String) async throws -> String {
        let presign = try await api.presignUpload(contentType: contentType, fileExtension: fileExtension)

        guard let url = URL(string: presign.upload.url) else {
            throw URLError(.badURL)
        }

        var put = URLRequest(url: url)
        put.httpMethod = presign.upload.method
        for (k, v) in presign.upload.headers {
            put.setValue(v, forHTTPHeaderField: k)
        }

        // Upload bytes directly to S3
        _ = try await URLSession.shared.upload(for: put, from: data)

        // Tell backend to validate + mark ready
        try await api.completeUpload(fileId: presign.fileId)

        return presign.fileId
    }
}
```

Opinion:

* Start with `Data` uploads for images.
* For large videos, prefer `upload(for:fromFile:)` so you don’t load the whole file into memory.

---

## Firestore Security Rules: production-ready starter patterns

Rules should be:

1. short,
2. obvious,
3. testable.

Firebase’s rules docs emphasize conditions, authentication checks, and incoming-data validation. ([Firebase][9])

## Absolute rule #1

**Deny by default**, then open exactly what you intend:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Then add targeted matches.

---

## Helper functions I use constantly

```js
function signedIn() {
  return request.auth != null;
}

function isOwner(ownerUidField) {
  return signedIn() && request.auth.uid == ownerUidField;
}
```

---

## Example: user profiles

```js
match /users/{uid} {
  allow read, write: if signedIn() && request.auth.uid == uid;
}
```

---

## Example: user-owned “files” metadata (server-managed writes)

If your server is writing metadata (recommended), keep client writes closed:

```js
match /files/{fileId} {
  allow read: if signedIn() && resource.data.ownerUid == request.auth.uid;
  allow write: if false; // Only server writes (Admin SDK)
}
```

**Why this is important:** server client libraries bypass Firestore Security Rules, which means rules won’t protect server operations—your server must enforce authorization itself. ([Firebase][7])

Opinion:

* This “read-only to clients” pattern is a huge simplifier for security.
* You can still let clients create their own metadata, but validating everything in rules gets complicated fast.

---

## Example: posts + likes (good “anti-unbounded-array” approach)

```js
match /posts/{postId} {
  allow read: if true;

  allow create: if signedIn()
    && request.resource.data.authorUid == request.auth.uid
    && request.resource.data.keys().hasOnly(["authorUid","text","createdAt"])
    && request.resource.data.text is string
    && request.resource.data.text.size() <= 2000;

  allow update, delete: if signedIn()
    && resource.data.authorUid == request.auth.uid;
}

match /posts/{postId}/likes/{uid} {
  allow create, delete: if signedIn() && request.auth.uid == uid;
  allow read: if true;
}
```

Opinion:

* `keys().hasOnly([...])` is one of the best tools for preventing “surprise fields.”
* Keep validation modest in rules; do complex validation in your backend.

---

## Testing rules and auth locally (Emulator Suite)

I recommend adopting emulators early so you don’t “test security in production.”

Firebase documents connecting your app to the Authentication Emulator, and notes that when Auth emulator + other emulators are running, they can work together for testing auth + rules. ([Firebase][10])

Opinion:

* I use emulators for:

  * rules unit tests
  * “can user A read user B?” regressions
  * CI sanity checks

---

## Cost & performance: concrete patterns that prevent pain

Most Firebase cost surprises come from **reads**, not writes.

## Use pagination by default for feeds

Firestore supports pagination using query cursors like `startAfter()` combined with `limit()`. ([Firebase][11])

Opinion:

* Never load “all posts” in production UI.
* Always page.

## Prefer “get once” over realtime listeners for non-live screens

Firestore queries can be used with either “get once” or realtime listeners. ([Firebase][12])

Opinion:

* Realtime listeners are awesome for chat and live dashboards.
* They’re wasteful for screens that users open briefly (settings, profile editor, static lists).

## Use listeners sparingly and detach them

Opinion:

* Attach listeners when a screen appears.
* Detach when it disappears.
* Don’t leave 10 listeners running in background because it “felt convenient.”

## Denormalize for list screens

Opinion:

* Put the fields you need for a list cell directly on the list documents.
* Avoid N+1 reads (fetch list → fetch each author doc).

---

## S3 “real-world” hardening checklist (opinionated)

Even if you do presigned URLs correctly, production needs a few extra guardrails:

## Keep expirations short

Boto3’s presigned URL generation is explicitly time-bound via `ExpiresIn`. ([Boto3][5])

Opinion:

* 5 minutes is usually plenty.
* If uploads are large, increase expiry but add `/complete` validation.

## Restrict what the presign can do

Opinion:

* Presign only `put_object` and `get_object`.
* Do not expose list operations.

## Consider size constraints (if abuse risk is high)

Presigned POST supports conditions like `content-length-range`. ([Boto3][6])

Opinion:

* If you’re seeing abuse, switch uploads to presigned POST or enforce strict post-upload checks and delete oversized objects.

---

## Optional: App Check end-to-end (client → FastAPI)

App Check tokens are cached client-side and are meant to be attached to requests to protected services. ([Firebase][3])
Firebase documents verifying App Check tokens on custom backends and shows server-side verification flow. ([Firebase][4])

Opinion:

* App Check is worth it if your app has:

  * public signup
  * expensive endpoints (presign, AI, export jobs)
  * abuse risk
* I’d roll it out gradually:

  1. instrument + monitor
  2. enforce on sensitive endpoints
  3. enforce more broadly once stable

---

## Final opinionated roadmap (if you want the “least regret” path)

1. **Firebase Auth + Firestore core data model**
2. **Security Rules with an “ownerUid everywhere” discipline**
3. **Emulator Suite tests for auth + rules**
4. If/when needed:

   * **FastAPI** for S3 presigning + privileged operations
   * **App Check** enforcement on FastAPI endpoints
5. Scale optimization:

   * pagination everywhere
   * reduce listeners
   * denormalize for list views

---

If you want, I can add one more “fully integrated” section with:

* a complete Dockerfile + deployment notes (Cloud Run or AWS ECS/Fargate),
* an example IAM policy for the presigning service account/user,
* and Firestore index planning for common feed queries.

[1]: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html?utm_source=chatgpt.com "Download and upload objects with presigned URLs"
[2]: https://firebase.google.com/docs/auth/admin/verify-id-tokens?utm_source=chatgpt.com "Verify ID Tokens | Firebase Authentication"
[3]: https://firebase.google.com/docs/app-check?utm_source=chatgpt.com "Firebase App Check"
[4]: https://firebase.google.com/docs/app-check/custom-resource-backend "Verify App Check tokens from a custom backend  |  Firebase App Check"
[5]: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3/client/generate_presigned_url.html?utm_source=chatgpt.com "generate_presigned_url - Boto3 1.42.17 documentation"
[6]: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3/client/generate_presigned_post.html?utm_source=chatgpt.com "generate_presigned_post - Boto3 1.42.17 documentation"
[7]: https://firebase.google.com/docs/firestore/security/get-started?utm_source=chatgpt.com "Get started with Cloud Firestore Security Rules | Firebase"
[8]: https://firebase.google.com/docs/auth/ios/start?utm_source=chatgpt.com "Get Started with Firebase Authentication on Apple Platforms"
[9]: https://firebase.google.com/docs/firestore/security/rules-conditions?utm_source=chatgpt.com "Writing conditions for Cloud Firestore Security Rules | Firebase"
[10]: https://firebase.google.com/docs/emulator-suite/connect_auth?utm_source=chatgpt.com "Connect your app to the Authentication Emulator - Firebase"
[11]: https://firebase.google.com/docs/firestore/query-data/query-cursors?utm_source=chatgpt.com "Paginate data with query cursors | Firestore | Firebase"
[12]: https://firebase.google.com/docs/firestore/query-data/queries?hl=ja&utm_source=chatgpt.com "Cloud Firestore で単純なクエリと複合クエリを実行する | Firebase"
