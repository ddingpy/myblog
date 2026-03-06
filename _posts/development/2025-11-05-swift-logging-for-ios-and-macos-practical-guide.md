---
title: "Swift Logging for iOS and macOS: A Practical Guide"
date: 2025-11-05 12:00:00 +0900
tags: [swift, oslog, logging, ios, macos]
---


> **TL;DR (recommendations)**
>
> * Use Apple’s **unified logging** (`Logger` from `OSLog`) for app diagnostics. Prefer level‑appropriate calls (`.debug`, `.info`, `.notice`, `.error`, `.fault`). ([Apple Developer][1])
> * Treat logs as **user‑visible artifacts**: don’t write sensitive data; use `OSLogPrivacy` (`.private`, `.public`, `.sensitive(mask: .hash)`). ([Apple Developer][2])
> * Know what’s **persisted**: by default **`debug`** stays in memory only; **`info`** stays in memory unless configuration changes or when faults (and optionally errors) occur; **`notice/log`**, **`error`**, **`fault`** are written to on‑device stores. Use higher levels sparingly. ([Apple Developer][3])
> * For **performance analysis**, add **signposts** (`OSSignposter`) and inspect them in Instruments. ([Apple Developer][4])
> * Shipping with logging code is **normal and expected**; ensure your **App Privacy** disclosures are accurate if you upload or otherwise collect logs, and keep sensitive values redacted. ([Apple Developer][5])

---

## Table of Contents

