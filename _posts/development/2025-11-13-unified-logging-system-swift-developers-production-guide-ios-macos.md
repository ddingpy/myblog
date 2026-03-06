---
title: "Unified Logging System for Swift Developers: Production Guide (iOS & macOS)"
date: 2025-11-13 12:00:00 +0900
tags: [swift, oslog, logging, ios, macos]
---


> **Scope:** This guide focuses on Apple’s **modern Swift `Logger` API** in the `OSLog` framework. We’ll cover structured logging, signposts for performance, privacy, Console/Xcode/CLI workflows, plus integration patterns for real apps.

---

## 1) Introduction

Apple’s **Unified Logging System (ULS)** is the platform‑wide facility for capturing app and system telemetry. It stores logs in efficient binary stores (memory and on‑disk), and you view them with **Console.app**, **Xcode**, or the **`log`** CLI. ULS supersedes older mechanisms like ASL/syslog and gives you level‑aware, privacy‑aware, structured logs. ([Apple Developer][1])

Why move beyond `print()` and the legacy `os_log` C API?

* **Performance:** logs are compiled into format strings with type‑safe interpolation; disabled logs are near‑zero overhead.
* **Structure & filtering:** **subsystem/category** tagging, **log levels**, and NSExpression **predicates** make filtering easy across tools.
* **Privacy:** per‑argument **privacy annotations** prevent sensitive values from leaking into user‑collectable logs.
* **Tooling:** first‑class support in **Console**, **Xcode**, **Instruments (Points of Interest)**, and the **`log`** CLI. ([Apple Developer][1])

---

## 2) The `Logger` API

### Create loggers

```swift
import OSLog

// Best practice: one static logger per concern.
extension Logger {
    static let network = Logger(subsystem: "com.example.myapp", category: "network")
    static let persistence = Logger(subsystem: "com.example.myapp", category: "persistence")
    static let lifecycle = Logger(subsystem: "com.example.myapp", category: "lifecycle")
}
```

**Subsystem & category**

* **`subsystem`**: reverse‑DNS identifier for a major area (often your bundle ID, e.g., `com.example.myapp`).
* **`category`**: finer‑grained grouping like `network`, `payments`, `coredata`, `auth`.
  Use consistent, searchable names; they become first‑class filters in Console/CLI. ([Apple Developer][2])

**Multiple ways to log**

```swift
Logger.network.debug("Starting request to \(url, privacy: .public)")
Logger.network.info("Cache hit: \(key, privacy: .private(mask: .hash))")
Logger.network.notice("Connectivity regained")
Logger.network.warning("Retrying after server throttled us (429)")
Logger.network.error("Upload failed, status=\(status)")
Logger.network.critical("Out-of-quota, aborting upload")
Logger.network.fault("Invariant violated: duplicated request IDs")

// Generic entry point if you have a dynamic level:
Logger.network.log(level: .debug, "headers=\(headers.description, privacy: .private)")
```

> **Comparison note:** `trace(_:)` is a convenience equivalent to `debug(_:)`; `notice(_:)` uses the default log type. Both are modern `Logger` methods. ([Apple Developer][3])

**Naming best practices**

* Use your **bundle identifier** as the subsystem root.
* Keep categories **stable** and **short**; prefer nouns (`network`, `payments`, `coredata`).
* Avoid over‑fragmentation (too many categories make filtering harder). ([Apple Developer][2])

---

## 3) Log Levels & Privacy

### Log levels at a glance

| Swift method                  | Under the hood | Typical usage                   | Persisted to disk by default* |
| ----------------------------- | -------------- | ------------------------------- | ----------------------------- |
| `trace`, `debug`              | `.debug`       | Verbose development diagnostics | **No** (in‑memory only)       |
| `info`                        | `.info`        | Useful but non‑essential info   | **No** (in‑memory; see note)  |
| `notice` (default), `log(_:)` | `.default`     | Important runtime notes         | **Yes**                       |
| `warning`                     | (convenience)  | Recoverable anomaly             | **Yes**                       |
| `error`                       | `.error`       | Operation failed                | **Yes**                       |
| `critical`                    | (convenience)  | Critical event; near failure    | **Yes**                       |
| `fault`                       | `.fault`       | Serious bug/system‑level fault  | **Yes**                       |

