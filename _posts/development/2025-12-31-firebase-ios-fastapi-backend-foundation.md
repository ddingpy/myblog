---
title: "Firebase for Your iOS App with a Python/FastAPI Backend"
date: 2025-12-31 09:00:00 +0900
tags: [firebase, ios, fastapi, backend]
---


This document gives you a practical, end‑to‑end overview of using **Firebase as the backend** for an iOS app, with special focus on:

* Creating a **login system** using Firebase Authentication
* Storing and using **many user‑generated files**
* Using a **Python (FastAPI) backend** together with Firebase

---

## 1. What Is Firebase and Which Parts Do You Need?

**Firebase** is a Backend‑as‑a‑Service (BaaS) platform from Google. It offers:

* **Authentication** – user accounts (email/password, Apple, Google, etc.)
* **Cloud Firestore / Realtime Database** – NoSQL databases for your app data
* **Cloud Storage for Firebase** – file/object storage (images, videos, documents, etc.) ([Firebase][1])
* **Cloud Functions / Cloud Messaging / Analytics**, etc.

For your use case (iOS app with lots of user files + possible Python backend), the core services are:

1. **Firebase Authentication** – login system in the iOS app ([Firebase][2])
2. **Cloud Storage for Firebase** – store user‑generated files (photos, documents, etc.) ([Firebase][1])
3. **Cloud Firestore (optional but recommended)** – store metadata, references to files, user profiles, etc. ([Ali Mert Güleç][3])
4. **Firebase Admin SDK for Python** – allow your FastAPI backend to verify Firebase Auth tokens and access Firebase data. ([Firebase][4])

---

## 2. High‑Level Architecture

You can picture your system like this:

* **iOS app (Swift/SwiftUI)**

  * Talks directly to **Firebase Auth** for login/registration
  * Talks directly to **Cloud Storage** for uploads/downloads
  * Optionally talks directly to **Firestore** for app data

* **Python/FastAPI backend**

  * Receives requests from the iOS app (e.g. `/payments/create`, `/reports/generate`)
  * Uses **Firebase Admin SDK (Python)** to:

    * **Verify ID tokens** from Firebase Auth
    * Optionally read/write Firestore or Storage
  * Runs on your own infrastructure or Google Cloud Run/Compute/etc. ([Read Medium articles with AI][5])

The iOS app authenticates with Firebase once, receives an **ID token**, and then includes that token as a `Bearer` token when calling your FastAPI APIs.

---

## 3. Setting Up Firebase in Your iOS Project

### 3.1. Create a Firebase Project and iOS App

1. Go to the **Firebase Console**.
2. Click **Add project** and follow the steps.
3. Add a new **iOS app** in the project:

   * Enter your app’s **Bundle Identifier** (must match your Xcode project).
4. Download the **`GoogleService-Info.plist`** file and add it to your Xcode project (ensure it’s in the main app target). ([Firebase][2])

### 3.2. Add Firebase SDK via Swift Package Manager (SPM)

In Xcode:

1. **File → Add Packages…**
2. Use the URL: `https://github.com/firebase/firebase-ios-sdk`
3. Add the packages you need:

   * `FirebaseAuth`
   * `FirebaseStorage`
   * `FirebaseFirestore` (if you’ll use it)
4. Add them to your app target.

(You *can* still use CocoaPods, but SPM is the current recommended path.) ([Firebase][2])

### 3.3. Initialize Firebase in Your App

**SwiftUI example:**

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
            RootView()
        }
    }
}
```

If you use UIKit + `AppDelegate`, call `FirebaseApp.configure()` in `application(_:didFinishLaunchingWithOptions:)`.

---

## 4. Creating a Login System with Firebase Authentication (iOS)

### 4.1. Enable Sign‑in Methods in the Console

1. In the **Firebase Console**, open your project.
2. Go to **Build → Authentication → Sign‑in method**.
3. Enable:

   * **Email/Password** (easy baseline)
   * Optionally **Apple**, **Google**, etc. later. ([Firebase][2])

### 4.2. Basic Auth Flow Overview

Typical flow:

1. **User signs up** (email + password) → Firebase creates the user.
2. **User signs in** → Firebase returns an authenticated `User`.
3. **App listens for auth state changes** to show either login UI or main app UI.
4. **User signs out** → app returns to login UI.
5. Optional: **Email verification**, **password reset**, **Apple/Google login**, etc.

### 4.3. Sign‑Up and Sign‑In (Swift)

**Sign‑up using email/password (async/await):**

```swift
import FirebaseAuth

