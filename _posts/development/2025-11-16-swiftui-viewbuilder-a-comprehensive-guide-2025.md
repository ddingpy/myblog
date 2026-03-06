---
title: "SwiftUI ViewBuilder: A Comprehensive Guide (2025)"
date: 2025-11-16 12:00:00 +0900
tags: [swiftui, viewbuilder, swift, ios]
---


> Learn the mental model, API surface, best practices, and pitfalls of `@ViewBuilder` with many copy‑pasteable examples.

---

## TL;DR

* `@ViewBuilder` is SwiftUI’s **result builder** for producing `View` hierarchies from declarative, multi‑statement closures.
* Use it to author container views (e.g., `VStack`), slot/slotless APIs, and reuse complex conditional UI **without explicit wrappers** like `Group`.
* It supports **`if` / `if‑else`**, availability checks, and optional branches. Use **`ForEach`** for iteration (instead of `for` loops).
* Prefer generic `Content: View` over `AnyView`. Reach for `AnyView` only to erase type in rare cases (e.g., heterogeneous return without a builder).
* Watch for compile‑time blowups with very large builders; split into private helpers or use `Group` / container views.

---

## 1) The mental model

`@ViewBuilder` is a specialized **result builder** (a Swift language feature) that turns a closure with multiple statements (and control flow) into a single `View` value.

Under the hood, Swift rewrites a block like:

```swift
@ViewBuilder var content: some View {
    Text("Title")
    Text("Subtitle")
}
```

into calls to `ViewBuilder.buildBlock`, `buildEither`, `buildOptional`, etc., producing a single view (often a `TupleView` or a container) that SwiftUI can render.

Why it’s useful:

* Write **natural, multi‑line** view code without wrapping every set of siblings in `Group`/`VStack`.
* Make **reusable containers** that accept child content (slots) like `content`, `header`, `footer`.

> Tip: `@ViewBuilder` doesn’t render anything by itself. It **only** assembles views produced by the closure.

---

## 2) Where you can use `@ViewBuilder`

### a) On closure parameters (most common)

```swift
struct Card<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.headline)
            content
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// Usage
Card("Overview") {
    Text("CPU: A18")
    Text("RAM: 12 GB")
}
```

### b) On computed properties / helper functions

```swift
struct DetailView: View {
    let isPro: Bool

    @ViewBuilder var statusBadge: some View {
        if isPro {
            Label("Pro", systemImage: "star.fill")
        } else {
            Label("Basic", systemImage: "star")
        }
    }

    var body: some View {
        HStack { Text("Plan"); Spacer(); statusBadge }
            .padding()
    }
}
```

> Annotating a property or function with `@ViewBuilder` lets you return different concrete `View` types from branches **without** type‑erasing to `AnyView`.

### c) On multiple slot parameters

```swift
struct ListRow<Leading: View, Trailing: View, Content: View>: View {
    @ViewBuilder var leading: () -> Leading
    @ViewBuilder var trailing: () -> Trailing
    @ViewBuilder var content: () -> Content

    init(
        @ViewBuilder leading: @escaping () -> Leading = { EmptyView() },
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() },
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.leading = leading
        self.trailing = trailing
        self.content = content
    }

    var body: some View {
        HStack(spacing: 12) {
            leading()
            content()
            Spacer(minLength: 0)
            trailing()
        }
        .padding(.vertical, 8)
    }
}

// Usage
ListRow {
    Text("AirPods Pro")
} leading: {
    Image(systemName: "earbuds")
} trailing: {
    Label("Connected", systemImage: "checkmark.circle.fill")
}
```

---

## 3) Control flow inside a view builder

`ViewBuilder` supports common control flow building blocks:

### `if` / `if-else`

```swift
@ViewBuilder func Banner(kind: BannerKind) -> some View {
    if kind == .success {
        Label("Saved", systemImage: "checkmark.circle.fill")
            .foregroundStyle(.green)
    } else if kind == .warning {
        Label("Careful", systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.yellow)
    } else {
        Label("Error", systemImage: "xmark.octagon.fill")
            .foregroundStyle(.red)
    }
}
```