* **Persistence:** By default, **`debug`**/**`info`** are in memory and can be purged; others are written to the on‑disk store. You can alter behavior with the `log` CLI or profiles; `fault` is always persisted. ([Apple Developer][4])

> 💡 **Tip (visibility):** In the Xcode run console you’ll *see* `debug`/`info` readily. On end‑user devices, those levels aren’t usually persisted unless you enable them (e.g., with **`log config`** or a profile). ([Apple Developer][5])

### Privacy annotations

Per‑argument privacy **defaults to `auto`**, and you can override each interpolation:

```swift
Logger.network.info(
  "Login for user=\(email, privacy: .private(mask: .hash)) " +
  "device=\(UIDevice.current.name, privacy: .public) " +
  "lat=\(lat, format: .fixed(precision: 4), privacy: .sensitive)"
)
```

* **`.public`** — safe to show.
* **`.private`** — redacts by default; optional mask: `.hash` or `.none` (generic redaction).
* **`.sensitive`** — a stronger signal for redaction.
* **Formatting** — use type‑aware formatters (integers, floats, pointers, hex, alignment). ([Apple Developer][6])

> ⚠️ **Note:** Avoid string‑concatenating PII before logging; pass sensitive values via **interpolations with privacy** so the system can redact them appropriately. ([Apple Developer][6])

---

## 4) Structured Logging Examples

### A) Network requests & responses

```swift
struct APIClient {
    private let session: URLSession = .shared
    private let log = Logger.network

    func getUser(id: UUID) async throws -> User {
        let url = URL(string: "https://api.example.com/users/\(id)")!
        log.debug("GET \(url, privacy: .public)")
        let start = Date()

        var request = URLRequest(url: url)
        request.setValue("Bearer <redacted>", forHTTPHeaderField: "Authorization") // never log raw tokens
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        if let http = response as? HTTPURLResponse {
            log.notice("Response \(http.statusCode) in \((Date().timeIntervalSince(start) * 1000), format: .fixed(precision: 1)) ms")
        }

        do {
            let user = try JSONDecoder().decode(User.self, from: data)
            log.info("Decoded user id=\(user.id.uuidString, privacy: .private(mask: .hash))")
            return user
        } catch {
            log.error("Decoding failed: \(error.localizedDescription, privacy: .public)")
            throw error
        }
    }
}
```

### B) Core Data operations

```swift
final class Store {
    let container: NSPersistentContainer
    private let log = Logger.persistence

    func saveIfNeeded(context: NSManagedObjectContext) {
        guard context.hasChanges else { return }

        do {
            try context.save()
            log.notice("CoreData save() succeeded on main=\(Thread.isMainThread)")
        } catch {
            log.error("CoreData save() failed: \(error, privacy: .public)")
        }
    }

    func fetchTasks(limit: Int) throws -> [Task] {
        let req: NSFetchRequest<Task> = Task.fetchRequest()
        req.fetchLimit = limit
        log.debug("Fetch Tasks limit=\(limit)")
        let results = try container.viewContext.fetch(req)
        log.info("Fetched \(results.count) tasks")
        return results
    }
}
```

### C) Lifecycle events

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear {
                    Logger.lifecycle.notice("App launched build=\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?", privacy: .public)")
                }
        }
    }
}
```

### D) Errors with context

```swift
func writeFile(_ data: Data, to url: URL) {
    do {
        try data.write(to: url)
    } catch {
        Logger.persistence.error("Write failed url=\(url.lastPathComponent, privacy: .public) error=\(error, privacy: .public)")
    }
}
```

---

## 5) Signposts (Performance Tracing)

**What & why:** Signposts are low‑overhead markers to measure **durations** or **events** across your code. They produce rich timelines in **Instruments → Points of Interest** and align with your `subsystem`/`category`. Prefer the modern `OSSignposter` API; the older `os_signpost` functions are considered legacy. ([Apple Developer][7])

### Using `OSSignposter`

```swift
import OSLog

struct DB {
    private let log = OSLog(subsystem: "com.example.myapp", category: .pointsOfInterest)
    private let signposter = OSSignposter(subsystem: "com.example.myapp", category: "database")

    func query(_ sql: String) throws -> [Row] {
        // Generate a signpost ID for this interval:
        let spid = signposter.makeSignpostID()
        // Begin interval; attach safe context:
        let state = signposter.beginInterval("DB Query", id: spid, "sql=\(sql, privacy: .private)")
        defer { signposter.endInterval("DB Query", id: spid) }

        // ... do the work ...
        return try execute(sql)
    }
}
```

**Visualizing in Instruments**

1. **Product → Profile** in Xcode.
2. Choose **Points of Interest**.
3. Reproduce the flow; you’ll see intervals under your **subsystem/category**, with durations, counts, and summary stats. ([Apple Developer][8])

> 💡 **Tip:** Use `OSLog.Category.pointsOfInterest` (special category) to make signposts easier to find in Instruments. ([Apple Developer][9])

**Legacy fallback (`os_signpost`)**

```swift
// If you must target older OSes:
//
// let log = OSLog(subsystem: "com.example.myapp", category: .pointsOfInterest)
// let spid = OSSignpostID(log: log)
// os_signpost(.begin, log: log, name: "Migration")
// ...
// os_signpost(.end, log: log, name: "Migration")
```

> ⚠️ **Note:** Prefer `OSSignposter` on modern OSes; `os_signpost` is legacy/deprecated in newer SDKs. ([Apple Developer][10])

---

## 6) Viewing & Filtering Logs

### Console.app (macOS)

* **Devices list** → select your Mac or a connected iOS device.
* Use the **search/filter** bar: `subsystem:com.example.myapp category:network level:debug`.
* Toggle **Include Info** / **Include Debug** to see lower levels.
* **File → Save…** to export a `.logarchive`. (You can also open `.logarchive` via double‑click.) ([Apple Support][11])

### Xcode’s run console

* Logs appear live during a debug run.
* Use the filter field (bottom) and type `subsystem == "com.example.myapp"` or `category:network`.
* Color and symbols vary with level (notice, warning, error, fault, etc.).

### Terminal (the `log` CLI)

```bash
## Show historical logs for your app’s subsystem, including info/debug:
log show --predicate 'subsystem == "com.example.myapp"' --info --debug --last 1h

## Live stream just your category:
log stream --predicate 'category == "network"'

## Show only errors/faults from your process:
log show --predicate 'process == "MyApp" AND (eventType == error OR eventType == fault)' --last 30m

## Persist info/debug to disk while collecting diagnostics (macOS):
sudo log collect --last 15m --output ~/Desktop/MyApp-15m.logarchive

## Temporarily enable debug level for your subsystem (macOS while debugging):
sudo log config --mode "level:debug" --subsystem com.example.myapp
sudo log config --status --subsystem com.example.myapp
```

> 🧪 **Pro:** Unified logs are **binary & compressed**; you **must** use Console or the `log` tool to read them. `log show` reads from the store; `log stream` streams live. `log collect` gathers a **.logarchive** you can share with QA/support. ([Apple Developer][1])

---

## 7) Integration Patterns

### A) A minimal wrapper you can inject

```swift
protocol Loggable {
    func log(_ level: OSLogType, _ message: OSLogMessage)
}

struct OSLogger: Loggable {
    private let logger: Logger
    init(subsystem: String, category: String) {
        logger = Logger(subsystem: subsystem, category: category)
    }
    func log(_ level: OSLogType, _ message: OSLogMessage) {
        logger.log(level: level, message)
    }
}
```

### B) Hybrid approach — mirror critical logs to a local file

> ⚠️ **Use sparingly.** ULS is the source of truth. Mirroring to a local file can help offline support, but watch for PII and storage impact.

```swift
import OSLog

protocol LogSink { func write(level: OSLogType, message: String) }

final class FileSink: LogSink {
    private let url: URL
    private let queue = DispatchQueue(label: "log.filesink")
    private let maxBytes: Int = 512_000  // naive rotation

    init(filename: String = "app.log") {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        url = dir.appendingPathComponent(filename)
    }

    func write(level: OSLogType, message: String) {
        queue.async {
            let line = "[\(Date())] [\(level)] \(message)\n"
            if let data = line.data(using: .utf8) {
                if let attr = try? FileManager.default.attributesOfItem(atPath: url.path),
                   let size = attr[.size] as? NSNumber, size.intValue > maxBytes {
                    try? FileManager.default.removeItem(at: url)
                }
                try? data.append(fileURL: url)
            }
        }
    }
}

private extension Data {
    func append(fileURL: URL) throws {
        if FileManager.default.fileExists(atPath: fileURL.path) {
            let handle = try FileHandle(forWritingTo: fileURL)
            try handle.seekToEnd()
            try handle.write(contentsOf: self)
            try handle.close()
        } else {
            try write(to: fileURL, options: .atomic)
        }
    }
}
```

### C) A small **LoggingManager** that fans‑out to multiple sinks (ULS + file + crash reporters)

```swift
import OSLog

final class LoggingManager {
    static let shared = LoggingManager()

    private let osLogger = Logger(subsystem: "com.example.myapp", category: "app")
    private var sinks: [LogSink] = [FileSink()]  // add/remove as needed

    func log(_ level: OSLogType, _ message: @autoclosure () -> String) {
        // Avoid expensive message creation unless needed:
        if OSLog(subsystem: "com.example.myapp", category: "app").isEnabled(type: level) {
            osLogger.log(level: level, "\(message(), privacy: .public)")
        }
        // Mirror a redacted version to other sinks:
        let sanitized = message()  // ensure you've redacted PII yourself
        sinks.forEach { $0.write(level: level, message: sanitized) }

        #if canImport(FirebaseCrashlytics)
        // Crashlytics.crashlytics().log(sanitized)
        #endif

        #if canImport(Sentry)
        // SentrySDK.capture(message: sanitized)  // or use breadcrumbs
        #endif
    }
}
```

> 💡 **Tip:** Use `OSLog.isEnabled(type:)` to short‑circuit **expensive** string building or JSON serialization for disabled levels. ([Apple Developer][2])

### D) Environment‑based logging

```swift
#if DEBUG
let MinLogLevel: OSLogType = .debug
#else
let MinLogLevel: OSLogType = .default
#endif
```

### E) Swift macros to simplify call sites (advanced)

Create a macros package (via `swift package init --type macro`) and define a freestanding expression macro that injects file/line/function metadata and your subsystem/category:

```swift
// Usage in app code:
#logInfo("Loaded home screen")

// Expansion (conceptually):
Logger(subsystem: "com.example.myapp", category: "ui")
    .info("[\(Date()) \(#fileID):\(#line) \(#function)] Loaded home screen")
```

> 🧠 **Migrating from `os_log`?** Move to `Logger` methods (`debug/info/notice/error/fault`) and convert format strings to **interpolations** with **privacy options**. `Logger` is the modern Swift API; use `OSSignposter` for performance tracing. ([Apple Developer][12])

---

## 8) Advanced Use Cases

### Conditional logging with `#if DEBUG`

```swift
#if DEBUG
Logger.network.debug("Debug‑only message: \(diagnostics)")
#endif
```

### SwiftUI

Inject a logger or your `LoggingManager` into the environment and use from views:

```swift
struct ContentView: View {
    var body: some View {
        List { /* ... */ }
            .task {
                LoggingManager.shared.log(.default, "Content loaded")
            }
    }
}
```

### Combine

```swift
publisher
    .handleEvents(
        receiveSubscription: { _ in Logger.network.debug("Subscribed") },
        receiveOutput: { value in Logger.network.debug("Output: \(value, privacy: .private)") },
        receiveCompletion: { completion in Logger.network.info("Completion: \(String(describing: completion), privacy: .public)") }
    )
    .sink { _ in /* ... */ }
