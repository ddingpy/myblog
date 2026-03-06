---
title: "Swift Macros in 2025: A Practical Guide"
date: 2025-11-15 12:00:00 +0900
tags: [swift, macros, metaprogramming, xcode]
---


> Updated for **Swift 6.2** (released Sep 15, 2025). If you’re on Swift 5.9+ the fundamentals are the same; Swift 6.x added polish and tooling, not a new macro model. ([Swift.org][1])

---

## Table of contents

* [1. What are macros & why Swift added them](#1-what-are-macros--why-swift-added-them)
* [2. Macro kinds (freestanding vs. attached)](#2-macro-kinds-freestanding-vs-attached)
* [3. Defining & registering macros](#3-defining--registering-macros)
* [4. Common use-cases](#4-common-use-cases)
* [5. Step-by-step: build two macros](#5-step-by-step-build-two-macros)

  * [5.1 `#stringify` (freestanding)](#51-stringify-freestanding)
  * [5.2 `@AddDescription` (attached extension macro)](#52-adddescription-attached-extension-macro)
* [6. Debugging, testing & tooling](#6-debugging-testing--tooling)
* [7. Limitations & best practices](#7-limitations--best-practices)
* [8. Conclusion](#8-conclusion)
* [References & further reading](#references--further-reading)

---

## 1. What are macros & why Swift added them

**Macros generate Swift code at compile time.** The compiler expands macro calls into real Swift that’s type-checked like anything you write by hand. Macro expansion is *additive*—it can insert code, not delete or mutate your existing source—so you can reason about the result and keep tooling stable. ([Swift Documentation][2])

They sit next to language features like result builders or property wrappers: wrappers transform storage & access of one declaration; macros can generate *new* declarations, conformances, or expressions—reducing boilerplate while preserving clarity. ([Swift Documentation][2])

---

## 2. Macro kinds (freestanding vs. attached)

Swift defines **two families**: ([Swift Documentation][2])

* **Freestanding** macros appear by themselves and start with `#` (e.g. `#fileID`, `#warning`). They produce an expression, statement, or declaration right at the call site. ([Swift Documentation][2])
* **Attached** macros are attributes (e.g. `@Something`) applied to a declaration and can **add members**, **accessors**, **peers**, or **extensions** (with conformances). These are specified via roles in the macro declaration. ([GitHub][3])

### Syntax at a glance

```swift
// Freestanding
let path = #fileID   // standard library macro
#warning("This compiles, but double-check input") // emits a diagnostic

// Attached (examples you might see in Apple frameworks or libraries)
@Observable
final class Model { /* ... */ }    // expands into storage/observation plumbing

@SomeMacro
struct Foo { /* macro adds members or conformances */ }
```

Apple’s docs cover how freestanding calls insert code *at* the call site and how attached macros modify the *annotated* declaration. ([Apple Developer][4])

---

## 3. Defining & registering macros

**Authoring flow (SPM):**

1. Create a macro package:

```bash
swift package init --type macro
```

This scaffolds a macro implementation target, a library that exposes your macro declarations, and tests. ([Swift Documentation][5])

2. In the **declarations** target, you declare public macros and point them to their implementation with `#externalMacro(module:type:)`. ([Apple Developer][6])

```swift
@freestanding(expression)
public macro stringify<T>(_ value: T) -> (T, String) =
  #externalMacro(module: "ExampleMacros", type: "StringifyMacro")
```

3. In the **implementation** target you implement types that conform to macro protocols (e.g. `ExpressionMacro`, `MemberMacro`, `ExtensionMacro`) and register them in a compiler plugin:

```swift
import SwiftCompilerPlugin
@main
struct ExamplePlugin: CompilerPlugin {
  let providingMacros: [Macro.Type] = [StringifyMacro.self]
}
```

SPM exposes a dedicated **`.macro`** target kind and the `CompilerPluginSupport` helpers to link everything up. These targets are built for the **host** (e.g., macOS) and typically depend on SwiftSyntax/SwiftCompilerPlugin. ([GitHub][7])

> Tip: Your macro package often sets minimum platform versions for the **macro target** (host), e.g., `.macOS(.v13)`, even if your library is for iOS. This resolves common “external macro type could not be found” build errors. ([Stack Overflow][8])

---

## 4. Common use-cases

* **Boilerplate removal & codegen**
  Generate `CodingKeys`, `Equatable`/`Hashable` implementations, `@Observable` storage, `@AddCompletionHandler` peers, or whole extensions via the *extension* macro role. ([GitHub][9])

* **Compile-time validation**
  Validate URLs, regexes, bundle resources, etc., and emit diagnostics *at build time*. (Example: a `#URL("…")` macro that constructs `URL(...)!` after verifying the string.) ([Vodafone tech][10])

* **Diagnostics & logging aids**
  Macros can throw `MacroExpansionErrorMessage`, emit warnings/errors, and attach Fix-Its to guide users. ([Stack Overflow][11])

---

## 5. Step-by-step: build two macros

We’ll create a package with:

* **`#stringify`**: a freestanding expression macro returning `(value, "source code")`.
* **`@AddDescription`**: an *extension* macro that adds `CustomStringConvertible` conformance and a `description` computed property for a type’s stored properties.

### Package layout

`Package.swift` (abbreviated):

```swift
// swift-tools-version: 6.2
import PackageDescription
import CompilerPluginSupport

let package = Package(
  name: "MacroPlayground",
  platforms: [.macOS(.v13), .iOS(.v17)],            // host + client minimums
  products: [
    .library(name: "Macros", targets: ["Macros"]),  // declarations client imports
    .macro(name: "MacroImplementations", targets: ["MacroImplementations"])
  ],
  dependencies: [
    .package(url: "https://github.com/swiftlang/swift-syntax.git", from: "600.0.1")
  ],
  targets: [
    .target(name: "Macros", dependencies: ["MacroImplementations"]),
    .macro(
      name: "MacroImplementations",
      dependencies: [
        .product(name: "SwiftCompilerPlugin", package: "swift-syntax"),
        .product(name: "SwiftSyntax", package: "swift-syntax"),
        .product(name: "SwiftSyntaxBuilder", package: "swift-syntax"),
        .product(name: "SwiftSyntaxMacros", package: "swift-syntax")
      ]
    ),
    .testTarget(
      name: "MacroTests",
      dependencies: [
        "MacroImplementations",
        .product(name: "SwiftSyntaxMacrosTestSupport", package: "swift-syntax")
      ]
    )
  ]
)
```

> Notes: `.macro` is the SPM target for compiler plugins; SwiftSyntax is the API you use to read/emit syntax trees during expansion. ([GitHub][7])

---

### 5.1 `#stringify` (freestanding)

**Declaration** — `Sources/Macros/Stringify.swift`

```swift
@freestanding(expression)
public macro stringify<T>(_ value: T) -> (T, String) =
  #externalMacro(module: "MacroImplementations", type: "StringifyMacro")
```

**Implementation** — `Sources/MacroImplementations/StringifyMacro.swift`

```swift
import SwiftSyntax
import SwiftSyntaxBuilder
import SwiftSyntaxMacros

public struct StringifyMacro: ExpressionMacro {
  public static func expansion(
    of node: some FreestandingMacroExpansionSyntax,
    in context: some MacroExpansionContext
  ) -> ExprSyntax {
    guard let expr = node.argumentList.first?.expression else {
      context.diagnose(Diagnostic(node: Syntax(node),
        message: SimpleError("`#stringify` needs exactly one expression")))
      return "(\(literal: ""), \(literal: ""))"
    }
    // Build: ( <expr>, "<source>" )
    return "(\(expr), \(literal: expr.description))"
  }
}

// A tiny helper for diagnostics
struct SimpleError: Error, DiagnosticMessage {
  let message: String
  var diagnosticID: MessageID { .init(domain: "MacroPlayground", id: "stringify") }
  var severity: DiagnosticSeverity { .error }
}
```

**Use it** — in any client module that imports `Macros`:

```swift
import Macros

let (value, source) = #stringify(2 + 3)
// value == 5, source == "2 + 3"
```

The `#externalMacro` hook names the module and type the compiler should invoke for expansion. ([Apple Developer][6])

---

### 5.2 `@AddDescription` (attached extension macro)

**Declaration** — `Sources/Macros/AddDescription.swift`

```swift
@attached(
  extension,
  conformances: CustomStringConvertible,
  names: named(description)
)
public macro AddDescription() =
  #externalMacro(module: "MacroImplementations", type: "AddDescriptionMacro")
```

**Implementation** — `Sources/MacroImplementations/AddDescriptionMacro.swift`

```swift
import SwiftSyntax
import SwiftSyntaxBuilder
import SwiftSyntaxMacros

public struct AddDescriptionMacro: ExtensionMacro {
  public static func expansion(
    of node: AttributeSyntax,
    attachedTo declaration: some DeclGroupSyntax,
    providingExtensionsOf type: some TypeSyntaxProtocol,
    conformingTo protocols: [TypeSyntax],
    in context: some MacroExpansionContext
  ) throws -> [ExtensionDeclSyntax] {

    // Support classes & structs
    guard let decl = declaration.as(StructDeclSyntax.self) ??
                     declaration.as(ClassDeclSyntax.self) else {
      context.diagnose(
        Diagnostic(node: Syntax(declaration),
        message: SimpleError("@AddDescription works on structs/classes only"))
      )
      return []
    }

    // Collect stored property identifiers
    let names = decl.memberBlock.members
      .compactMap { $0.decl.as(VariableDeclSyntax.self) }
      .filter { $0.bindings.allSatisfy { $0.accessorBlock == nil } } // stored only
      .compactMap { $0.bindings.first?.pattern.as(IdentifierPatternSyntax.self)?.identifier.text }

    // "TypeName(a: \(a), b: \(b))"
    let pairs = names.map { "\\(\($0)): \\(\(raw: $0))" }.joined(separator: ", ")
    let typeName = type.trimmed

    let ext: DeclSyntax = """
    extension \(typeName): CustomStringConvertible {
      public var description: String {
        "\(typeName)(\(raw: pairs))"
      }
    }
    """
    return [ext.cast(ExtensionDeclSyntax.self)!]
  }
}

struct SimpleError: Error, DiagnosticMessage {
  let message: String
  var diagnosticID: MessageID { .init(domain: "MacroPlayground", id: "adddescription") }
  var severity: DiagnosticSeverity { .error }
}
```

**Use it** — in client code:

```swift
import Macros

@AddDescription
struct User {
  let id: Int
  let name: String
}

print(User(id: 1, name: "Ryan"))
// → User(id: 1, name: Ryan)
```

Attached macro roles and the `names:`/`conformances:` requirements are specified in the Swift book and proposals; `extension` macros come from SE-0402. ([Swift Documentation][12])

---

## 6. Debugging, testing & tooling

* **See the expanded code in Xcode**
  Place the caret on a macro use and choose **Editor → Expand Macro** to inline the generated code (undo to revert). Great for understanding and setting breakpoints in generated code. ([Apple Developer][4])
* **CLI & vision docs**
  The macro vision notes a `-Xfrontend -dump-macro-expansions`-style capability; availability can vary by toolchain. Prefer Xcode’s “Expand Macro” for stable flows. ([Gist][13])
* **Unit test your macros**
  Use `SwiftSyntaxMacrosTestSupport.assertMacroExpansion` or community tools like **pointfreeco/swift-macro-testing** for snapshot-style assertions of expansion & diagnostics. ([SwiftLee][14])
* **Diagnostics**
  Emit structured diagnostics (`MacroExpansionErrorMessage`, warnings, Fix-Its) from within expansion to guide users at compile time. ([Stack Overflow][11])
* **Build trust prompts & CI**
  Xcode requires trusting third-party macro packages (including on Xcode Cloud/CI). Pin platforms for the macro target and ensure the CI host OS matches your macro’s host minimum. ([Stack Overflow][15])

---

## 7. Limitations & best practices

* **Additive only**: macros *insert* code; they don’t mutate existing user code in place. That keeps macro use auditable and tool-friendly. ([Swift Documentation][2])
* **No function-body rewriting in stable Swift**: proposals for *function body macros* (SE-0415) were returned for revision—avoid designs that depend on rewriting existing bodies. Prefer generating peers/extensions. ([Swift Forums][16])
* **Declare what you generate**: attached macro roles often require `names:` to list generated symbols; `extension` macros must declare any conformances. This helps the compiler and IDEs stay accurate. ([Swift Documentation][12])
* **Mind host vs. target**: macro implementations build for the *host* platform (e.g., macOS). Keep your macro target’s platform settings consistent with your CI machines. ([Swift Forums][17])
* **Emit precise diagnostics**: fail early with friendly messages; prefer compile-time validation over runtime traps. ([Stack Overflow][11])
* **Keep expansions small & predictable**: readability wins. If a macro would output pages of code, consider a generator step or a library API instead.

---

## 8. Conclusion

Swift macros let you remove repetition, encode conventions, and shift many mistakes from **runtime** to **compile time**—all while staying within Swift’s type system and tooling. Use them to **generate** members, peers, and extensions; validate inputs early; and standardize boilerplate. But keep things **predictable** and **auditable**—don’t overuse macros when a plain API or property wrapper suffices. ([Swift Documentation][2])

---

## References & further reading

* **The Swift Programming Language — Macros** (official) ([Swift Documentation][2])
* **Apple Developer: Applying Macros** (how to use + “Expand Macro”) ([Apple Developer][4])
* **`#externalMacro(module:type:)`** (Apple API reference) ([Apple Developer][6])
* **SE-0382 Expression Macros** (accepted) ([GitHub][18])
* **SE-0389 Attached Macros** (accepted) ([GitHub][3])
* **SE-0402 Extension Macros** (accepted) ([GitHub][19])
* **SwiftSyntax & macro protocols** (foundation for macro impls) ([GitHub][20])
* **Testing macros**: SwiftSyntax test support & Point-Free’s `swift-macro-testing` ([SwiftLee][14])
* **Compile-time URL validation example (blog)** ([Vodafone tech][10])
* **Swift 6.2 release notes** (current stable) ([Swift.org][1])

---

*Want this tailored “for Swift developers at Kakao” (e.g., conventions, module layout, CI settings with Xcode Cloud/Tuist, or sample macros that target your code style)? I can adapt the examples to your stack and add internal best-practices.*

[1]: https://www.swift.org/blog/swift-6.2-released/?utm_source=chatgpt.com "Swift 6.2 Released | Swift.org"
[2]: https://docs.swift.org/swift-book/documentation/the-swift-programming-language/macros/?utm_source=chatgpt.com "Macros - Documentation"
[3]: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0389-attached-macros.md?utm_source=chatgpt.com "swift-evolution/proposals/0389-attached-macros.md at main - GitHub"
[4]: https://developer.apple.com/documentation/swift/applying-macros?utm_source=chatgpt.com "Applying Macros | Apple Developer Documentation"
[5]: https://docs.swift.org/swift-book/documentation/the-swift-programming-language/macros/?curius=2437&utm_source=chatgpt.com "Macros | Documentation - docs.swift.org"
[6]: https://developer.apple.com/documentation/swift/externalmacro%28module%3Atype%3A%29?utm_source=chatgpt.com "externalMacro(module:type:) | Apple Developer Documentation"
[7]: https://github.com/wooky83/SWMacro?utm_source=chatgpt.com "GitHub - wooky83/SWMacro: Swift Macros Sample Code"
[8]: https://stackoverflow.com/questions/77386744/swift-macros-external-macro-implementation-type-could-not-be-found?utm_source=chatgpt.com "ios - Swift Macros: external macro implementation type could not be ..."
[9]: https://github.com/swiftlang/swift-syntax/blob/main/Examples/Sources/MacroExamples/Implementation/Peer/AddCompletionHandlerMacro.swift?utm_source=chatgpt.com "swift-syntax/Examples/Sources/MacroExamples/Implementation/Peer ..."
[10]: https://tech.gr.vodafone.com/post/swift-macros-compile-time-url-validation?utm_source=chatgpt.com "Vodafone tech | Swift Macros: Compile time URL validation"
[11]: https://stackoverflow.com/questions/79104432/how-to-emit-errors-from-a-swift-macro?utm_source=chatgpt.com "How to emit errors from a Swift Macro? - Stack Overflow"
[12]: https://docs.swift.org/swift-book/documentation/the-swift-programming-language/attributes/?utm_source=chatgpt.com "Attributes - Documentation"
[13]: https://gist.github.com/DougGregor/4f3ba5f4eadac474ae62eae836328b71?utm_source=chatgpt.com "A possible vision for macros in Swift · GitHub"
[14]: https://www.avanderlee.com/swift/macros/?utm_source=chatgpt.com "Swift Macros: Extend Swift with New Kinds of Expressions"
[15]: https://stackoverflow.com/questions/77267883/how-do-i-trust-a-swift-macro-target-for-xcode-cloud-builds?utm_source=chatgpt.com "How do I trust a swift macro target for Xcode Cloud builds?"
[16]: https://forums.swift.org/t/pitch-attached-macros/62812?utm_source=chatgpt.com "[Pitch] Attached macros - Pitches - Swift Forums"
[17]: https://forums.swift.org/t/macos-platform-required-to-run-macro-unit-tests-why/71084?utm_source=chatgpt.com "MacOS platform required to run macro unit tests: Why?"
[18]: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0382-expression-macros.md?utm_source=chatgpt.com "swift-evolution/proposals/0382-expression-macros.md at main - GitHub"
[19]: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0402-extension-macros.md?utm_source=chatgpt.com "swift-evolution/proposals/0402-extension-macros.md at main - GitHub"
[20]: https://github.com/swiftlang/swift-syntax?utm_source=chatgpt.com "GitHub - swiftlang/swift-syntax: A set of Swift libraries for parsing ..."
