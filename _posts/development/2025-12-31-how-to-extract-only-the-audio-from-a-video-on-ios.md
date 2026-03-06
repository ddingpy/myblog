---
title: "Extracting Only the Audio from a Video on iOS (Swift)"
date: 2025-12-31 12:00:00 +0900
tags: [ios, avfoundation, audio, swift]
---


This guide shows how to take a video file (e.g. from the Files app, camera, or Photos library) and export only its audio track as an `.m4a` file using **AVFoundation**.

---

## Overview

Conceptually, the steps are:

1. Load the video as an `AVAsset`.
2. Pull out its audio track.
3. Put that audio track into an `AVMutableComposition`.
4. Use `AVAssetExportSession` to export that composition to an audio-only file (`.m4a`).

You don’t need microphone permissions or anything special: you’re just processing a file the user already has access to.

---

## Requirements

- iOS 13+ (examples use APIs available from iOS 13, optional async/await note for iOS 15+).
- `AVFoundation` framework.
- If you’re using the Photos library: `Photos` framework (`PHAsset`).

---

## Core Idea: Using AVAssetExportSession

There are two common approaches:

1. **Export directly from the video asset** with an audio-only output file type and preset.
2. **Create a composition with only the audio track**, then export that.

The composition approach is a bit more explicit and easier to customize (e.g. trimming, multiple tracks), so we’ll use that.

---

## Helper: Generate an Output URL

We’ll export to the temporary directory as `UUID().m4a`:

```swift
import Foundation

func makeTemporaryM4AURL() -> URL {
    let filename = UUID().uuidString + ".m4a"
    return FileManager.default.temporaryDirectory.appendingPathComponent(filename)
}
```

---

## Function: Extract Audio from a Local Video URL

```swift
import AVFoundation

enum AudioExtractionError: Error {
    case noAudioTrack
    case cannotCreateTrack
    case cannotCreateExportSession
    case exportFailed(String?)
}

func extractAudio(
    from videoURL: URL,
    completion: @escaping (Result<URL, Error>) -> Void
) {
    let asset = AVURLAsset(url: videoURL)
    
    // 1. Find the first audio track
    guard let audioTrack = asset.tracks(withMediaType: .audio).first else {
        completion(.failure(AudioExtractionError.noAudioTrack))
        return
    }
    
    // 2. Create a composition and add an audio-only track
    let composition = AVMutableComposition()
    
    guard let compositionAudioTrack = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
    ) else {
        completion(.failure(AudioExtractionError.cannotCreateTrack))
        return
    }
    
    do {
        let timeRange = CMTimeRange(start: .zero, duration: asset.duration)
        try compositionAudioTrack.insertTimeRange(
            timeRange,
            of: audioTrack,
            at: .zero
        )
    } catch {
        completion(.failure(error))
        return
    }
    
    // 3. Create an export session (audio preset)
    guard let exportSession = AVAssetExportSession(
        asset: composition,
        presetName: AVAssetExportPresetAppleM4A
    ) else {
        completion(.failure(AudioExtractionError.cannotCreateExportSession))
        return
    }
    
    let outputURL = makeTemporaryM4AURL()
    
    // Remove any file at that location first, just in case
    try? FileManager.default.removeItem(at: outputURL)
    
    exportSession.outputURL = outputURL
    exportSession.outputFileType = .m4a
    exportSession.shouldOptimizeForNetworkUse = true
    
    // 4. Export asynchronously
    exportSession.exportAsynchronously {
        switch exportSession.status {
        case .completed:
            completion(.success(outputURL))
        case .failed, .cancelled:
            let message = exportSession.error?.localizedDescription
            completion(.failure(AudioExtractionError.exportFailed(message)))
        default:
            // .unknown, .waiting, .exporting (shouldn't end here, but just in case)
            let message = exportSession.error?.localizedDescription
            completion(.failure(AudioExtractionError.exportFailed(message)))
        }
    }
}
```

Usage example from a view controller:

```swift
let videoURL: URL = /* your video file URL */

extractAudio(from: videoURL) { result in
    DispatchQueue.main.async {
        switch result {
        case .success(let audioURL):
            print("Audio exported to:", audioURL)
            // e.g. share it:
            // let activityVC = UIActivityViewController(activityItems: [audioURL], applicationActivities: nil)
            // present(activityVC, animated: true)
        case .failure(let error):
            print("Audio extraction failed:", error)
        }
    }
}
```

---

## Using async/await (iOS 15+)

If you like async/await, wrap the export in a `withCheckedThrowingContinuation`:

```swift
func extractAudio(from videoURL: URL) async throws -> URL {
    try await withCheckedThrowingContinuation { continuation in
        extractAudio(from: videoURL) { result in
            continuation.resume(with: result)
        }
    }
}
```

Then:

```swift
Task {
    do {
        let audioURL = try await extractAudio(from: videoURL)
        print("Audio at:", audioURL)
    } catch {
        print("Failed:", error)
    }
}
```

---

## Extracting Audio from a PHAsset (Photos Library)

If your video comes from the Photos library (e.g. user selects something in `PHPickerViewController` or you have a `PHAsset`), you first need an `AVAsset` from that `PHAsset`.

```swift
import Photos
import AVFoundation

func requestAVAsset(from phAsset: PHAsset, completion: @escaping (AVAsset?) -> Void) {
    let options = PHVideoRequestOptions()
    options.version = .original    // or .current if you want edited version
    options.deliveryMode = .automatic
    options.isNetworkAccessAllowed = true
    
    PHImageManager.default().requestAVAsset(
        forVideo: phAsset,
        options: options
    ) { avAsset, _, _ in
        completion(avAsset)
    }
}
```

Then:

```swift
func extractAudio(
    fromPHAsset phAsset: PHAsset,
    completion: @escaping (Result<URL, Error>) -> Void
) {
    requestAVAsset(from: phAsset) { avAsset in
        guard let urlAsset = avAsset as? AVURLAsset else {
            completion(.failure(NSError(domain: "AudioExtraction", code: -1, userInfo: [NSLocalizedDescriptionKey: "Could not get URL from PHAsset"])))
            return
        }
        
        extractAudio(from: urlAsset.url, completion: completion)
    }
}
```

> ⚠️ If the video is in iCloud, `requestAVAsset` may take a while and may download data over the network.

---

## Choosing Presets and Formats

For most use cases:

* **Preset**: `AVAssetExportPresetAppleM4A`
* **File type**: `.m4a`

Other options:

* If you want to preserve the original audio format without re-encoding, you can sometimes use `AVAssetExportPresetPassthrough`, but you’ll typically get a container like `.mov` or `.mp4` that can still contain a video track. Using the composition with only an audio track + `.m4a` is a clean “audio only” outcome.

---

## Common Edge Cases

* **Video has no audio**
  `tracks(withMediaType: .audio)` may be empty. Handle `noAudioTrack` gracefully.

* **DRM or protected content**
  Some assets (e.g. certain streams or protected content) cannot be exported; `AVAssetExportSession` will fail.

* **Very large files**
  Exports are asynchronous; always treat this as a background operation. Avoid blocking the main thread.

* **Sandbox paths**
  If you need to keep the audio around, move it from `temporaryDirectory` to your app’s documents directory or elsewhere:

  ```swift
  func moveAudioToDocuments(from url: URL) throws -> URL {
      let docs = try FileManager.default.url(
          for: .documentDirectory,
          in: .userDomainMask,
          appropriateFor: nil,
          create: true
      )
      let dest = docs.appendingPathComponent(url.lastPathComponent)
      try? FileManager.default.removeItem(at: dest)
      try FileManager.default.moveItem(at: url, to: dest)
      return dest
  }
  ```

---

## Simple End-to-End Summary

1. Get a `URL` to the video (from camera, Files, or Photos via `PHAsset`).
2. Build an `AVURLAsset` from that URL.
3. Grab its audio track.
4. Put the audio track into an `AVMutableComposition`.
5. Export using `AVAssetExportPresetAppleM4A` and `.m4a`.
6. Use the resulting file URL (e.g. save it, upload it, or share it).

That’s the whole “video → audio-only file” pipeline on iOS in Swift.

