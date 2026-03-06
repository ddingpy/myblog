---
title: "A Practical Guide to nonisolated in Swift Concurrency"
date: 2025-11-21 12:00:00 +0900
tags: [swift, concurrency, actors, nonisolated]
---


Swift’s concurrency model leans heavily on *isolation*—especially **actor isolation**—to prevent data races. The `nonisolated` modifier is a precision tool that lets you selectively *opt out* of that isolation for specific members, so you can call them without hopping to the actor’s executor (and thus without `await`). Used well, it helps you keep APIs fast and ergonomic while preserving safety.

---

## What `nonisolated` Means

**Definition:**
`nonisolated` marks an actor (or global‐actor–isolated type) member as **not isolated to that actor**. Such members:

* Are callable from *any* context without `await` and without switching executors.
* **Must not** read or mutate actor-isolated state (directly or indirectly).
* Are effectively “plain” synchronous Swift code with no special isolation.

**Where it applies:**

* Instance `func`s, computed `var`s, and `subscript`s of actors or types annotated with a global actor (e.g., `@MainActor`).
* Protocol requirements and their conforming implementations (to promise a nonisolated API surface).
* `static` members are already nonisolated; `nonisolated` is about instance members.

> Tip: `nonisolated` does **not** make code magically thread-safe. It only says, “this member doesn’t require actor isolation,” so you must design it to truly not depend on isolated state.

---

## How It Interacts with Actor Isolation

By default, every instance member of an `actor` is *actor-isolated*. Calling it from outside the actor requires `await`, which hops to the actor’s executor.

Marking a member `nonisolated` **removes** that isolation—no hop, no suspension. But that freedom comes with a rule: the member **cannot access actor-isolated state**. The compiler enforces this for safe `nonisolated` (see `nonisolated(unsafe)` caveat later).

```swift
actor Counter {
    private var value = 0

    func increment() {            // isolated to Counter
        value += 1
    }

    nonisolated func version() -> String {  // no hop, no await
        "1.0"
    }

    nonisolated var isBeta: Bool {          // computed, no actor state
        false
    }
}
```

Calling site:

```swift
let counter = Counter()
await counter.increment()  // requires hop

counter.version()          // no await ✅
counter.isBeta             // no await ✅
```

If a `nonisolated` member touches isolated state, the compiler flags it:

```swift
actor Counter {
    private var value = 0

    nonisolated func snapshot() -> Int {
        value            // ❌ error: actor-isolated property 'value' can’t be accessed from a nonisolated context
    }
}
```

---

## Use Cases That Fit `nonisolated`

1. **Pure utilities and constants**
   Methods that compute results from inputs only (or constants), not from actor state.

   ```swift
   actor UUIDProvider {
       nonisolated static let namespace = UUID(uuidString: "6ba7b810-9dad-11d1-80b4-00c04fd430c8")!

       nonisolated func make() -> UUID { UUID() } // safe: no actor state
   }
   ```

2. **Protocol conformances that should be usable everywhere**
   Many protocols are most ergonomic when conforming members are callable without `await`:

   * `CustomStringConvertible.description`
   * `Hashable.hash(into:)`
   * `Equatable.==`
   * `Comparable.<`
   * `Error`, `LocalizedError`, etc.

   ```swift
   actor User: CustomStringConvertible, Hashable {
       let id: UUID
       private var name: String

       init(id: UUID, name: String) {
           self.id = id
           self.name = name
       }

       nonisolated var description: String { "User(\(id))" } // uses only 'id' (immutable)

       nonisolated func hash(into hasher: inout Hasher) {
           hasher.combine(id)  // avoid isolated state like 'name'
       }

       nonisolated static func == (lhs: User, rhs: User) -> Bool {
           lhs.id == rhs.id
       }
   }
   ```

3. **Global-actor types that need “fast path” members**
   On `@MainActor` types (view models, controllers), you might want some members callable off the main thread without hopping:

   ```swift
   @MainActor
   final class SessionViewModel {
       let sessionID = UUID()

       nonisolated var stableID: UUID { sessionID } // ❌ usually illegal: touches isolated state
       // Fix: capture an immutable copy during init into a nonisolated-friendly store.
   }

   @MainActor
   final class SafeSessionViewModel {
       private let _id: UUID  // initialized once; never mutated
       init() { _id = UUID() }

       nonisolated var stableID: UUID { _id }  // ✅ not accessing main-actor state; it's just a private, immutable value
   }
   ```

4. **Logging / metrics / feature flags** that don’t depend on actor state.
   Keep hot-path logging synchronous and hop-free.

---

## Correct vs. Incorrect Usage

### Correct

```swift
actor Math {
    nonisolated func fib(_ n: Int) -> Int {
        // Pure function: no actor state
        if n < 2 { return n }
        var a = 0, b = 1
        for _ in 2...n { (a, b) = (b, a + b) }
        return b
    }
}
```

### Incorrect (accessing isolated state)

```swift
actor Cache {
    private var storage: [String: String] = [:]

    nonisolated var count: Int {
        storage.count           // ❌ error: touches actor-isolated 'storage'
    }
}
```

### Incorrect (derived from mutable isolated state—even if you *could* read it)

Even if you somehow bypass checks, exposing values derived from mutable isolated state as `nonisolated` is a data-race risk.

```swift
actor Clock {
    private var skewMillis: Int = 0

    nonisolated func now() -> Date {
        // ❌ Conceptually wrong: result depends on mutable actor state.
        Date().addingTimeInterval(TimeInterval(skewMillis) / 1000)
    }
}
```