### Optional `if` (no `else`)

```swift
@ViewBuilder var debugBadge: some View {
    if _isDebugAssertConfiguration() {
        Text("DEBUG").padding(4).background(.pink.opacity(0.2)).clipShape(.capsule)
    }
}
```

### Availability checks

```swift
@ViewBuilder var modernToggle: some View {
    if #available(iOS 17, *) {
        Toggle("Haptics", isOn: .constant(true)).toggleStyle(.button)
    } else {
        Toggle("Haptics", isOn: .constant(true))
    }
}
```

### Iteration

Use **`ForEach`** for collections. Traditional `for` loops aren’t supported by `ViewBuilder`.

```swift
struct Chips: View {
    let tags: [String]
    var body: some View {
        HStack { // still a builder context
            ForEach(tags, id: \.self) { tag in
                Text(tag)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.thinMaterial)
                    .clipShape(Capsule())
            }
        }
    }
}
```

> Why `ForEach`? It lets SwiftUI track identity and diff efficiently. A plain `for` loop would build different concrete types across iterations which `ViewBuilder` doesn’t model.

---

## 4) The “siblings” limit and how to structure content

A `ViewBuilder` block can’t contain arbitrarily many **direct** child views. Historically it supports up to **10** direct siblings. If you hit this, compose with containers:

```swift
@ViewBuilder var longList: some View {
    Group {
        Text("One"); Text("Two"); Text("Three"); Text("Four"); Text("Five")
    }
    Group {
        Text("Six"); Text("Seven"); Text("Eight"); Text("Nine"); Text("Ten")
    }
}
```

**Alternatives**

* Wrap in a layout container (`VStack`, `HStack`, `Grid`, `List`) which itself is a single child to the builder.
* Break into smaller `@ViewBuilder` helpers.

> `Group` is layout‑neutral; it doesn’t stack or space by itself. It simply groups children so modifiers can be applied together.

---

## 5) `@ViewBuilder` vs `some View` vs `AnyView`

* **`some View`**: an **opaque return type**. A function/property returning `some View` must always produce **one concrete type** across all branches *unless* you also use `@ViewBuilder` to allow heterogeneous branches.
* **`@ViewBuilder`**: lets you write **multiple statements and heterogeneous branches** and still yield a single `View`.
* **`AnyView`**: type‑erased wrapper. Useful when you can’t use a builder but need to hide concrete types. Avoid in performance‑critical paths.

**Example: conditional without a builder (needs `AnyView`)**

```swift
func status(noBuilder isActive: Bool) -> some View {
    if isActive { return AnyView(Text("On").foregroundStyle(.green)) }
    else { return AnyView(Text("Off").foregroundStyle(.red)) }
}
```

**Same logic with `@ViewBuilder` (no type erasure)**

```swift
@ViewBuilder func status(isActive: Bool) -> some View {
    if isActive { Text("On").foregroundStyle(.green) }
    else { Text("Off").foregroundStyle(.red) }
}
```

---

## 6) Designing APIs with slots (multiple builders)

Create ergonomic components by accepting multiple builder closures for different regions.

```swift
struct FormSection<Header: View, Content: View, Footer: View>: View {
    let header: Header
    let content: Content
    let footer: Footer

    init(
        @ViewBuilder header: () -> Header,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.header = header()
        self.content = content()
        self.footer = footer()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            VStack(alignment: .leading, spacing: 12) { content }
                .padding().background(.thinMaterial).clipShape(.rect(cornerRadius: 12))
            footer.font(.footnote).foregroundStyle(.secondary)
        }
    }
}

// Usage
FormSection {
    Text("Notifications").font(.title3.bold())
} content: {
    Toggle("Marketing", isOn: .constant(false))
    Toggle("Product updates", isOn: .constant(true))
} footer: {
    Text("You can change this anytime in Settings → Privacy.")
}
```

