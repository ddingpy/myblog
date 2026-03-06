---
title: "Firebase iOS Backend with Auth, AWS S3 Files, and Optional FastAPI API (Part 1)"
date: 2025-12-31 09:05:00 +0900
tags: [firebase, ios, fastapi, aws, s3, auth]
---


This document explains how to use **Firebase** as the backend for an **iOS (Swift/SwiftUI) app**, how to build a **login system with Firebase Authentication**, how to work with **files stored in AWS S3**, and how to add a **Python backend (e.g., FastAPI)** alongside Firebase.

---

## Table of contents

* [What Firebase is (and what it isn’t)](#what-firebase-is-and-what-it-isnt)
* [Typical iOS + Firebase architecture](#typical-ios--firebase-architecture)
* [Step 1: Create and connect your iOS app to Firebase](#step-1-create-and-connect-your-ios-app-to-firebase)
* [Step 2: Build a login system with Firebase Authentication](#step-2-build-a-login-system-with-firebase-authentication)

  * [Recommended sign-in methods for iOS](#recommended-sign-in-methods-for-ios)
  * [Implementing Email/Password authentication](#implementing-emailpassword-authentication)
  * [Auth state, sign out, password reset](#auth-state-sign-out-password-reset)
  * [Security Rules: protect data by user identity](#security-rules-protect-data-by-user-identity)
* [How to use files in AWS S3 from a Firebase-based app](#how-to-use-files-in-aws-s3-from-a-firebase-based-app)

  * [Firebase Storage vs S3](#firebase-storage-vs-s3)
  * [Best-practice pattern: S3 presigned URLs](#best-practice-pattern-s3-presigned-urls)
  * [Storing file metadata in Firestore](#storing-file-metadata-in-firestore)
* [Using a Python (FastAPI) backend with Firebase](#using-a-python-fastapi-backend-with-firebase)

  * [Core idea: Firebase Auth on the client, token verification on the server](#core-idea-firebase-auth-on-the-client-token-verification-on-the-server)
  * [FastAPI example: verify Firebase ID tokens](#fastapi-example-verify-firebase-id-tokens)
  * [iOS example: call your FastAPI with a Firebase ID token](#ios-example-call-your-fastapi-with-a-firebase-id-token)
  * [When to use Custom Tokens](#when-to-use-custom-tokens)
* [Security & production checklist](#security--production-checklist)
* [Suggested implementation roadmap](#suggested-implementation-roadmap)

---

## What Firebase is (and what it isn’t)

**Firebase** is a backend-as-a-service (BaaS) platform that gives you ready-made building blocks for mobile apps, including:

* **Authentication** (users + sign-in providers)
* **Databases** (Cloud Firestore / Realtime Database)
* **File/object storage** (Cloud Storage for Firebase)
* **Serverless backend logic** (Cloud Functions / extensions)
* **Push notifications** (FCM), analytics, crash reporting, remote config, etc.

Cloud Storage for Firebase is built on Google Cloud infrastructure and is intended for storing and serving user-generated files like images/videos. ([Firebase][1])

Firebase is *not* a replacement for every kind of backend. Many real apps use **Firebase + a custom API** (e.g., FastAPI) when they need:

* complex business logic,
* integration with third-party systems (payments, internal services, AWS resources),
* special compliance/security requirements,
* or a pre-existing backend ecosystem.

---

## Typical iOS + Firebase architecture

A common “Firebase-first” architecture looks like this:

```
iOS App (Swift/SwiftUI)
   |
   |-- Firebase Auth (login)
   |-- Firestore (app data)
   |-- Firebase Storage (optional for files)
   |-- Cloud Functions (optional server logic)
   |
   +-- (Optional) Your API (FastAPI) for custom endpoints
         |
         +-- (Optional) AWS S3 for files
```

Key principle: **Firebase Authentication becomes your identity layer**, and everything else (Firestore rules, Storage rules, your API authorization) uses that identity.

---

## Step 1: Create and connect your iOS app to Firebase

High-level steps:

1. Create a Firebase project in the Firebase console.
2. Register your iOS app (Bundle ID).
3. Add the Firebase config file (commonly `GoogleService-Info.plist`) to your Xcode project.
4. Install Firebase SDK (Swift Package Manager is commonly recommended).
5. Initialize Firebase at app startup.

Firebase’s official setup guide for Apple platforms and installation methods are here. ([Firebase][2])

### Minimal iOS initialization (SwiftUI)

```swift
import SwiftUI
import FirebaseCore

@main
struct MyApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

---

## Step 2: Build a login system with Firebase Authentication

Firebase Authentication provides:

* user creation/sign-in
* session management on-device
* ID tokens (JWT) your backend can verify
* multiple login providers (email/password, Apple, Google, phone, etc.)

Firebase’s “Get started” guide for Auth on Apple platforms walks through setup and email/password sign-in. ([Firebase][3])

### Recommended sign-in methods for iOS

In many iOS apps, consider offering at least one of:

* **Sign in with Apple** (often expected by iOS users)
* **Email/Password** (simple and universal)
* **Google** (common for consumer apps)
* **Phone** (useful for regions where phone auth is standard)

You can enable/disable providers in **Firebase Console → Authentication → Sign-in method**.

---

### Implementing Email/Password authentication

After you install the **FirebaseAuth** SDK and enable Email/Password in the console, your UI typically has:

* Sign up (create account)
* Sign in
* Sign out
* Reset password

#### Create account

```swift
import FirebaseAuth

func signUp(email: String, password: String, completion: @escaping (Result<User, Error>) -> Void) {
    Auth.auth().createUser(withEmail: email, password: password) { result, error in
        if let error = error {
            completion(.failure(error))
            return
        }
        guard let user = result?.user else {
            completion(.failure(NSError(domain: "Auth", code: -1, userInfo: [NSLocalizedDescriptionKey: "Missing user"])))
            return
        }
        completion(.success(user))
    }
}
```

#### Sign in

```swift
import FirebaseAuth

func signIn(email: String, password: String, completion: @escaping (Result<User, Error>) -> Void) {
    Auth.auth().signIn(withEmail: email, password: password) { result, error in
        if let error = error {
            completion(.failure(error))
            return
        }
        guard let user = result?.user else {
            completion(.failure(NSError(domain: "Auth", code: -1, userInfo: [NSLocalizedDescriptionKey: "Missing user"])))
            return
        }
        completion(.success(user))
    }
}
```

---

### Auth state, sign out, password reset

#### Listen for auth state changes

This is useful to switch between “logged out UI” and “main app UI”.

```swift
import FirebaseAuth

var authStateHandle: AuthStateDidChangeListenerHandle?

func startAuthListener() {
    authStateHandle = Auth.auth().addStateDidChangeListener { _, user in
        if let user = user {
            print("Signed in:", user.uid)
        } else {
            print("Signed out")
        }
    }
}
```

#### Sign out

```swift
import FirebaseAuth

func signOut() throws {
    try Auth.auth().signOut()
}
```

#### Password reset email

```swift
import FirebaseAuth

func sendPasswordReset(email: String, completion: @escaping (Error?) -> Void) {
    Auth.auth().sendPasswordReset(withEmail: email) { error in
        completion(error)
    }
}
```

---

### Security Rules: protect data by user identity

A major advantage of Firebase is that **your database and storage can enforce access control without you writing your own authorization middleware**—as long as you design your data model and rules correctly.

Firebase Security Rules integrate with Firebase Authentication and allow checks like `request.auth.uid == ...`. ([Firebase][4])

**Example: Firestore rule to restrict each user to their own profile document**

```js
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Idea:** store user profile data at:

* `users/{uid}` (document ID equals Firebase Auth UID)

So the rule naturally matches.

---

## How to use files in AWS S3 from a Firebase-based app

### Firebase Storage vs S3

**Cloud Storage for Firebase** is a natural fit if:

* you want tight integration with Firebase Auth + Security Rules,
* you want client SDK uploads/downloads with minimal backend code,
* your backend is largely on GCP/Firebase already. ([Firebase][1])

**AWS S3** is a natural fit if:

* you already have a large bucket of existing content in S3,
* you need AWS-native tooling (CloudFront, S3 events, lifecycle rules, cross-account patterns),
* you’re in a broader AWS architecture.

There’s no problem mixing them—just be intentional about **security** and **how the iOS app gets access**.

---

### Best-practice pattern: S3 presigned URLs

For most mobile apps using private S3 objects, the recommended approach is:

1. **User signs in** with Firebase Auth in the iOS app
2. iOS app calls your trusted backend (Cloud Functions or FastAPI)
3. Backend verifies Firebase ID token (authenticates user)
4. Backend generates **S3 presigned URL**
5. iOS app uploads/downloads directly to S3 using that presigned URL

AWS has specific guidance on establishing guardrails and best practices for presigned URLs. ([AWS Docs][5])

#### Why presigned URLs are the go-to approach

* You **do not ship AWS credentials** in your iOS app
* You can tightly control:

  * expiration time (short TTL),
  * object key prefix (user-scoped paths),
  * allowed method (PUT/GET),
  * content-type/size limits (where applicable),
  * logging/monitoring

#### Data flow diagram

```
iOS App
  |
  | (A) Firebase Auth sign-in
  | -> gets Firebase ID token (JWT)
  |
  | (B) Call your API: "give me an upload URL"
  |    Authorization: Bearer <Firebase ID token>
  v
Your Backend (FastAPI or Cloud Function)
  |
  | verify Firebase ID token
  | authorize user -> choose S3 key (e.g. users/<uid>/<uuid>.jpg)
  | generate presigned URL
  v
iOS App
  |
  | (C) PUT/GET directly to S3 using presigned URL
  v
S3
```

---

### Storing file metadata in Firestore

Even if the file lives in S3, it’s common to store metadata in Firestore, for example:

* `files/{fileId}`:

  * `ownerUid`
  * `s3Bucket`
  * `s3Key`
  * `contentType`
  * `size`
  * `createdAt`
  * optional: `downloadPolicy` (private/public), `status` (uploading/ready)

Then your UI can query Firestore, but actual bytes transfer goes to S3.

Firestore rules can ensure users only read/write metadata they own (or you can centralize metadata writes through your backend if you need stricter validation). ([Firebase][4])

---

## Using a Python (FastAPI) backend with Firebase

Yes—you can absolutely use **FastAPI (or any Python backend)** with Firebase, and it’s a very common pattern.

### Core idea: Firebase Auth on the client, token verification on the server

* iOS app signs in with Firebase Authentication
* iOS app gets a **Firebase ID token** (JWT)
* iOS app calls your FastAPI endpoints with `Authorization: Bearer <idToken>`
* FastAPI verifies the token using **Firebase Admin SDK**
* Your API now knows the caller’s `uid` and can authorize actions

Firebase documents this “verify ID tokens” flow for backends using the Admin SDK. ([Firebase][6])

---

### FastAPI example: verify Firebase ID tokens

Install:

```bash
pip install fastapi uvicorn firebase-admin
```

Example `main.py`:

```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import firebase_admin
from firebase_admin import credentials, auth

app = FastAPI()
bearer_scheme = HTTPBearer()

## Initialize once at startup
## Use a service account JSON (keep it secret; do NOT commit it).
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

def verify_firebase_token(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = creds.credentials
    try:
        decoded = auth.verify_id_token(token)
        return decoded  # includes 'uid' and other claims
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token",
        )

@app.get("/me")
def me(decoded=Depends(verify_firebase_token)):
    return {
        "uid": decoded.get("uid"),
        "claims": decoded,
    }
```

Why this works:

* `verify_id_token(...)` validates signature, expiry, audience, etc., and returns decoded claims when valid. ([Firebase][6])

> Tip: For higher security (e.g., admin ban/logout flows), also consider token revocation checks; Firebase discusses revocation detection in the same area of docs. ([Firebase][6])

---

### iOS example: call your FastAPI with a Firebase ID token

After the user signs in, retrieve an ID token and call your API.

Conceptually:

```swift
import FirebaseAuth

func callMyApi() {
    guard let user = Auth.auth().currentUser else { return }

    user.getIDTokenForcingRefresh(false) { token, error in
        guard let token = token, error == nil else { return }

        var request = URLRequest(url: URL(string: "https://api.example.com/me")!)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        URLSession.shared.dataTask(with: request) { data, response, error in
            // handle response
        }.resume()
    }
}
```

---

### When to use Custom Tokens

You usually **do not need custom tokens** if you’re happy with standard Firebase sign-in methods.

You consider **custom tokens** when:

* you already have your own user system (or enterprise SSO) and want to “bridge” it into Firebase Auth
* you want your backend to be the authority that decides who can sign in, then mint a Firebase identity for the app

Firebase Admin SDK supports creating custom tokens, which the client exchanges for a Firebase session. ([Firebase][7])

---

## Security & production checklist

### 1) Secure Firebase resources with Security Rules

* Lock down Firestore/Storage to authenticated users and correct ownership checks.
* Use custom claims for roles (admin/moderator/etc.) when needed. ([Firebase][4])

### 2) Consider Firebase App Check

App Check helps ensure requests to Firebase services come from **your genuine app** (helps against abuse of API keys and scripted traffic). Firebase provides setup guidance for Apple platforms. ([Firebase][8])

### 3) If using S3, prefer presigned URLs (avoid AWS keys on-device)

Follow AWS presigned URL guardrails:

* least-privilege IAM
* short expirations
* monitoring/logging
* careful handling so URLs aren’t leaked in logs or analytics ([AWS Docs][5])

### 4) Treat Firebase Auth as your identity provider everywhere

* Firestore rules reference `request.auth.uid`
* Storage rules reference `request.auth.uid` / `request.auth.token` ([Firebase][9])
* FastAPI verifies ID tokens and uses `uid` for authorization ([Firebase][6])

### 5) Use Cloud Functions when you want “Firebase-native” server logic

Callable functions can automatically include Auth/App Check context when invoked from Firebase client SDKs, which can simplify some backend calls. ([Firebase][10])

(You can still keep FastAPI for heavier or Python-specific workloads.)

---

## Suggested implementation roadmap

A practical way to build your first version:

1. **Create Firebase project + connect iOS app** (SwiftPM + `FirebaseApp.configure()`). ([Firebase][2])
2. **Implement Firebase Auth** (start with Email/Password; add Apple later if needed). ([Firebase][3])
3. **Create a Firestore `users/{uid}` profile doc** on first login.
4. **Write Firestore Security Rules** so users can only access their own data. ([Firebase][4])
5. If you need S3:

   * build a small backend endpoint: `/s3/presign-upload` and `/s3/presign-download`
   * verify Firebase token in the backend
   * generate presigned URLs with AWS SDK ([AWS Docs][5])
6. If you need custom APIs:

   * deploy FastAPI (containerized) and require Firebase ID tokens for all protected routes ([Firebase][6])
7. Add **App Check** and monitoring before scaling up. ([Firebase][8])

---

If you want, I can extend this document with:

* a sample Firestore data model for a typical app (posts/comments/likes, etc.),
* production-ready Security Rules patterns,
* a complete “S3 presign + Firestore metadata” example (end-to-end),
* and an example FastAPI router structure with role-based access using Firebase custom claims.

[1]: https://firebase.google.com/docs/storage/?utm_source=chatgpt.com "Cloud Storage for Firebase"
[2]: https://firebase.google.com/docs/ios/setup?utm_source=chatgpt.com "Add Firebase to your Apple project | Firebase for Apple platforms"
[3]: https://firebase.google.com/docs/auth/ios/start?utm_source=chatgpt.com "Get Started with Firebase Authentication on Apple Platforms"
[4]: https://firebase.google.com/docs/rules/rules-and-auth?utm_source=chatgpt.com "Security Rules and Firebase Authentication"
[5]: https://docs.aws.amazon.com/prescriptive-guidance/latest/presigned-url-best-practices/introduction.html?utm_source=chatgpt.com "Establishing guardrails and monitoring for presigned URLs"
[6]: https://firebase.google.com/docs/auth/admin/verify-id-tokens?hl=ja&utm_source=chatgpt.com "ID トークンを検証する | Firebase Authentication"
[7]: https://firebase.google.com/docs/auth/admin/create-custom-tokens?hl=ja&utm_source=chatgpt.com "カスタム トークンを作成する | Firebase Authentication"
[8]: https://firebase.google.com/docs/app-check/ios/devicecheck-provider?utm_source=chatgpt.com "Get started using App Check with Device - Firebase"
[9]: https://firebase.google.com/docs/storage/security?hl=ja&utm_source=chatgpt.com "Cloud Storage 用の Firebase セキュリティ ルールを理解する"
[10]: https://firebase.google.com/docs/functions/callable?utm_source=chatgpt.com "Call functions from your app | Cloud Functions for Firebase"