1. [What is Apple’s Unified Logging?](#what-is-apples-unified-logging)
2. [Choosing an API: `print`, `NSLog`, `os_log`, `Logger`](#choosing-an-api-print-nslog-os_log-logger)
3. [Set up a `Logger` (subsystem/category)](#set-up-a-logger-subsystemcategory)
4. [Write logs by level (with privacy)](#write-logs-by-level-with-privacy)
5. [Avoid leaking data: privacy & formatting](#avoid-leaking-data-privacy--formatting)
6. [Performance: overhead, disabling, and hot paths](#performance-overhead-disabling-and-hot-paths)
7. [Measure performance with Signposts](#measure-performance-with-signposts)
8. [Viewing, filtering & collecting logs](#viewing-filtering--collecting-logs)
9. [Shipping to the App Store with logging in place](#shipping-to-the-app-store-with-logging-in-place)
10. [Patterns & snippets (grab bag)](#patterns--snippets-grab-bag)
11. [References](#references)

---

## What is Apple’s Unified Logging?

Apple’s **unified logging system** centralizes app and system telemetry, storing messages in **binary, compressed** form (in memory and on disk) so that logging is efficient even in production. You view logs in Xcode’s console, macOS **Console.app**, Instruments, or the `log` CLI. ([Apple Developer][1])

### Persistence by level (important!)

* **`debug`**: captured **in memory only** (and only when debug logging is enabled); purged per configuration. ([Apple Developer][3])
* **`info`**: initially **in memory only**; not moved to the data store unless config changes or when faults (and optionally errors) occur. ([Apple Developer][6])
* **`notice` / `log(_:)`**: default level, written to **memory and on‑disk log stores**. ([Apple Developer][7])
* **`error`**: persisted to the data store. ([Apple Developer][8])
* **`fault`**: **always persisted**; intended for system‑level or multi‑process errors. ([Apple Developer][9])

This architecture keeps routine diagnostics cheap while ensuring serious issues are preserved. ([Apple Developer][10])

---

## Choosing an API: `print`, `NSLog`, `os_log`, `Logger`

* **`Logger` (Swift, in `OSLog`)** — the modern, structured API with level‑specific methods, privacy controls, and compiler‑assisted formatting. Use this for almost all app logging. ([Apple Developer][11])
* **`os_log` / `OSLog` (C/Obj‑C/Swift overlay)** — earlier interface; still available, but Apple recommends moving to the newer Swift `Logger` APIs. ([Apple Developer][12])
* **`NSLog`** — logs to the **Apple System Log** and may also write to `stderr`. Prefer `Logger` for modern apps, though `NSLog` can still be handy for quick debugging or in older code paths. ([Apple Developer][13])
* **`print`** — standard output; simple, but lacks levels, privacy, and unified logging integration. Use sparingly during development and avoid in production paths (prefer `Logger`). ([Apple Developer][14])

---

## Set up a `Logger` (subsystem/category)

Define one `Logger` per **functional area** (category) under your app’s **subsystem** (use your bundle identifier).

```swift
import OSLog

enum AppLog {
    static let subsystem = Bundle.main.bundleIdentifier!

    static let app      = Logger(subsystem: subsystem, category: "app")
    static let network  = Logger(subsystem: subsystem, category: "network")
    static let storage  = Logger(subsystem: subsystem, category: "storage")
}
```

Subsystems & categories help filter noise in Console/Instruments. ([Apple Developer][15])

---

## Write logs by level (with privacy)

```swift
// App lifecycle
AppLog.app.notice("Launched build \(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?", privacy: .public)")

// Network (do not leak raw identifiers)
let userID = "12345-ABCDE"
AppLog.network.info("Fetching profile for user \(userID, privacy: .sensitive(mask: .hash))")

// Error cases
do {
    let data = try await api.fetch()
    AppLog.network.notice("Fetched \(data.count, privacy: .public) bytes")
} catch {
    AppLog.network.error("Fetch failed: \(error.localizedDescription, privacy: .public)")
}

// Debug-only breadcrumbs
#if DEBUG
AppLog.storage.debug("Cache warmup complete")
#endif
```

* `privacy: .public` shows the value; **omit** unless you intend to display that data.
* `privacy: .private` always redacts; `privacy: .sensitive(mask: .hash)` redacts but still lets you correlate equal values via a hash. ([Apple Developer][2])

---

## Avoid leaking data: privacy & formatting

Apple’s **Message Argument Formatters** drive privacy and presentation directly from string interpolation — *don’t wrap messages in `String` before passing them to `Logger`*, or you’ll lose these compiler/runtime optimizations. ([Apple Developer][16])

Common patterns:

```swift
let email = "jane@example.com"
let ms: Double = 123.456

AppLog.app.info("User email \(email, privacy: .sensitive(mask: .hash))")
AppLog.app.info("Login took \(ms, privacy: .public) ms") // consider rounding before logging
```

> Because people can access logs your app generates (e.g., via Console), use privacy modifiers for **all PII and secrets**. ([Apple Developer][2])

---

## Performance: overhead, disabling, and hot paths

* Unified logs are **binary & compressed**, deferring stringification to the reader; this **reduces overhead**. ([Apple Developer][10])
* Choosing the right **level** matters: lower‑severity messages are typically in-memory, while `notice/error/fault` persist to disk. Overuse of persistent levels increases cost. ([Apple Developer][6])
* If building expensive payloads, either:

  * **Guard by level** using the C API before doing work:

    ```swift
    import OSLog

    let oslog = OSLog(subsystem: AppLog.subsystem, category: "network")
    if os_log_is_enabled(oslog, .debug) {
        let payload = computeExpensivePayload()
        AppLog.network.debug("Payload \(payload, privacy: .private)")
    }
    ```

    ([Apple Developer][17])
  * Or compute summary stats (counts, sizes) instead of full bodies.

Apple’s guidance is to **leave logging enabled in production** and select levels so that default behavior is efficient; enable more verbose levels only when needed. ([Swift Forums][18])

---

## Measure performance with Signposts

Use **signposts** to bracket operations and visualize timing in Instruments (**os_signposts** instrument).

```swift
import OSLog

let signposter = OSSignposter(subsystem: AppLog.subsystem, category: "network")

func download(_ url: URL) async throws -> Data {
    let state = signposter.beginInterval("Download", id: .exclusive)
    defer { signposter.endInterval("Download", state) }

    AppLog.network.notice("Starting download \(url.absoluteString, privacy: .public)")
    let (data, _) = try await URLSession.shared.data(from: url)
    AppLog.network.notice("Completed download \(url.lastPathComponent, privacy: .public)")
    return data
}
```

* Create intervals with `beginInterval(_:id:)` and finish with `endInterval`.
* To show activity in the “**Points of Interest**” lane, log signposts under the `pointsOfInterest` category. ([Apple Developer][19])

---

## Viewing, filtering & collecting logs

### Xcode debug console

Run under Xcode and use the **structured logging** UI (Xcode 15+). It understands levels, categories, file/line navigation, and filtering. ([Apple Developer][14])

### Console.app (macOS)

* Connect a device and open **Console.app**. Use the search/filter to match your **subsystem** or **category**.
* Show low‑severity logs: **Action → Include Info Messages** and **Action → Include Debug Messages**. (These toggles affect the live stream; archives already include them.) ([Apple Support][20])

### Command line (macOS)

```bash
## Live stream (include debug)
log stream --level debug --predicate 'subsystem == "com.yourco.yourapp"'

## Show recent logs from the last hour (by subsystem & category)
log show --last 1h --predicate 'subsystem == "com.yourco.yourapp" AND category == "network"'

## Collect a logarchive you can share
log collect --last 1h --output ~/Desktop/app-logs.logarchive
```

Open a `.logarchive` in Console to browse/share. ([Apple Support][21])

> You can also adjust logging configuration while debugging on macOS to include lower levels for a specific subsystem (see “Customizing logging behavior while debugging”). ([Apple Developer][22])

---

## Shipping to the App Store with logging in place

**Bottom line:** Apple expects production apps to use unified logging responsibly. **Including logging code isn’t grounds for rejection.** The important considerations are **privacy, volume, and disclosure**:

1. **Privacy & redaction**

   * Treat logs as potentially user‑accessible. Use `OSLogPrivacy` to keep PII/secrets redacted (`.private` or `.sensitive(mask: .hash)`), only marking explicit values `.public` when appropriate. ([Apple Developer][2])

2. **App Privacy disclosures (Store listing)**

   * If your app **collects** logs (e.g., uploads to a server, support e‑mail, diagnostics upload), ensure your **App Privacy** answers are accurate and your privacy policy reflects this. Tracking behavior across apps/sites requires ATT consent; normal on‑device logging doesn’t, but **sending identifiers/diagnostics off‑device** may. ([Apple Developer][5])

3. **Volume & performance**

   * Prefer low‑cost levels (`debug`, `info`) during development; only persist (`notice`, `error`, `fault`) when it’s truly useful. Excessive persistent logs can impact performance and fill quotas sooner. ([Apple Developer][6])

4. **Legacy APIs**

   * Avoid introducing new `os_log`/`NSLog` usage in modern Swift code; prefer `Logger`. If you keep legacy calls, know that `NSLog` writes to the system log (and may also go to `stderr`). ([Apple Developer][12])

5. **Debug‑only gates (optional)**

   * It’s fine to compile out extremely verbose logs:

     ```swift
     #if DEBUG
     AppLog.app.debug("Verbose dev-only detail")
     #endif
     ```
   * But don’t rely solely on this; production diagnostics are often invaluable, and Apple’s logging stack is engineered for low overhead in release builds. ([Apple Developer][10])

---

## Patterns & snippets (grab bag)

### A. Category‑per‑file helper

Keep categories consistent without hand‑typing.

```swift
import OSLog

extension Logger {
    /// Category derived from the calling file name, e.g., "SearchViewModel"
    static func forFile(_ file: String = #fileID) -> Logger {
        let category = file.split(separator: "/").last.map(String.init) ?? "app"
        return Logger(subsystem: Bundle.main.bundleIdentifier!, category: category)
    }
}

// Usage
let log = Logger.forFile()
log.notice("Started")
```

### B. Sampling to avoid flood

Throttle hot‑loop logs.

```swift
struct LogSampler {
    private var last = DispatchTime(uptimeNanoseconds: 0)

    mutating func every(_ seconds: TimeInterval, _ block: () -> Void) {
        let now = DispatchTime.now()
        if now.uptimeNanoseconds - last.uptimeNanoseconds >= UInt64(seconds * 1_000_000_000) {
            last = now; block()
        }
    }
}

var sampler = LogSampler()
sampler.every(5) {
    AppLog.network.info("Progress heartbeat")
}
```

### C. Guard expensive work behind “is logging enabled?”

If you must build large payloads:

```swift
import OSLog

let oslog = OSLog(subsystem: AppLog.subsystem, category: "export")
if os_log_is_enabled(oslog, .debug) {
    let big = computeLargeDiagnosticText()
    AppLog.app.debug("Export preview: \(big, privacy: .private)")
}
```

([Apple Developer][17])

### D. Minimal network span with a signpost

```swift
import OSLog

let sp = OSSignposter(subsystem: AppLog.subsystem, category: "network")

func post(_ body: Data, to url: URL) async throws {
    let s = sp.beginInterval("POST", id: .exclusive)
    defer { sp.endInterval("POST", s) }
    // ... perform URLSession work
}
```

Inspect the interval in Instruments → **os_signposts**. ([Apple Developer][4])

### E. Console & CLI cheats

```bash
## See everything for your app live (debug+)
log stream --level debug --predicate 'subsystem == "com.yourco.yourapp"'

## Export a shareable archive (attach to bug reports)
log collect --last 30m --output ~/Desktop/yourapp.logarchive
```

Open the archive in Console. ([Apple Support][21])

---

## References

* **Apple docs — Unified Logging overview & behavior**

  * *Logging* (overview and tools). ([Apple Developer][1])
  * *Viewing Log Messages* (binary/efficient storage). ([Apple Developer][10])
  * *Generating Log Messages from Your Code* (subsystem/category usage). ([Apple Developer][15])
  * Level persistence details: **debug** (memory). **info** (memory unless configured / when faults happen). **notice/log** (default writes to memory+disk). **fault** (always persisted). ([Apple Developer][3])

* **Apple docs — Swift `Logger`, formatters & privacy**

  * *Message Argument Formatters*. ([Apple Developer][16])
  * *OSLogPrivacy* (`.public`, `.private`, `.sensitive(mask: .hash)`); rationale that logs are user‑accessible. ([Apple Developer][2])

* **Apple docs — Signposts & Instruments**

  * *OSSignposter* and sample flow (`beginInterval` / `endInterval`). ([Apple Developer][4])
  * *Recording Performance Data* (signpost timelines in Instruments). ([Apple Developer][19])
  * *Points of Interest category*. ([Apple Developer][23])

* **Apple docs — Legacy & migration**

  * *os_log*: “migrate away from legacy symbols” (prefer `Logger`). ([Apple Developer][12])
  * *NSLog* / *NSLogv*: logs to Apple System Log (and possibly `stderr`). ([Apple Developer][13])

* **Apple docs — Tools**

  * *Customizing logging behavior while debugging* (enable more verbose levels for a subsystem). ([Apple Developer][22])
  * *Console.app user guide* (Include Info/Debug Messages). ([Apple Support][20])
  * *Browse the log archive in Console*. ([Apple Support][21])
  * `log` CLI (collect/show/stream) reference. ([SS64][24])

* **Apple videos**

  * WWDC20 **Explore logging in Swift** (modern Swift logging, performance, privacy). ([Apple Developer][11])
  * WWDC23 **Debug with structured logging** (Xcode 15 console experience). ([Apple Developer][14])

* **App Store privacy & policy**

  * *App Privacy details on the App Store* (disclose data collection, diagnostics). ([Apple Developer][5])
  * *User Privacy & Data Use* (tracking consent, disclosures). ([Apple Developer][25])

* **Apple guidance (forums)**

  * “Leave logs enabled in production; choose levels appropriately.” (Quinn, Apple DTS). ([Swift Forums][18])

---

### Appendix: Minimal migration from `os_log` to `Logger`

Before:

```swift
import os.log
let legacy = OSLog(subsystem: "com.yourco.yourapp", category: "network")
os_log("Request to %{public}s failed: %{public}s", log: legacy, type: .error, url.absoluteString, error.localizedDescription)
```

After:

```swift
import OSLog
let network = Logger(subsystem: "com.yourco.yourapp", category: "network")
network.error("Request to \(url.absoluteString, privacy: .public) failed: \(error.localizedDescription, privacy: .public)")
```

Apple recommends migrating to the Swift `Logger` API for readability, privacy, and performance. ([Apple Developer][12])

---

If you want, tell me what frameworks your app uses (e.g., URLSession, CoreData), and I can add **domain‑specific logging templates** (network retries, decoding failures, background tasks, database migrations, etc.) tailored to your codebase.

[1]: https://developer.apple.com/documentation/os/logging?utm_source=chatgpt.com "Logging | Apple Developer Documentation"
[2]: https://developer.apple.com/documentation/os/oslogprivacy?utm_source=chatgpt.com "OSLogPrivacy | Apple Developer Documentation"
[3]: https://developer.apple.com/documentation/os/oslogtype/debug?utm_source=chatgpt.com "debug | Apple Developer Documentation"
[4]: https://developer.apple.com/documentation/os/ossignposter?utm_source=chatgpt.com "OSSignposter | Apple Developer Documentation"
[5]: https://developer.apple.com/app-store/app-privacy-details/?utm_source=chatgpt.com "App Privacy Details - App Store - Apple Developer"
[6]: https://developer.apple.com/documentation/os/os_log_info?utm_source=chatgpt.com "os_log_info | Apple Developer Documentation"
[7]: https://developer.apple.com/documentation/os/logger/log%28_%3A%29?utm_source=chatgpt.com "log(_:) | Apple Developer Documentation"
[8]: https://developer.apple.com/documentation/os/logger/log%28level%3A_%3A%29?utm_source=chatgpt.com "log (level:_:) | Apple Developer Documentation"
[9]: https://developer.apple.com/documentation/os/oslogtype/fault?utm_source=chatgpt.com "fault | Apple Developer Documentation"
[10]: https://developer.apple.com/documentation/os/viewing-log-messages?utm_source=chatgpt.com "Viewing Log Messages | Apple Developer Documentation"
[11]: https://developer.apple.com/videos/play/wwdc2020/10168/?utm_source=chatgpt.com "Explore logging in Swift - WWDC20 - Videos - Apple Developer"
[12]: https://developer.apple.com/documentation/os/os_log?utm_source=chatgpt.com "os_log | Apple Developer Documentation"
[13]: https://developer.apple.com/documentation/foundation/nslog%28_%3A_%3A%29?utm_source=chatgpt.com "NSLog(_:_:) | Apple Developer Documentation"
[14]: https://developer.apple.com/videos/play/wwdc2023/10226/?utm_source=chatgpt.com "Debug with structured logging - WWDC23 - Videos - Apple ..."
[15]: https://developer.apple.com/documentation/os/generating-log-messages-from-your-code?utm_source=chatgpt.com "Generating Log Messages from Your Code - Apple Developer"
[16]: https://developers.apple.com/documentation/os/message-argument-formatters?utm_source=chatgpt.com "Message Argument Formatters | Apple Developer Documentation"
[17]: https://developer.apple.com/documentation/os/os_log_is_enabled?utm_source=chatgpt.com "os_log_is_enabled | Apple Developer Documentation"
[18]: https://forums.swift.org/t/wrap-os-logger-to-programmatically-enable-disable-the-output/78070?utm_source=chatgpt.com "Wrap os Logger to programmatically enable / disable the output"
[19]: https://developer.apple.com/documentation/os/recording-performance-data?utm_source=chatgpt.com "Recording Performance Data | Apple Developer Documentation"
[20]: https://support.apple.com/en-mz/guide/console/cnsl35710/mac?utm_source=chatgpt.com "Customize the log window in Console on Mac - Apple Support"
[21]: https://support.apple.com/guide/console/browse-the-log-archive-cnsl4f3fc2df/mac?utm_source=chatgpt.com "Browse the log archive in Console on Mac - Apple Support"
[22]: https://developer.apple.com/documentation/os/customizing-logging-behavior-while-debugging?utm_source=chatgpt.com "Customizing Logging Behavior While Debugging - Apple ..."
[23]: https://developer.apple.com/documentation/os/oslog/category/pointsofinterest?utm_source=chatgpt.com "pointsOfInterest | Apple Developer Documentation"
[24]: https://ss64.com/mac/log.html?utm_source=chatgpt.com "log Man Page - macOS - SS64.com"
[25]: https://developer.apple.com/app-store/user-privacy-and-data-use/?utm_source=chatgpt.com "User Privacy and Data Use - App Store - Apple Developer"
