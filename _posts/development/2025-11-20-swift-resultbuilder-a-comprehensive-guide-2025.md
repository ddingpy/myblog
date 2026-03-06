---
title: "Swift Result Builder: A Comprehensive Guide (2025)"
date: 2025-11-20 12:00:00 +0900
tags: [swift, resultbuilder, dsl, swiftui]
---


> A practical, copy‑pasteable handbook to designing, implementing, and using result builders to create expressive DSLs.

---

## 0) TL;DR

* `@resultBuilder` lets you **turn a multi‑statement closure into a single value** at compile time.
* You write a builder type (struct/enum/class) with static `build…` methods. The compiler rewrites statements (`if`, loops, etc.) into calls to those methods.
* Common methods: `buildBlock` *or* `buildPartialBlock(first:/accumulated:next:)`, plus `buildExpression`, `buildEither`, `buildIf`/**`buildOptional`**, `buildArray`, `buildLimitedAvailability`, and optionally `buildFinalResult`.
* Use it to build **SwiftUI‑style APIs** for HTML, SQL, Auto Layout, navigation graphs, app menus, regexes, charts…
* Keep builders small and composable to avoid type‑checking slow‑downs.

---

## 1) What is a result builder?

A **result builder** is a type annotated with `@resultBuilder`. When used to decorate a function/var/subscript parameter or return value, Swift rewrites the closure’s statements into calls on your builder’s static methods, producing one final value.

**High‑level mental model**

* Each statement in the closure becomes a **component**.
* Control flow (`if/else`, loops) becomes **calls to specific builder methods**.
* The builder then **combines** those components into a **final result**.

> The transformation happens at compile time; there’s no runtime reflection or magic.

---

## 2) Where can I use `@resultBuilder`?

You can attach a result builder to:

* **Function/initializer parameters**
* **Computed properties**
* **Subscripts**

```swift
@resultBuilder
enum StringListBuilder {
    static func buildExpression(_ expr: String) -> [String] { [expr] }
    static func buildBlock(_ parts: [String]...) -> [String] { parts.flatMap { $0 } }
}

func makeCSV(@StringListBuilder _ content: () -> [String]) -> String {
    content().joined(separator: ",")
}

let csv = makeCSV {
    "apples"
    "bananas"
    "cherries"
}
// → "apples,bananas,cherries"
```

You can also return builder‑decorated content from computed properties:

```swift
struct Page {
    @StringListBuilder var keywords: [String] {
        "swift"; "result builders"; "dsl"
    }
}
```

---

## 3) The builder methods — a quick reference

> You don’t need *all* of these. Implement only what your DSL needs.

```text
Statements in your closure    →    Methods you implement
───────────────────────────         ──────────────────────────────
A sequence of statements           → buildBlock(_:)   (or buildPartialBlock)
Single `if` (no else)              → buildIf(_:) or buildOptional(_:)  // either spelling works
`if` / `if-else` / `switch`        → buildEither(first:) / buildEither(second:)
`for` loops / multiple elements    → buildArray(_:)   // receives [Component]
#available checks                  → buildLimitedAvailability(_:)
Coerce per-statement values        → buildExpression(_:)  // e.g. Int → [Int]
Convert final component type       → buildFinalResult(_:) // optional
Modern, scalable statement chain   → buildPartialBlock(first:) + buildPartialBlock(accumulated:next:)
```

### Minimal “just works” set

For many builders:

1. `buildExpression(_:)` → wraps a single element into your component type.
2. `buildBlock(_:)` **or** the two `buildPartialBlock` methods → concatenates components.
3. Optionally add `buildEither` / `buildIf` and `buildArray` to support `if` and `for`.

---

## 4) Classic vs modern concatenation

Historically, builders used **`buildBlock(_:)`** with several overloads or a variadic parameter:

```swift
static func buildBlock(_ parts: [Node]...) -> [Node] { parts.flatMap { $0 } }
```

Modern builders prefer **`buildPartialBlock(first:)`** and **`buildPartialBlock(accumulated:next:)`**, which scale better with many statements and produce clearer type errors:

```swift
static func buildPartialBlock(first: [Node]) -> [Node] { first }
static func buildPartialBlock(accumulated: [Node], next: [Node]) -> [Node] { accumulated + next }
```

> You can provide either approach; many Apple builders ship with `buildPartialBlock` now.

---

## 5) Worked example: a tiny HTML DSL

Let’s build tags and text nodes and render them to a `String`:

```swift
struct Node { let raw: String }
extension Node { static func text(_ s: String) -> Node { .init(raw: s) } }

@resultBuilder
enum HTMLBuilder {
    static func buildExpression(_ n: Node) -> [Node] { [n] }

    // Allow string literals directly
    static func buildExpression(_ s: String) -> [Node] { [ .text(s) ] }

    // Concatenate statements
    static func buildPartialBlock(first: [Node]) -> [Node] { first }
    static func buildPartialBlock(accumulated: [Node], next: [Node]) -> [Node] { accumulated + next }

    // Conditionals & loops
    static func buildEither(first c: [Node]) -> [Node] { c }
    static func buildEither(second c: [Node]) -> [Node] { c }
    static func buildIf(_ c: [Node]?) -> [Node] { c ?? [] }
    static func buildArray(_ batches: [[Node]]) -> [Node] { batches.flatMap { $0 } }
}

struct Tag {
    let name: String
    @HTMLBuilder var children: [Node]

    init(_ name: String, @HTMLBuilder @autoclosure children: () -> [Node]) { // autoclosure optional
        self.name = name
        self.children = children()
    }

    func render() -> String {
        "<\(name)>\(children.map(\.raw).joined())</\(name)>"
    }
}

func div(@HTMLBuilder _ content: () -> [Node]) -> Node { .init(raw: Tag("div", children: content()).render()) }
func span(_ text: String) -> Node { .init(raw: "<span>\(text)</span>") }

// Usage
let isAdmin = true
let items = ["Home", "Docs", "Pricing"]
let page = Tag("section", children: {
    div {
        "Welcome "
        if isAdmin { span("(Admin)") }
    }
    for item in items { span(item) }
})

print(page.render())
// <section><div>Welcome <span>(Admin)</span></div><span>Home</span><span>Docs</span><span>Pricing</span></section>
```

**Notes**

* `buildExpression` lets us accept **both** `Node` **and** `String` as statements.
* `buildIf` enables single‑branch `if` without `else`.
* `buildArray` powers `for` loops by flattening an `[[Node]]`.

---

## 6) Worked example: Auto Layout constraint builder (UIKit)

A result builder can clean up a list of optional constraints:

```swift
@resultBuilder
enum ConstraintBuilder {
    static func buildExpression(_ c: NSLayoutConstraint) -> [NSLayoutConstraint] { [c] }
    static func buildBlock(_ parts: [NSLayoutConstraint]...) -> [NSLayoutConstraint] { parts.flatMap { $0 } }
    static func buildEither(first c: [NSLayoutConstraint]) -> [NSLayoutConstraint] { c }
    static func buildEither(second c: [NSLayoutConstraint]) -> [NSLayoutConstraint] { c }
    static func buildOptional(_ c: [NSLayoutConstraint]?) -> [NSLayoutConstraint] { c ?? [] }
    static func buildArray(_ batches: [[NSLayoutConstraint]]) -> [NSLayoutConstraint] { batches.flatMap { $0 } }
}

func constraints(@ConstraintBuilder _ content: () -> [NSLayoutConstraint]) -> [NSLayoutConstraint] { content() }

// Usage
let alignTop = true
let cs = constraints {
    view.leadingAnchor.constraint(equalTo: container.leadingAnchor)
    view.trailingAnchor.constraint(equalTo: container.trailingAnchor)
    if alignTop {
        view.topAnchor.constraint(equalTo: container.topAnchor)
    }
}
NSLayoutConstraint.activate(cs)
```

---

## 7) Worked example: Query builder → SQL string

Showcases `buildFinalResult` to convert an array of clauses into a string:

```swift
@resultBuilder
enum SQLBuilder {
    typealias Component = [String]

    static func buildExpression(_ s: String) -> Component { [s] }
    static func buildPartialBlock(first: Component) -> Component { first }
    static func buildPartialBlock(accumulated: Component, next: Component) -> Component { accumulated + next }
    static func buildArray(_ chunks: [Component]) -> Component { chunks.flatMap { $0 } }
    static func buildEither(first c: Component) -> Component { c }
    static func buildEither(second c: Component) -> Component { c }

    // Final conversion to your API’s “real” type
    static func buildFinalResult(_ component: Component) -> String {
        component.joined(separator: " ")
    }
}

func SELECT(@SQLBuilder _ content: () -> String) -> String { content() }

let adults = SELECT {
    "SELECT name, age"
    "FROM users"
    "WHERE age >= 18"
}
// → "SELECT name, age FROM users WHERE age >= 18"
```

---

## 8) Control flow mapping (with code)

### `if` / `else`

```swift
static func buildEither<T, F>(first: T) -> Either<T, F> { .left(T) }
static func buildEither<T, F>(second: F) -> Either<T, F> { .right(F) }
// Also provide buildIf(_:) *or* buildOptional(_:) for single-branch `if`.
```

### Loops (`for`)

```swift
static func buildArray(_ components: [[Component]]) -> [Component] { components.flatMap { $0 } }
```

### Availability (`if #available`)

```swift
static func buildLimitedAvailability(_ component: Component) -> Component { component }
```

> You don’t call these yourself; the compiler lowers each construct to the appropriate method calls.

---

## 9) API design patterns

* **Slot‑based containers**: Accept multiple builder closures (`header`, `content`, `footer`).
* **Composable decorators**: Return a builder from extensions to conditionally apply transformations.
* **Typed DSLs**: Use generics to preserve static guarantees (e.g., valid HTML nesting, SQL injection‑safe literals).
* **Erased DSLs**: If you must mix heterogeneous types, provide overloads of `buildExpression` or (sparingly) type‑erase in `buildFinalResult`.

---

## 10) Advanced techniques

* **Overload `buildExpression`** to accept rich statements: allow `Int`, domain types, or even closures that you invoke lazily.
* **`@autoclosure`** parameters: You can accept autoclosures in initializers/functions that forward into builder‑decorated storage.
* **`@escaping` builders**: If you store the closure for later, mark the parameter `@escaping` and consider capture lists to avoid cycles.
* **Custom `Component` type**: Define a lightweight internal component (e.g., `enum Clause { case select(String) ... }`) and convert in `buildFinalResult`.
* **Partial vs final result**: `buildPartialBlock` can use a different **accumulator type** from your final result; `buildFinalResult` maps it.
* **Testing DSLs**: Make final results equatable (e.g., arrays/structs) so you can snapshot or assert on structure.

---

## 11) Interop notes with SwiftUI

SwiftUI’s `@ViewBuilder` is “just” a result builder specialized for views. You’ll see methods like `buildIf(_:)`, `buildEither`, `buildArray`, and `buildLimitedAvailability(_:)` to support `if`, `switch`, loops, and availability checks. Many Apple frameworks now ship builders using `buildPartialBlock` instead of large `buildBlock` overload sets.

---

## 12) Pitfalls & best practices

* **Prefer `buildPartialBlock`** for long lists of statements; it scales and yields better errors.
* **Avoid heavy work inside the closure**—precompute outside and pass the result in; keep the builder focused on *structure*, not computation.
* **Stability of identity**: If your DSL represents stateful elements (like UI views), be mindful of how conditional branches change structure.
* **Explicit `return`** inside builder closures can change how type inference happens. Stick to plain statements where possible for the most ergonomic diagnostics.
* **Compilation time**: Deeply nested, generic builders can slow type‑checking. Extract helpers, split blocks, or simplify generic interactions.

---

## 13) Recipe box (more ideas to try)

* **Menu builder** that composes `UIMenu`/`CommandMenu` items conditionally.
* **Navigation graph builder** emitting a typed graph structure, then a router from it.
* **Markdown builder** turning nested elements into a string or attributed text.
* **Regex builder** (simplified) producing `Regex` or NSRegularExpression with guarantees.
* **Feature‑flagged layout**: one DSL that composes SwiftUI or UIKit depending on platform via availability.

---

## 14) Reference template — start here

Copy, rename, and adapt to your domain:

```swift
@resultBuilder
public enum Builder<Component> {
    public static func buildExpression(_ expr: Component) -> [Component] { [expr] }
    public static func buildPartialBlock(first: [Component]) -> [Component] { first }
    public static func buildPartialBlock(accumulated: [Component], next: [Component]) -> [Component] { accumulated + next }
    public static func buildEither(first c: [Component]) -> [Component] { c }
    public static func buildEither(second c: [Component]) -> [Component] { c }
    public static func buildIf(_ c: [Component]?) -> [Component] { c ?? [] }
    public static func buildArray(_ batches: [[Component]]) -> [Component] { batches.flatMap { $0 } }
    public static func buildLimitedAvailability(_ c: [Component]) -> [Component] { c }
    // Optional: map accumulator → real API type
    public static func buildFinalResult(_ c: [Component]) -> [Component] { c }
}
```

---

## 15) FAQ

**Q: `buildIf` or `buildOptional`?**
Either works; choose one spelling and be consistent. Many Apple builders ship `buildIf`, while older examples show `buildOptional`.

**Q: Do I still need `buildBlock`?**
No. Prefer the two `buildPartialBlock` methods unless you need backward compatibility with very old toolchains.

**Q: Can a builder’s component type differ from the final result?**
Yes; use `buildFinalResult` for the conversion.

**Q: How do `switch` statements work?**
The compiler lowers them to a series of `buildEither(first:)`/`buildEither(second:)` calls.

**Q: Are result builders runtime‑expensive?**
No; they’re a **compile‑time rewrite**. Any overhead comes from the code you write and from compile‑time type‑checking, not from the builder mechanism itself.

---

### Closing thought

Result builders are a lightweight way to make **domain code read like the domain**. Start with a tiny builder that only supports statements you need, then add conditionals, loops, and conversions as the DSL grows.