```

### Async/background tasks

```swift
Task.detached(priority: .background) {
    Logger.lifecycle.notice("Background sync started")
    // ...
    Logger.lifecycle.notice("Background sync completed")
}
```

### Integrating with Crashlytics/Sentry

* Send **breadcrumb‑level** info (`notice`/`warning`) to the SDK and keep **sensitive details** in ULS (private).
* Avoid duplicating **high‑volume** `debug` in third‑party SDKs.

### Performance & memory tips

* Prefer **one static `Logger`** per category.
* Use **privacy annotations** (redaction is faster than allocating/serializing your own sanitized strings).
* Guard expensive work: `if OSLog(subsystem: "...", category: "...").isEnabled(type: .debug) { /* build payload */ }`. ([Apple Developer][2])

---

## 9) Common Mistakes & Best Practices

**Mistakes to avoid**

* Logging **sensitive data** without privacy annotations.
* Sprinkling ad‑hoc `Logger(subsystem:..., category:...)` initializations everywhere (creates inconsistency).
* Excessive logging in production at `debug`/`info` (noise & battery).
* Building huge strings/JSON for disabled levels.
* Relying solely on flat file logs (ULS is the source of truth).

**Best practices**

* **Standardize subsystem/category** names in a shared file.
* Keep **PII redacted** with `privacy: .private(mask: .hash)` or `.sensitive`. ([Apple Developer][6])
* Use **signposts** for performance: wrap expensive operations and view them in Instruments. ([Apple Developer][8])
* For diagnostics, **export `.logarchive`** with `log collect` and share with QA/support. ([Apple Developer][13])
* If you must mirror logs, **rotate** local files and keep them sanitized.

---

## 10) Reference & Cheat Sheets

### A) Levels, visibility & use cases

| Method(s)            | Level intent                    | Visibility/storage                                                            |
| -------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `trace`, `debug`     | Verbose diagnostics             | In‑memory only by default. ([Apple Developer][4])                             |
| `info`               | Helpful but non‑essential       | In‑memory; written when **collecting** or per config. ([Apple Developer][14]) |
| `notice` / `log(_:)` | Default app runtime information | Written to disk. ([Apple Developer][15])                                      |
| `warning`            | Recoverable oddities            | Written to disk (default severity path).                                      |
| `error`              | Operation error                 | Written to disk. ([Apple Developer][16])                                      |
| `critical`           | Critical event                  | Written to disk (high severity).                                              |
| `fault`              | Serious bug/system fault        | Always written to disk. ([Apple Developer][17])                               |

### B) `log` CLI quick commands

| Task                                            | Command                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Historical logs for your app (incl. info/debug) | `log show --predicate 'subsystem == "com.example.myapp"' --info --debug --last 1h`          |
| Live stream by category                         | `log stream --predicate 'category == "network"'`                                            |
| Snapshot for support (15 minutes)               | `sudo log collect --last 15m --output ~/Desktop/MyApp-15m.logarchive`                       |
| Enable debug level for subsystem (macOS)        | `sudo log config --mode "level:debug" --subsystem com.example.myapp`                        |
| Show only errors/faults                         | `log show --predicate '(eventType == error OR eventType == fault) AND process == "MyApp"'"` |

