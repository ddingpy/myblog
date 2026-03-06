---
title: "Firebase iOS Backend with Auth, AWS S3 Files, and Optional FastAPI API (Part 5)"
date: 2025-12-31 09:25:00 +0900
tags: [firebase, ios, fastapi, aws, s3, auth, swift]
---


This example does exactly these steps:

1. **Get Firebase ID token** from the currently signed-in user
2. **Call your FastAPI** `POST /v1/uploads/presign` with `Authorization: Bearer <token>`
3. **Upload bytes to S3** with `URLSession` using the returned presigned **PUT** URL
4. **Write a Firestore document** referencing the uploaded S3 object `key` (not the presigned URL)

> Assumptions
>
> * You’ve already added Firebase to your iOS app and called `FirebaseApp.configure()` at startup.
> * The user is already signed in (Email/Password, Apple, etc.).
> * Your FastAPI endpoint returns JSON like:
>
>   ```json
>   { "key": "users/<uid>/uploads/<uuid>.jpg", "putUrl": "https://...", "expiresSeconds": 900 }
>   ```
> * Firestore rules allow the signed-in user to write under `users/{uid}/files/{fileId}`.

---

### Firestore Security Rules (minimum needed for the client-write step)

If you want the *client* to create a file metadata doc, this is the simplest safe rule shape:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/files/{fileId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

You can harden this later with `keys().hasOnly([...])`, field validation, etc.

---

## 1) Swift models + async helpers

Create a file like `EndToEndUpload.swift`.

```swift
import Foundation
import FirebaseAuth
import FirebaseFirestore

// MARK: - API models

struct PresignUploadRequest: Encodable {
    let contentType: String
    let fileExt: String?
    let expiresSeconds: Int
}

struct PresignUploadResponse: Decodable {
    let key: String
    let putUrl: String
    let expiresSeconds: Int
}

// MARK: - Errors

enum UploadFlowError: Error {
    case notSignedIn
    case badURL
    case nonHttpResponse
    case httpStatus(Int)
    case missingToken
}

// MARK: - FirebaseAuth async helper (works even if your SDK lacks async APIs)

extension User {
    func getIDTokenAsync(forceRefresh: Bool = false) async throws -> String {
        try await withCheckedThrowingContinuation { cont in
            self.getIDTokenForcingRefresh(forceRefresh) { token, error in
                if let error = error {
                    cont.resume(throwing: error)
                    return
                }
                guard let token else {
                    cont.resume(throwing: UploadFlowError.missingToken)
                    return
                }
                cont.resume(returning: token)
            }
        }
    }
}

// MARK: - Firestore async helper (works even if your SDK lacks async APIs)

extension DocumentReference {
    func setDataAsync(_ data: [String: Any], merge: Bool = false) async throws {
        try await withCheckedThrowingContinuation { cont in
            self.setData(data, merge: merge) { error in
                if let error = error {
                    cont.resume(throwing: error)
                } else {
                    cont.resume(returning: ())
                }
            }
        }
    }
}
```

---

## 2) API client: call `/v1/uploads/presign` with Firebase ID token

```swift
struct ApiClient {
    let baseURL: URL

    func presignUpload(contentType: String, fileExt: String?, expiresSeconds: Int = 900) async throws -> PresignUploadResponse {
        guard let user = Auth.auth().currentUser else { throw UploadFlowError.notSignedIn }
        let idToken = try await user.getIDTokenAsync(forceRefresh: false)

        let url = baseURL.appendingPathComponent("/v1/uploads/presign")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = PresignUploadRequest(contentType: contentType, fileExt: fileExt, expiresSeconds: expiresSeconds)
        req.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw UploadFlowError.nonHttpResponse }
        guard (200..<300).contains(http.statusCode) else { throw UploadFlowError.httpStatus(http.statusCode) }

        return try JSONDecoder().decode(PresignUploadResponse.self, from: data)
    }
}
```

> If your backend enforces **App Check**, you’d add `X-Firebase-AppCheck: <token>` here too.
> (I’m keeping the main example focused on the 4 steps you requested.)

---

## 3) Upload bytes to S3 using the presigned PUT URL

Important: if your presign includes `ContentType` in the signature (common), you **must** set the same `Content-Type` header, or S3 will reject the request with a signature mismatch.

```swift
func uploadToS3PresignedPut(putUrlString: String, data: Data, contentType: String) async throws {
    guard let url = URL(string: putUrlString) else { throw UploadFlowError.badURL }

    var req = URLRequest(url: url)
    req.httpMethod = "PUT"
    req.setValue(contentType, forHTTPHeaderField: "Content-Type")

    let (_, response) = try await URLSession.shared.upload(for: req, from: data)
    guard let http = response as? HTTPURLResponse else { throw UploadFlowError.nonHttpResponse }
    guard (200..<300).contains(http.statusCode) else { throw UploadFlowError.httpStatus(http.statusCode) }
}
```

---

## 4) Write a Firestore document referencing the S3 key

This writes the metadata under the signed-in user:

Path: `users/{uid}/files/{autoId}`

```swift
func writeFileMetadataToFirestore(s3Key: String, contentType: String) async throws -> DocumentReference {
    guard let user = Auth.auth().currentUser else { throw UploadFlowError.notSignedIn }

    let uid = user.uid
    let db = Firestore.firestore()

    let docRef = db.collection("users")
        .document(uid)
        .collection("files")
        .document() // auto ID

    let payload: [String: Any] = [
        "ownerUid": uid,
        "storage": "s3",
        "s3Key": s3Key,
        "contentType": contentType,
        "status": "ready",
        "createdAt": FieldValue.serverTimestamp()
    ]

    try await docRef.setDataAsync(payload)
    return docRef
}
```

**Strong opinion:** do **not** store the presigned URL in Firestore. It expires and it’s effectively a capability token. Store the stable `s3Key` and generate download URLs via your backend.

---

## 5) The combined “do everything” function

This is the complete end-to-end flow:

```swift
struct EndToEndUploader {
    let api: ApiClient

    /// Returns the Firestore doc path and the S3 key for later use.
    func uploadAndRegister(
        data: Data,
        contentType: String,
        fileExt: String?
    ) async throws -> (firestoreDocPath: String, s3Key: String) {

        // 1) Presign
        let presign = try await api.presignUpload(contentType: contentType, fileExt: fileExt)

        // 2) Upload bytes to S3
        try await uploadToS3PresignedPut(
            putUrlString: presign.putUrl,
            data: data,
            contentType: contentType
        )

        // 3) Write Firestore metadata (client-write variant)
        let docRef = try await writeFileMetadataToFirestore(
            s3Key: presign.key,
            contentType: contentType
        )

        return (docRef.path, presign.key)
    }
}
```

> Production hardening option (recommended later):
> Instead of having the client write metadata directly, add a `POST /v1/files/{id}/complete` endpoint and let the server verify the object exists (S3 HEAD) and then write/update Firestore metadata server-side.

---

## SwiftUI demo UI (pick an image → upload → show result)

This is an iOS 16+ example using `PhotosPicker`.

```swift
import SwiftUI
import PhotosUI

@MainActor
final class UploadExampleViewModel: ObservableObject {
    @Published var status: String = "Idle"
    @Published var lastFirestorePath: String?
    @Published var lastS3Key: String?

    private let uploader: EndToEndUploader

    init(apiBaseURL: URL) {
        self.uploader = EndToEndUploader(api: ApiClient(baseURL: apiBaseURL))
    }

    func uploadPickedImage(data: Data) async {
        do {
            status = "Presigning…"
            let result = try await uploader.uploadAndRegister(
                data: data,
                contentType: "image/jpeg",
                fileExt: "jpg"
            )
            lastFirestorePath = result.firestoreDocPath
            lastS3Key = result.s3Key
            status = "Done ✅"
        } catch {
            status = "Error: \(error)"
        }
    }
}

struct UploadExampleView: View {
    @StateObject private var vm = UploadExampleViewModel(
        apiBaseURL: URL(string: "https://api.example.com")! // <-- change this
    )

    @State private var pickerItem: PhotosPickerItem?
    @State private var pickedData: Data?

    var body: some View {
        VStack(spacing: 16) {
            PhotosPicker("Pick a photo", selection: $pickerItem, matching: .images)

            if pickedData != nil {
                Button("Upload to S3 and register in Firestore") {
                    guard let pickedData else { return }
                    Task { await vm.uploadPickedImage(data: pickedData) }
                }
            }

            Text(vm.status).font(.footnote)

            if let path = vm.lastFirestorePath {
                Text("Firestore doc: \(path)").font(.footnote)
            }
            if let key = vm.lastS3Key {
                Text("S3 key: \(key)").font(.footnote)
            }
        }
        .padding()
        .task(id: pickerItem) {
            guard let pickerItem else { return }
            pickedData = try? await pickerItem.loadTransferable(type: Data.self)
        }
    }
}
```

---

## What you’ll typically do next (practical next steps)

* **Downloads:** add an endpoint like `POST /v1/files/presign-download` so the app can fetch a GET presigned URL for a given `s3Key` (after server authorization).
* **App Check:** if you’re seeing abuse (or want preventive protection), require and verify App Check tokens on the presign endpoints.
* **Server-managed metadata:** move the Firestore metadata write into your backend if you want stricter validation and fewer client-side permissions.

If you paste your current FastAPI presign response (the exact JSON you return), I can tailor the Swift `Decodable` model + headers to match it exactly (some presign implementations require extra headers beyond `Content-Type`).