**Escaping builders**
If you need to **store** a builder for later (e.g., virtualized lists), mark it `@escaping`:

```swift
init(@ViewBuilder content: @escaping () -> Content) { self.content = content }
```

---

## 7) Conditional modifiers via builders

Sometimes the *modifier* is what changes. A small helper avoids `if` pyramids:

```swift
extension View {
    @ViewBuilder func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition { transform(self) } else { self }
    }
}

Text("Hello")
    .if(isHighlighted) { $0.bold().foregroundStyle(.blue) }
```

> This works because the extension itself returns a `@ViewBuilder` result, enabling different concrete types.

---

## 8) Extracting complex branches into helpers

Large `if`/`else` branches hurt readability and compile times. Move them into separate `@ViewBuilder` helpers:

```swift
@ViewBuilder func emptyState(retry: @escaping () -> Void) -> some View {
    ContentUnavailableView("No Data", systemImage: "tray") {
        Button("Retry", action: retry)
    }
}

@ViewBuilder func loadedState(items: [Item]) -> some View {
    List(items) { item in Text(item.title) }
}

var body: some View {
    switch vm.state {
    case .empty: emptyState { vm.reload() }
    case .loaded(let items): loadedState(items: items)
    case .error(let message): Text(message)
    }
}
```

---

## 9) Working with `Group`

`Group` is layout‑neutral but *modifier‑friendly*:

```swift
Group {
    Text("Title")
    Text("Subtitle")
}
.font(.title3) // applies to both
```

Use it to:

* Apply a modifier to multiple siblings.
* Bypass the 10‑sibling limit by splitting children across groups.
* Hide/Show clusters with a single conditional.

---

## 10) Common patterns and recipes

### A) Two‑pane adaptive layout

```swift
struct TwoPane<Sidebar: View, Detail: View>: View {
    @Environment(\.horizontalSizeClass) private var hSize
    let sidebar: Sidebar
    let detail: Detail

    init(@ViewBuilder sidebar: () -> Sidebar, @ViewBuilder detail: () -> Detail) {
        self.sidebar = sidebar()
        self.detail = detail()
    }

    var body: some View {
        if hSize == .regular {
            NavigationSplitView { sidebar } detail: { detail }
        } else {
            NavigationStack { sidebar }
        }
    }
}

// Usage
TwoPane {
    List { Text("A"); Text("B") }
} detail: {
    Text("Select an item")
}
```

### B) Card with optional header/footer slots

```swift
struct Card2<Header: View, Content: View, Footer: View>: View {
    let header: Header?
    let content: Content
    let footer: Footer?

    init(
        @ViewBuilder header: () -> Header? = { nil },
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer? = { nil }
    ) {
        self.header = header()
        self.content = content()
        self.footer = footer()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let header { header }
            content
            if let footer { footer }
        }
        .padding().background(.thinMaterial).clipShape(.rect(cornerRadius: 16))
    }
}
```

### C) List row with conditional accessories

```swift
struct AccessoryRow<Content: View>: View {
    let content: Content
    let accessory: AnyView?

    init(@ViewBuilder content: () -> Content, accessory: AnyView? = nil) {
        self.content = content()
        self.accessory = accessory
    }

    var body: some View {
        HStack { content; Spacer(); accessory }
    }
}

// Usage with builder for the accessory, type‑erased to keep API simple
AccessoryRow {
    Text("Auto‑Refresh")
} accessory: {
    AnyView(Toggle(isOn: .constant(true)) { EmptyView() })
}
```

### D) Builder helpers for reusable decorations

```swift
extension View {
    @ViewBuilder func cardStyle() -> some View {
        self
            .padding(12)
            .background(.background, in: RoundedRectangle(cornerRadius: 12))
            .shadow(radius: 1)
    }
}

VStack(alignment: .leading, spacing: 8) {
    Text("Stats").font(.headline)
    Text("Last sync: 2m ago")
}
.cardStyle()
```