---

## `nonisolated` vs. Related Concepts

### `nonisolated` (safe)

* **Where:** actor/global-actor instance members; protocol requirements.
* **Effect:** callable from anywhere, no `await`, no executor hop.
* **Constraint:** cannot touch actor-isolated state; compiler enforces.

### `nonisolated(unsafe)` (escape hatch)

* **Effect:** same call-site behavior as `nonisolated`, **but** the compiler does *not* fully enforce “no actor state” access. You can read isolated state… and introduce data races.
* **Use sparingly**, typically for legacy interop, debugging hooks, or when you *prove* the touched state is effectively immutable.

```swift
actor ImageCache {
    private var count = 0

    nonisolated(unsafe) func debugCount() -> Int {
        count // ⚠️ allowed, but racy; don’t ship this in production
    }
}
```

### `isolated` (parameter modifier)

* **Where:** function parameters (including `self` in protocols/extension methods).
* **Effect:** inside the function, the parameter is treated as if you’re already on that actor’s executor, so you can access its isolated state synchronously **without `await`**.
* **Use case:** factoring logic into helpers that run *on* an actor while keeping the helper itself synchronous.

```swift
func dumpState(of actor: isolated Counter) {
    // Inside here, you’re on actor’s executor; can touch isolated state.
    // No 'await' needed for actor operations.
}

let c = Counter()
await dumpState(of: c)  // Call site must ensure isolation (await or be already on it).
```

### Regular actor members (default)

* Instance members are isolated; calling from off-actor needs `await`.
* Safest and most common default.

---

## Common Pitfalls

1. **Reading isolated state (directly or indirectly)**

   * Direct field access is rejected for safe `nonisolated`.
   * Indirect reads (e.g., calling an isolated helper) also violate isolation.

2. **Leaking mutable state through “stable” views**

   * Don’t expose references/pointers derived from isolated state; even if they look read-only, the underlying data may mutate concurrently.

3. **Forgetting global-actor context**

   * `@MainActor` types are also “actor-isolated” to the main actor. `nonisolated` on those members still must avoid main-actor state.

4. **Overusing `nonisolated(unsafe)`**

   * It compiles but undermines safety guarantees. Treat it like `unsafeBitCast`: last resort.

5. **Stored properties**

   * `nonisolated` applies to **methods / computed properties / subscripts**. Stored properties remain isolated; design around that (capture immutable copies in init, or expose safe computed views).

---

## Best Practices

* **Make it obviously pure.** Keep `nonisolated` members free of side effects and independent of mutable isolated state.
* **Prefer immutable inputs.** If you must reference instance data, arrange it so the data is immutable after init (e.g., a private `let` captured during initialization and never mutated).
* **Use for protocol ergonomics.** Mark conformances for `Equatable`, `Hashable`, `CustomStringConvertible`, etc., as `nonisolated` when they rely only on immutable identity.
* **Document guarantees.** If a member is `nonisolated` because it’s logically pure, say so in doc comments (helps reviewers maintain the invariant).
* **Measure when optimizing.** The “no hop” benefit is real on hot paths, but premature use can tempt unsafe designs.

---

## Performance Considerations

* **No executor hop = fewer context switches.**
  `nonisolated` avoids suspension and executor switching, which can reduce latency in synchronous call chains—especially important on hot UI or service endpoints.
* **Still synchronous.**
  There’s no implicit parallelism. If the body is heavy, you’re still doing that work inline on the caller’s thread/executor.
* **Beware false sharing.**
  Don’t turn a mutable, frequently changing value into a `nonisolated` computed property. Even if you *could* make it compile, the call sites may observe inconsistent snapshots.

---

## Additional Examples

### Protocol requirement declared `nonisolated`

You can declare a protocol API to be nonisolated so conforming actors provide hop-free implementations:

```swift
protocol Identity {
    nonisolated var id: UUID { get }
}

actor Account: Identity {
    private let _id = UUID()

    nonisolated var id: UUID { _id } // ✅ based on immutable state
}
```

### Nonisolated subscript

```swift
actor Words {
    private let dictionary: Set<String>

    init(_ words: [String]) { dictionary = Set(words) }

    nonisolated subscript(candidate: String) -> Bool {
        candidate.allSatisfy(\.isLetter) // ✅ no actor state
    }
}
```

### Mixing `nonisolated` with async members

```swift
actor Repository {
    private var items: [String] = []

    func add(_ s: String) { items.append(s) }   // isolated
    func all() -> [String] { items }            // isolated

    nonisolated func isValidKey(_ s: String) -> Bool { // pure validation
        !s.isEmpty && s.allSatisfy(\.isLetter)
    }
}
```

---

## Summary

* **What:** `nonisolated` marks members as **not actor-isolated**, allowing sync, hop-free calls from anywhere.
* **Why:** Improve ergonomics and performance for pure utilities, protocol conformances, and stable metadata.
* **How:** Ensure the member does **not** access actor-isolated (or global-actor) state—design with immutability/purity.
* **Compare:**

  * `nonisolated` — safe, compiler-checked.
  * `nonisolated(unsafe)` — escape hatch; can read isolated state but forfeits safety.
  * `isolated` — parameter modifier to *establish* isolation inside a function.
* **Practice:** Use sparingly, document invariants, avoid mutable dependencies, and measure benefits.

Used thoughtfully, `nonisolated` gives you the best of both worlds: Swift’s strong isolation guarantees *and* crisp, zero-hop APIs where they count.