> 🔎 **Where do logs live?** In a **binary, compressed** store; use Console or `log` to view. ([Apple Developer][1])

### C) Best‑Practice Checklist

* [ ] Define stable **subsystem** = bundle ID; **categories** = features. ([Apple Developer][2])
* [ ] Create **static** `Logger`s per category.
* [ ] Add **privacy annotations** to every interpolation with user data. ([Apple Developer][6])
* [ ] Use **signposts** for durations around hot paths. ([Apple Developer][8])
* [ ] Gate expensive work with `OSLog.isEnabled(type:)`. ([Apple Developer][2])
* [ ] For QA, **export `.logarchive`** with `log collect`. ([Apple Developer][13])
* [ ] Avoid spamming `debug`/`info` in production; elevate important messages to `notice` or above.

---

## Appendix — Extra Examples

### Mixed privacy + formatting

```swift
Logger.network.notice(
  """
  Upload finished: bytes=\(bytes, format: .decimal, privacy: .public) \
  md5=\(digest, privacy: .private(mask: .hash)) \
  elapsed=\(elapsed, format: .fixed(precision: 2))s
  """
)
```

### Logging only if a level is enabled

```swift
let oslog = OSLog(subsystem: "com.example.myapp", category: "network")
if oslog.isEnabled(type: .debug) {
    let pretty = try? JSONSerialization.jsonObject(with: data).description
    Logger.network.debug("Response JSON: \(pretty ?? "<invalid>", privacy: .private)")
}
```

