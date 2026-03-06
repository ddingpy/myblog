---
title: "Swift Sendable: A Practical Step-by-Step Guide (2025)"
date: 2025-11-01 10:00:00 +0900
tags: [swift, concurrency, sendable, swift6]
---


> `Sendable` tells the Swift compiler *“this value is safe to share across concurrent code (different tasks/actors) without data races.”* It’s a compile‑time safety net. ([Swift.org][1])

---

## Contents

1. [What `Sendable` means](#what-sendable-means)
2. [Where it shows up in real code](#where-it-shows-up-in-real-code)
3. [How Swift checks `Sendable`](#how-swift-checks-sendable)
4. [Using `@Sendable` with closures](#using-sendable-with-closures)
5. [Adopting `Sendable`: step‑by‑step](#adopting-sendable-step-by-step)
6. [Common errors & quick fixes](#common-errors--quick-fixes)
7. [Design tips and patterns](#design-tips-and-patterns)
8. [Swift 6 notes (migration, “strict concurrency”, inference, and *sending* closures)](#swift-6-notes-migration-strict-concurrency-inference-and-sending-closures)
9. [FAQ](#faq)

---

## What `Sendable` means

* **Formal idea:** A type that **conforms to `Sendable`** can be passed between concurrent contexts (e.g., between tasks or across actor boundaries) **without risking data races**. The compiler enforces this at build time. ([Swift.org][1])
* **Marker protocol:** `Sendable` has **no methods**; it expresses a guarantee that the type is safe to share. (That’s why it’s often called a *marker* protocol.) The feature was introduced by **SE‑0302** along with `@Sendable` closures. ([GitHub][2])

**Mental model:** If two pieces of code might run at the same time, values you pass between them must be either:

* **Independent copies** (typical for value types like `struct`), or
* **Protected behind isolation** (e.g., `actor`), or
* **Immutable and carefully designed** (some `final class`es), or
* **Explicitly marked “I know this is safe”** using `@unchecked Sendable` (escape hatch; use sparingly). ([Apple Developer][3])

---

## Where it shows up in real code

You’ll care about `Sendable` when you:

* **Pass values across actor boundaries** (e.g., from a UI‐isolated type to a background `actor`). The values must be sendable. ([Swift.org][1])
* **Create tasks or task groups** and pass data into their work closures. Those closures are checked for safe captures (see below). ([docs.swift.org][4])
* **Write async APIs** that accept or return values which might be used from other tasks. Declaring `Sendable` constraints makes intent clear and enforces safety in generic code. ([Swift.org][1])

---

## How Swift checks `Sendable`

### Value types (`struct`, `enum`)

* **Usually automatic.** Value types get **implicit** `Sendable` if **all stored properties are `Sendable`**. You don’t even need to write `: Sendable` most of the time. ([Swift.org][1])

```swift
struct User /* : Sendable (implicit) */ {
    let id: UUID       // Sendable
    var name: String   // Sendable
}
```

### Reference types (`class`)

* Classes aren’t value copies; they share state. So the compiler is stricter.
* **You can conform a class to `Sendable`** when it is designed to avoid shared mutable state (e.g., `final` and effectively immutable, or its state is safely synchronized).
* **Special case:** **`@MainActor` classes are implicitly sendable**, since the main actor serializes access to their state. (This is how many UI types remain usable with concurrency.) ([Apple Developer][3])

```swift
@MainActor
final class ImageCache {                // implicitly Sendable
    private var store: [URL: Data] = [:]
}
```

> If you truly need a class that isn’t trivially safe, consider making it an `actor` instead (isolation guarantees safety by design), or use locks carefully with `@unchecked Sendable` (see below).

### Actors

* **Actor references are safe to pass around** — they’re isolated; only one task at a time can touch their mutable state. This is why actors are a common fix for `Sendable` problems. (Actors are part of Swift’s data‑race safety model.) ([Swift.org][1])

### For types you don’t own

* The compiler needs to see all stored properties to verify safety, so **checked conformance** (`: Sendable`) **must be declared in the same file as the type**. If you need to add conformance to a type in a different module/file, you must use **`@unchecked Sendable`** and take responsibility for safety. ([Apple Developer][3])

---

## Using `@Sendable` with closures

Functions and closures can’t “conform” to protocols, so Swift uses an **attribute**:

```swift
func doWork(_ job: @escaping @Sendable () -> Void) { /* ... */ }
```

Rules for `@Sendable` closures (simplified):

* They might be **called from multiple threads at the same time**, so what they capture must be safe to access concurrently.
* Therefore, the compiler **forbids capturing mutable or non‑sendable values** (e.g., a `class` instance that isn’t `Sendable`). ([docs.swift.org][4])

**Bad (captures a mutable class instance):**

```swift
final class Counter { var value = 0 }
let counter = Counter()

func run(_ f: @escaping @Sendable () -> Void) { /* ... */ }

run {
    counter.value += 1     // ❌ capture of non-Sendable mutable state
}
```

**Better (use an actor):**

```swift
actor SafeCounter { private var value = 0; func inc() { value += 1 } }

let counter = SafeCounter()
run {
    Task { await counter.inc() }    // ✅ no shared mutable state
}
```

> Tip: Capturing a `let` constant only helps if the **type itself is Sendable**. Writing `let counter = Counter()` doesn’t make a `class` magically safe — `let` stops reassignment, not mutation.

---

## Adopting `Sendable`: step‑by‑step

Follow this checklist to add `Sendable` safely and calmly.

### Step 0 — Turn on the checks

* In **Swift 6 language mode**, data‑race safety (actor isolation + sendability) is enforced by default.
* In **Swift 5 mode**, you can **enable complete concurrency checking as warnings** via the `-strict-concurrency=complete` flag (Xcode Build Settings or `swiftc`) or the equivalent Package.swift settings. This lets you fix issues before you flip your project to Swift 6 mode. ([Swift.org][5])

### Step 1 — Start with your data models

* Prefer **value types** (`struct`/`enum`). They often become **implicitly `Sendable`** when their properties are sendable. If you need to make it explicit (for public API clarity), write `struct Model: Sendable { ... }`. ([Swift.org][1])

### Step 2 — Add constraints in generic code

* When writing generic async code, constrain parameters to `Sendable` if they’ll **cross concurrency boundaries**:

```swift
func store<T: Sendable>(_ value: T) async { /* ... */ }
```

This makes intent clear and yields better diagnostics. ([Swift.org][1])

### Step 3 — Annotate closure parameters

* If a closure might be called from other tasks (e.g., background work, task groups), require `@Sendable`:

```swift
func repeatAsync(times: Int, work: @escaping @Sendable () async -> Void) async {
    for _ in 0..<times { await work() }
}
```

This prevents callers from accidentally capturing unsafe values. ([docs.swift.org][4])

### Step 4 — Fix captures

* Inside `@Sendable` closures, **don’t capture**:

  * non‑sendable classes,
  * mutable locals (`var`),
  * or globals with shared mutable state.
* Solutions:

  1. **Use an `actor`** to guard mutation.
  2. **Copy values** into sendable forms (often by switching a small class to a `struct`).
  3. **Limit scope** so you pass only IDs/values, not whole objects. ([docs.swift.org][4])

### Step 5 — For classes, pick one of these designs

* **A. Make it an `actor`** if it owns mutable state shared by multiple tasks.
* **B. Keep it a `final class` but make state effectively immutable** (all `let` stored properties of sendable types).
* **C. Use `@MainActor`** for UI‑bound classes; they are implicitly sendable. ([Apple Developer][3])

### Step 6 — Only if you must: `@unchecked Sendable`

If you interface with legacy or Objective‑C APIs and you *know* a type is safe (e.g., all access is behind a lock/queue), you can use:

```swift
extension FileHandle: @unchecked Sendable {}    // you must uphold safety
```

**Warning:** this skips compiler checks; you’re responsible for correctness. Prefer `actor` or value‑type refactors when possible. ([Apple Developer][3])

### Step 7 — Rebuild, read diagnostics, iterate

* Swift’s error messages point at the **exact capture or property** that breaks sendability (e.g., “captured var in `@Sendable` closure”). Fix them one by one.

---

## Common errors & quick fixes

| Diagnostic (simplified)                                         | Why it happens                                                      | Quick fix                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| *“Capture of non‑Sendable type in a `@Sendable` closure”*       | Closure might run concurrently; you captured a mutable/class value. | Convert to `struct`/copy value, or use an `actor`, or make the class safely sendable. ([docs.swift.org][4])       |
| *“Reference to captured `var` in concurrently executing code”*  | Capturing a mutable local in a `@Sendable` closure is unsafe.       | Use a `let` copy, or wrap mutation in an `actor`. ([docs.swift.org][4])                                           |
| *“Non‑Sendable type passed across actor boundary”*              | You’re sending a value from one isolation to another.               | Make the type `Sendable` (value type), or use an `actor`. ([Swift.org][1])                                        |
| *“Conformance to `Sendable` must be declared in the same file”* | The compiler needs full visibility of stored properties.            | Move the conformance next to the type. If you can’t, use `@unchecked Sendable` cautiously. ([Apple Developer][3]) |
| *UI type can’t conform to `Sendable`*                           | UI classes are mutable and not thread‑safe.                         | Mark the type `@MainActor` (implicitly sendable) and keep UI work on the main actor. ([Apple Developer][3])       |

---

## Design tips and patterns

1. **Favor values for data, actors for stateful services.**
   Data models → `struct`; shared mutable state → `actor`. This usually sidesteps `Sendable` headaches. ([Swift.org][1])

2. **Narrow what you pass.**
   Pass **IDs** or small value snapshots instead of whole objects.

3. **Make generic APIs honest.**
   If your API may be used from other tasks, add `: Sendable` constraints and `@Sendable` closure parameters to catch mistakes earlier. ([Swift.org][1])

4. **Avoid the escape hatch unless necessary.**
   `@unchecked Sendable` is useful when wrapping legacy code with your own locking, but it becomes your permanent maintenance debt. ([Apple Developer][3])

5. **Know the “weird but true” bits.**

   * **Metatypes and some keypaths** are considered sendable; Swift 6 also improves **inference** for method and key‑path references so you get fewer false warnings. ([docs.swift.org][6])

---

## Swift 6 notes (migration, “strict concurrency”, inference, and *sending* closures)

* **Strict concurrency / data‑race safety** is a key Swift 6 theme. You can try it as warnings in Swift 5 mode (`-strict-concurrency=complete`) before upgrading. ([Swift.org][5])
* **Inference improvements (SE‑0418).** The compiler can infer `Sendable` for certain **method references and key‑path literals** so you don’t have to decorate everything by hand. You can also enable “Infer Sendable From Captures” in SwiftPM to reduce noise while migrating. ([GitHub][7])
* **`sending` closures (Swift 6):** Some standard APIs (e.g., `Task` initializers, task groups) now use *sending* closure parameters. A **sending** parameter transfers ownership so the caller can’t touch captured non‑sendable values after the call, which prevents races without requiring `@Sendable`. You’ll see diagnostics mentioning “sending closure risks causing data races” if you violate the rules. Think of it as a *single‑transfer* guarantee. `@Sendable` still matters widely; *sending* is an additional tool. ([GitHub][8])

---

## FAQ

**Do I need to write `: Sendable` on every struct?**
No. Most value types become sendable **implicitly** when their stored properties are sendable. Add `: Sendable` when you want the guarantee to be part of your public API surface. ([Swift.org][1])

**Can classes be `Sendable`?**
Yes, but only when they can’t cause data races (e.g., `final` + immutable, or all access is synchronized). Otherwise, make them `actor`s or keep them main‑actor‑isolated. ([Apple Developer][3])

**When is `@unchecked Sendable` OK?**
Only when you fully control access (e.g., all mutable state behind a lock/queue) and you’re willing to take responsibility if that changes later. Prefer safer designs first. ([Apple Developer][3])

**Why does my `@Sendable` closure reject `var` captures?**
Because it may run multiple times and concurrently. Capturing a `var` would allow racy mutation. Capture a `let` value or move the mutation into an `actor`. ([docs.swift.org][4])

---

## Worked examples

### 1) Making a model sendable (value type)

```swift
// Implicitly Sendable since all stored properties are sendable.
public struct TodoItem /* : Sendable */ {
    public let id: UUID
    public var title: String
    public var done: Bool
}
```

Why this works: value types are copied and don’t share mutable state across tasks. ([Swift.org][1])

---

### 2) A generic async function that enforces `Sendable`

```swift
// Any value you "send" to the worker must be Sendable.
func runOnWorker<T: Sendable>(
    value: T,
    work: @escaping @Sendable (T) async -> Void
) async {
    await work(value)
}
```

This prevents callers from passing unsafe types or unsafe closures. ([Swift.org][1])

---

### 3) Fixing a non‑sendable capture by using an actor

```swift
final class Metrics { var count = 0 }             // not sendable
let metrics = Metrics()

actor MetricsSink {                               // safe isolation
    private var count = 0
    func inc() { count += 1 }
}

let sink = MetricsSink()

func schedule(_ f: @escaping @Sendable () -> Void) { /* ... */ }

// ❌ Captures a class instance with shared mutable state.
schedule { metrics.count += 1 }

// ✅ Use the actor instead.
schedule { await sink.inc() }
```

---

### 4) Carefully using `@unchecked Sendable` for a wrapper

```swift
// Wrap a non-Sendable thing with explicit synchronization.
public final class LockedCounter: @unchecked Sendable {
    private var value = 0
    private let lock = NSLock()

    public func increment() {
        lock.lock(); defer { lock.unlock() }
        value += 1
    }
    public var current: Int {
        lock.lock(); defer { lock.unlock() }
        return value
    }
}
```

This compiles, but the *safety* is entirely your responsibility. Prefer `actor` unless you need Objective‑C interop or very specific performance behavior. ([Apple Developer][3])

---

## A quick migration recipe you can follow this week

1. **Enable checks** (`-strict-concurrency=complete` in Swift 5 mode or switch to Swift 6 mode). Build and list all diagnostics. ([Swift.org][5])
2. **Tackle data models first.** Convert obvious classes to `struct` or `actor`. Rebuild. ([Swift.org][1])
3. **Annotate APIs.** Add `@Sendable` to closure parameters that may run concurrently; add `: Sendable` constraints to generics. ([docs.swift.org][4])
4. **Fix captures.** Replace shared mutable objects with actors, or restructure to pass values/IDs. ([docs.swift.org][4])
5. **Handle the stragglers.** For types you don’t own, consider *temporary* `@unchecked Sendable` wrappers until upstream libraries adopt sendability. Track these in code comments. ([Apple Developer][3])
6. **Re‑enable the strictest mode.** Once clean, keep strict checks on so regressions are caught early. ([Swift.org][5])

---

## Further reading

* **`Sendable` (Apple Developer Docs)** — definition, class rules, `@unchecked Sendable`, and notes about `@MainActor` classes. ([Apple Developer][3])
* **Swift 6 Concurrency Migration Guide: Data‑Race Safety** — why value types are implicitly sendable and how checks work. ([Swift.org][1])
* **SE‑0302: Sendable and `@Sendable` closures** — the original proposal. ([GitHub][2])
* **Compiler diagnostics: captures in a `@Sendable` closure** — concrete rules for what you can capture. ([docs.swift.org][4])
* **SE‑0418: Inferring `Sendable` for methods and key‑path literals** — reduces boilerplate and false positives in Swift 6. ([GitHub][7])
* **Sending closures diagnostic / user docs** — why some APIs use *sending* parameters and what those warnings mean. ([docs.swift.org][9])

---

### Wrap‑up

* Think **“values & actors”** for concurrent code.
* Use `@Sendable` to make closure boundaries safe by default.
* Reserve `@unchecked Sendable` for rare cases (and document them).


[1]: https://www.swift.org/migration/documentation/swift-6-concurrency-migration-guide/dataracesafety/?utm_source=chatgpt.com "Data Race Safety | Documentation"
[2]: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0302-concurrent-value-and-concurrent-closures.md?utm_source=chatgpt.com "swift-evolution/proposals/0302-concurrent-value-and ..."
[3]: https://developer.apple.com/documentation/swift/sendable?utm_source=chatgpt.com "Sendable | Apple Developer Documentation"
[4]: https://docs.swift.org/compiler/documentation/diagnostics/sendable-closure-captures/?utm_source=chatgpt.com "Captures in a `@Sendable` closure | Documentation"
[5]: https://www.swift.org/documentation/concurrency/?utm_source=chatgpt.com "Enabling Complete Concurrency Checking - Swift.org"
[6]: https://docs.swift.org/compiler/documentation/diagnostics/sendable-metatypes/?utm_source=chatgpt.com "Sendable metatypes | Documentation"
[7]: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0418-inferring-sendable-for-methods.md?utm_source=chatgpt.com "swift-evolution/proposals/0418-inferring-sendable-for-methods ..."
[8]: https://github.com/swiftlang/swift/blob/main/userdocs/diagnostics/sending-closure-risks-data-race.md?utm_source=chatgpt.com "swift/userdocs/diagnostics/sending-closure-risks-data-race.md ..."
[9]: https://docs.swift.org/compiler/documentation/diagnostics/sending-closure-risks-data-race/?utm_source=chatgpt.com "Sending closure risks causing data races ..."