---

## 11) Pitfalls & gotchas

* **Iteration**: Use `ForEach`. Plain `for` loops aren’t supported inside `ViewBuilder`.
* **Sibling limit**: You can’t have unbounded direct children. Group or containerize.
* **Heavy logic**: Don’t perform expensive work inside builders; precompute outside or in your view model.
* **Type explosion / long compile times**: Deeply nested builders with many generics can slow builds. Extract helpers or type‑erase selectively.
* **Capturing `self`**: If you mark builders `@escaping`, be mindful of capture lists to avoid retain cycles.
* **Stateful children**: When conditionally inserting/removing stateful views, identities change. Stabilize identity with `id(_:)` or keep structure stable and toggle visibility.

---

## 12) Testing & previews

```swift
struct Card_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            Card("Overview") {
                Text("CPU: A18"); Text("RAM: 12 GB")
            }
            .previewDisplayName("Basic")

            Card2 {
                Text("iCloud Drive")
            } footer: {
                Text("1.2 GB used")
            }
            .previewDisplayName("With footer")
        }
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
```

---

## 13) FAQ

**Q: Do I ever need `@ViewBuilder` in `var body: some View`?**
No. `body` already behaves like a builder context—you can write multiple statements inside containers like `VStack`. Use `@ViewBuilder` on helpers/parameters instead.

**Q: Can I use `switch`?**
You can, as long as every case returns view content consistently. Many developers prefer `if`/`else` with enums for readability.

**Q: Why does adding an `if` remove my state?**
You likely changed the subtree identity. SwiftUI treats different branches as different view types. Keep shapes consistent or give stable identities.

**Q: I hit the 10‑child limit—now what?**
Use `Group`, `VStack`, or split into smaller builder helpers.

**Q: When should I use `AnyView`?**
Only when you must erase type (e.g., storing heterogeneous views in an array) and can’t use a builder.

---

## 14) A tiny “from scratch” container example

```swift
struct Toolbar<Leading: View, Title: View, Trailing: View>: View {
    let leading: Leading
    let title: Title
    let trailing: Trailing

    init(
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder title: () -> Title,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.leading = leading()
        self.title = title()
        self.trailing = trailing()
    }

    var body: some View {
        HStack {
            leading
            Spacer()
            title
            Spacer()
            trailing
        }
        .padding(.horizontal)
        .frame(height: 44)
    }
}

// Usage
Toolbar {
    Button(action: {}) { Image(systemName: "line.3.horizontal") }
} title: {
    Text("Inbox").font(.headline)
} trailing: {
    HStack(spacing: 10) {
        Button(action: {}) { Image(systemName: "magnifyingglass") }
        Button(action: {}) { Image(systemName: "plus") }
    }
}
```

---

## 15) Checklist (when authoring with `@ViewBuilder`)

* [ ] Is this closure a good **slot**? (content, header, footer, accessory)
* [ ] Do I need **multiple statements** or **heterogeneous branches**?
* [ ] Would `ForEach` better express iteration/identity?
* [ ] Am I avoiding the **10‑child** sibling limit (via `Group`/containers)?
* [ ] Are heavy computations kept **outside** the builder?
* [ ] Do I need `@escaping` for stored closures?

---

## 16) Further exploration (ideas to practice)

* Convert an existing custom control to accept slots for `label`, `icon`, `accessory`.
* Replace `AnyView` returns in your codebase with builder‑based helpers.
* Extract big `body` branches into small `@ViewBuilder` functions and measure compile times.
* Build “conditional modifiers” utilities using builder‑returning extensions.

---

### Final note

`@ViewBuilder` is a thin, elegant layer that lets your APIs feel **SwiftUI‑native**. Use it to make *composition* your default design tool and keep type erasure as a last resort.