### Export logs from your app (macOS/iOS 15+)

```swift
import OSLog

func exportRecentLogs() async -> String {
    do {
        let store = try OSLogStore(scope: .currentProcessIdentifier)
        let position = store.position(timeIntervalSinceLatestBoot: 300) // last 5 min
        let entries = try store.getEntries(at: position)
            .compactMap { $0 as? OSLogEntryLog }
            .filter { $0.subsystem == "com.example.myapp" }
        return entries.map { "[\($0.date)] [\($0.category)] \($0.composedMessage)" }
                      .joined(separator: "\n")
    } catch {
        return "Failed to fetch logs: \(error)"
    }
}
```

> 💡 **Tip:** On iOS, `OSLogStore` scope is limited to the **current process**; logs from previous launches aren’t generally available. For full archives, collect via the Mac using `log collect` from a connected device. ([Stack Overflow][18])

---

## Closing Thoughts

With `Logger` + ULS you get **structured, privacy‑aware, and performant** logging with first‑class tooling across Apple platforms. Use **levels** wisely, **tag** consistently, **annotate** privacy, and **trace** performance with **signposts**. Your future self (and your QA/support teams) will thank you.

---

### Sources & further reading

* **Apple — Logging (Unified Logging overview)**: availability, storage model, and tools. ([Apple Developer][16])
* **Apple — `Logger` API**: levels, `log(level:)`, `debug/info/notice/error/fault`, `trace` (≈ `debug`), `warning`, `critical`. ([Apple Developer][19])
* **Apple — Subsystem & Category (OSLog)**: how to define and filter. ([Apple Developer][2])
* **Apple — Privacy & Formatters (`OSLogPrivacy`, message argument formatters)**. ([Apple Developer][6])
* **Apple — Signposts (`OSSignposter`, Points of Interest)** and legacy `os_signpost`. ([Apple Developer][7])
* **Apple — Viewing Logs (Console & CLI)** and **Customizing logging via `log config`**. ([Apple Developer][1])