struct AuthService {
    func signUp(email: String, password: String) async throws -> User {
        let result = try await Auth.auth().createUser(withEmail: email, password: password)
        return result.user
    }

    func signIn(email: String, password: String) async throws -> User {
        let result = try await Auth.auth().signIn(withEmail: email, password: password)
        return result.user
    }
}
```

If you can’t use async/await, use the closure-based versions:

```swift
Auth.auth().createUser(withEmail: email, password: password) { authResult, error in
    if let error = error {
        // handle error
        return
    }
    let user = authResult?.user
}
```

### 4.4. Tracking Authentication State

You usually want to show different screens depending on whether the user is logged in.

```swift
class SessionViewModel: ObservableObject {
    @Published var user: User?

    private var handle: AuthStateDidChangeListenerHandle?

    init() {
        handle = Auth.auth().addStateDidChangeListener { [weak self] auth, user in
            self?.user = user
        }
    }

    deinit {
        if let handle = handle {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    func signOut() {
        try? Auth.auth().signOut()
    }
}
```

**SwiftUI root view** could look like:

```swift
struct RootView: View {
    @StateObject private var session = SessionViewModel()

    var body: some View {
        Group {
            if let _ = session.user {
                MainAppView()
            } else {
                LoginView()
            }
        }
        .environmentObject(session)
    }
}
```

### 4.5. Password Reset

```swift
func resetPassword(email: String) async throws {
    try await Auth.auth().sendPasswordReset(withEmail: email)
}
```

Firebase sends the reset email using templates you can customize in the console. ([Firebase][2])

### 4.6. Getting an ID Token (for Talking to Your FastAPI Backend)

Firebase automatically manages internal access tokens for talking to Firebase itself, but for **your own backend** you’ll usually send the **ID token**:

```swift
Auth.auth().currentUser?.getIDToken(completion: { token, error in
    guard let token = token, error == nil else {
        // handle error
        return
    }
    // Send `token` as Bearer token to your FastAPI backend
})
```

You’ll use this token in the `Authorization: Bearer <token>` header on your HTTP requests.

---

## 5. Storing Many User Files with Cloud Storage for Firebase

You said “many files that users will create”. That’s exactly what **Cloud Storage for Firebase** is for: storing and serving user‑generated content (images, videos, docs, etc.). ([Firebase][1])

### 5.1. How Cloud Storage Works (Conceptually)

* Files are stored in **buckets** (like folders on the cloud).
* Each file has a **path** (`users/<uid>/files/<fileId>.ext`).
* Firebase client SDK handles:

  * Uploads (with retries, resumable uploads, progress)
  * Downloads (with caching and access control)
* Access is controlled via **Security Rules** that can use `request.auth.uid`, file metadata, and path. ([Firebase][1])

### 5.2. Add Firebase Storage to the iOS App

* Make sure you added the `FirebaseStorage` package via SPM.
* Initialize Firebase as before; no extra global config is needed.

Import and get a reference:

```swift
import FirebaseStorage

let storage = Storage.storage()
let rootRef = storage.reference()
```

### 5.3. Organizing Files per User

A common pattern is to store each user’s files under a directory with their UID:

```swift
func userFileReference(fileName: String) -> StorageReference? {
    guard let uid = Auth.auth().currentUser?.uid else { return nil }
    let storage = Storage.storage()
    return storage.reference()
        .child("users")
        .child(uid)
        .child("files")
        .child(fileName)
}
```

You might use a UUID as file name:

```swift
let fileName = "\(UUID().uuidString).jpg"
let fileRef = userFileReference(fileName: fileName)!
```

### 5.4. Uploading a File

Assume you have `Data` from an image the user created:

```swift
func uploadImage(data: Data) async throws -> URL {
    guard let uid = Auth.auth().currentUser?.uid else {
        throw NSError(domain: "Auth", code: 0, userInfo: [NSLocalizedDescriptionKey: "Not logged in"])
    }

    let storageRef = Storage.storage().reference()
    let fileName = "\(UUID().uuidString).jpg"
    let fileRef = storageRef.child("users/\(uid)/files/\(fileName)")

    let metadata = StorageMetadata()
    metadata.contentType = "image/jpeg"

    _ = try await fileRef.putDataAsync(data, metadata: metadata)

    // Get a download URL (if you want to show/share the file publicly or within app)
    let url = try await fileRef.downloadURL()
    return url
}
```

> Note: `putDataAsync` is available via Swift concurrency; you can also use the closure-based `putData`.

### 5.5. Listing or Discovering Files

Cloud Storage now supports listing files in folders, but for many apps, using a **database (Firestore)** to store metadata makes life easier (sorting, querying, ownership checks, etc.). ([Firebase][1])

**Example pattern**:

* After uploading file, write a document to Firestore:

```swift
import FirebaseFirestore

func saveFileMetadata(path: String, downloadURL: URL) async throws {
    let db = Firestore.firestore()
    guard let uid = Auth.auth().currentUser?.uid else { return }

    try await db.collection("files").addDocument(data: [
        "ownerId": uid,
        "path": path,
        "downloadURL": downloadURL.absoluteString,
        "createdAt": FieldValue.serverTimestamp()
    ])
}
```

Then you can query:

```swift
let db = Firestore.firestore()
db.collection("files")
  .whereField("ownerId", isEqualTo: uid)
  .order(by: "createdAt", descending: true)
```

### 5.6. Securing File Access (Storage Security Rules)

Very important: **Security Rules** ensure users can **only** read and write their own files.

Example rule (in `Storage rules` in Firebase console):

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Interpretation:

* Any file under `users/<userId>/...` is accessible only if:

  * The user is authenticated (`request.auth != null`)
  * Their `uid` matches `<userId>`.

Firebase Storage’s Auth integration is designed for exactly this style of rule. ([Firebase][1])

### 5.7. Best Practices for “Many Files”

* **Use paths by user UID** (`users/<uid>/...`).
* Use **UUIDs** for file names to avoid collisions.
* Compress images/videos where acceptable to save storage & bandwidth.
* Use Firestore for **metadata** (tags, names, sharing, etc.).
* Set **Storage Rules** carefully; test them with Firebase’s rules simulator.

---

## 6. Using a Python FastAPI Backend with Firebase

Short answer: **Yes**, you can absolutely use a **Python FastAPI backend** with Firebase. Firebase handles auth, storage, and/or data; FastAPI handles custom business logic and exposes APIs your iOS app calls.

### 6.1. What the Firebase Admin SDK (Python) Gives You

The **Firebase Admin Python SDK** is meant for **trusted server environments** and lets you: ([Firebase][4])

* **Verify Firebase ID tokens** (validate users authenticated in your iOS app)
* Generate custom tokens (e.g., if you integrate your own identity system)
* Read/write **Firestore** or the **Realtime Database**
* Access **Cloud Storage** buckets
* Manage users (create, delete, update accounts) if needed

### 6.2. Installing and Initializing Firebase Admin in FastAPI

**Install dependencies:**

```bash
pip install fastapi uvicorn firebase-admin
```

**Initialize the Admin SDK**:

You’ll download a **service account JSON** from the Firebase Console:

1. Console → Project Settings → Service accounts
2. Generate new private key → download JSON

Then in your FastAPI app:

```python
import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
```

> In production, don’t commit the JSON file to Git. Use environment variables, Google Cloud credentials, or a secret manager. ([Firebase][4])

### 6.3. Protecting FastAPI Endpoints with Firebase Auth

The pattern:

1. iOS app authenticates using **FirebaseAuth**.
2. iOS gets an **ID token** using `getIDToken`.
3. iOS calls your FastAPI endpoint with header:
   `Authorization: Bearer <ID_TOKEN>`
4. FastAPI uses `firebase_admin.auth.verify_id_token` to validate that token.
5. If valid → you get user info (`uid`, email, etc.) and can process the request. ([Stack Overflow][6])

**FastAPI example:**

```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

app = FastAPI()
security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    return decoded_token  # includes 'uid', 'email', etc.

@app.get("/profile")
def read_profile(user = Depends(get_current_user)):
    return {
        "uid": user["uid"],
        "email": user.get("email"),
    }
```

Now `/profile` is protected; only calls with a **valid Firebase ID token** will succeed.

### 6.4. Example iOS → FastAPI Call

From iOS (simplified):

```swift
func fetchProfile() {
    guard let user = Auth.auth().currentUser else { return }

    user.getIDToken { token, error in
        guard let token = token, error == nil else { return }

        var request = URLRequest(url: URL(string: "https://your-api.com/profile")!)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        URLSession.shared.dataTask(with: request) { data, response, error in
            // parse response...
        }.resume()
    }
}
```

### 6.5. Using FastAPI to Work with Firebase Data

**Firestore example:**

```python
from firebase_admin import firestore

db = firestore.client()

@app.post("/items")
def create_item(item: dict, user = Depends(get_current_user)):
    uid = user["uid"]
    doc_ref = db.collection("items").document()
    doc_ref.set({
        **item,
        "ownerId": uid,
    })
    return {"id": doc_ref.id}
```

**Accessing Cloud Storage from Python** is possible via the Admin SDK as well (`firebase_admin.storage`). You could:

* Run background processing (e.g., compress files, generate thumbnails).
* Move files, clean up after account deletion, etc. ([Firebase][4])

### 6.6. Where to Host FastAPI

Firebase itself doesn’t run arbitrary Python code, but you can:

* Deploy FastAPI to **Google Cloud Run**, **Compute Engine**, or any other cloud.
* Still use **Firebase Auth**, **Firestore**, and **Storage** from that backend via the Admin SDK. ([GitHub][7])

---

## 7. Putting It All Together: Suggested Architecture

Here’s a simple blueprint for your project:

1. **iOS Client**

   * Uses **Firebase Auth** for login.
   * Uses **Storage** for direct file uploads/downloads.
   * Uses **Firestore** for metadata, if needed.
   * Sends **Firebase ID token** when calling FastAPI endpoints.

2. **Firebase**

   * Auth: manages user identities.
   * Storage: stores user files under `users/<uid>/files/...`.
   * Firestore: stores references and metadata.
   * Security Rules: enforce per‑user access.

3. **FastAPI Backend**

   * Uses Firebase Admin SDK:

     * Verifies ID tokens.
     * Reads/writes Firestore.
     * Optionally works with Storage (e.g., background jobs).
   * Provides app‑specific business logic (billing, heavy processing, integrations).

---

## 8. Next Steps & References

Useful official docs and guides:

* **Firebase Auth on Apple platforms (official guide)** ([Firebase][2])
* **Cloud Storage for Firebase (overview & docs)** ([Firebase][1])
* **Firebase Admin Python SDK reference** ([Firebase][4])
* **Full iOS integration guide (Auth + Firestore + Storage)** ([Ali Mert Güleç][3])
* **Example projects combining FastAPI and Firebase Auth** ([Read Medium articles with AI][5])

---

If you tell me more about your specific app (e.g. “photo sharing”, “note taking”, “document editor”), I can adapt this into a concrete mini‑architecture and file structure tailored to your exact use case, with more focused code snippets.

[1]: https://firebase.google.com/docs/storage/?utm_source=chatgpt.com "Cloud Storage for Firebase"
[2]: https://firebase.google.com/docs/auth/ios/start?utm_source=chatgpt.com "Get Started with Firebase Authentication on Apple Platforms"
[3]: https://www.alimertgulec.com/en/blog/firebase-integration-ios-complete-guide?utm_source=chatgpt.com "Firebase Integration in iOS: Complete Guide with Swift"
[4]: https://firebase.google.com/docs/reference/admin/python/?utm_source=chatgpt.com "Firebase Admin Python SDK"
[5]: https://readmedium.com/create-an-api-with-user-management-using-fastapi-and-firebase-dbf1cb4a3876?utm_source=chatgpt.com "Create an API with User Management using FastAPI and Firebase"
[6]: https://stackoverflow.com/questions/64190757/fastapi-security-with-firebase-token?utm_source=chatgpt.com "python - FastAPI: security with firebase token - Stack Overflow"
[7]: https://github.com/RahulPrakash11/Python-Firebase-Authentication-FastAPI?utm_source=chatgpt.com "rahulprakash11/Python-Firebase-Authentication-FastAPI - GitHub"