---

[1]: https://developer.apple.com/documentation/os/viewing-log-messages?utm_source=chatgpt.com "Viewing Log Messages | Apple Developer Documentation"
[2]: https://developer.apple.com/documentation/os/oslog?utm_source=chatgpt.com "OSLog | Apple Developer Documentation"
[3]: https://developer.apple.com/documentation/os/logger/trace%28_%3A%29?utm_source=chatgpt.com "trace (_:) | Apple Developer Documentation"
[4]: https://developer.apple.com/documentation/os/logger/debug%28_%3A%29?utm_source=chatgpt.com "debug (_:) | Apple Developer Documentation"
[5]: https://developer.apple.com/documentation/os/customizing-logging-behavior-while-debugging?utm_source=chatgpt.com "Customizing Logging Behavior While Debugging - Apple Developer"
[6]: https://developer.apple.com/documentation/os/oslogprivacy?utm_source=chatgpt.com "OSLogPrivacy | Apple Developer Documentation"
[7]: https://developer.apple.com/documentation/os/ossignposter?utm_source=chatgpt.com "OSSignposter | Apple Developer Documentation"
[8]: https://developer.apple.com/documentation/os/recording-performance-data?utm_source=chatgpt.com "Recording Performance Data | Apple Developer Documentation"
[9]: https://developer.apple.com/documentation/os/oslog/category/pointsofinterest?utm_source=chatgpt.com "pointsOfInterest | Apple Developer Documentation"
[10]: https://developer.apple.com/documentation/os/os_signpost%28_%3Adso%3Alog%3Aname%3Asignpostid%3A%29-2oz8u?utm_source=chatgpt.com "os_signpost(_:dso:log:name:signpostID:) | Apple Developer Documentation"
[11]: https://support.apple.com/guide/console/browse-the-log-archive-cnsl4f3fc2df/mac?utm_source=chatgpt.com "Browse the log archive in Console on Mac - Apple Support"
[12]: https://developer.apple.com/documentation/os/generating-log-messages-from-your-code?utm_source=chatgpt.com "Generating Log Messages from Your Code - Apple Developer"
[13]: https://developer.apple.com/forums/thread/705868?utm_source=chatgpt.com "Your Friend the System Log | Apple Developer Forums"
[14]: https://developer.apple.com/documentation/os/logger/info%28_%3A%29?utm_source=chatgpt.com "info(_:) | Apple Developer Documentation"
[15]: https://developer.apple.com/documentation/os/logger/log%28_%3A%29?utm_source=chatgpt.com "log(_:) | Apple Developer Documentation"
[16]: https://developer.apple.com/documentation/os/logging?utm_source=chatgpt.com "Logging | Apple Developer Documentation"
[17]: https://developer.apple.com/documentation/os/oslogtype/fault?utm_source=chatgpt.com "fault | Apple Developer Documentation"
[18]: https://stackoverflow.com/questions/70454673/how-do-i-view-logs-from-a-remote-ios-device-using-the-unified-logging-system?utm_source=chatgpt.com "swift - How do I view logs from a REMOTE iOS device using the unified ..."
[19]: https://developer.apple.com/documentation/os/logger/log%28level%3A_%3A%29?utm_source=chatgpt.com "log (level:_:) | Apple Developer Documentation"
