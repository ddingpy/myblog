---
title: "Swift + Xcode Library: Build, Document & Share (Step-by-Step)"
date: 2025-11-01 14:00:00 +0900
tags: [swift, xcode, spm, library, documentation]
---


Hi! Let’s make a small, real Swift library, test it, document it, and share it so other developers (and your future self) can use it easily. I’ll keep each step simple and explain any new word in plain English.

---

## What you’ll build

* A Swift **package** (the standard way to make libraries).
* It works in Xcode (iOS, macOS, tvOS, watchOS).
* It has tests, documentation, CI (optional), and versioned releases.
* You’ll share it via **Swift Package Manager (SPM)**.
  (Optional: CocoaPods + XCFramework.)

---

## Prerequisites

* Xcode 14 or later (Xcode includes Swift and supports Swift Packages).
* A GitHub account (or any Git server).
* Basic terminal use.

> Tip: “SPM” = Swift Package Manager. It’s built into Swift/Xcode and is the easiest way to share code.

---

## 1) Create the library (Swift Package)

```bash
## 1) Make a new folder and enter it
mkdir GreeterKit && cd GreeterKit

## 2) Create a Swift package (library template)
swift package init --type library
```

This creates a structure like:

```
GreeterKit/
├── Package.swift
├── README.md
├── Sources/
│   └── GreeterKit/
│       └── GreeterKit.swift
└── Tests/
    └── GreeterKitTests/
        └── GreeterKitTests.swift
```

Open it in Xcode:

```bash
open Package.swift
```

Xcode will show your package like a project.

---

## 2) Add simple code

Replace `Sources/GreeterKit/GreeterKit.swift` with:

```swift
public struct Greeter {
    public init() {}

    /// Returns a friendly greeting.
    /// - Parameter name: The name to greet.
    /// - Returns: Example: "Hello, Luna!"
    public func hello(name: String) -> String {
        "Hello, \(name)!"
    }
}
```

> Note: The keyword `public` lets apps outside your package use the type/function.

---

## 3) Add tests (to prove it works)

Edit `Tests/GreeterKitTests/GreeterKitTests.swift`:

```swift
import XCTest
@testable import GreeterKit

final class GreeterKitTests: XCTestCase {
    func testHello() {
        let g = Greeter()
        XCTAssertEqual(g.hello(name: "World"), "Hello, World!")
    }
}
```

Run tests:

```bash
swift test
```

Or in Xcode: **Product ▸ Test**.

---

## 4) Set platform support (optional but recommended)

Edit `Package.swift` to declare platforms:

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "GreeterKit",
    platforms: [
        .iOS(.v13), .macOS(.v12), .tvOS(.v13), .watchOS(.v7)
    ],
    products: [
        .library(name: "GreeterKit", targets: ["GreeterKit"])
    ],
    targets: [
        .target(name: "GreeterKit"),
        .testTarget(name: "GreeterKitTests", dependencies: ["GreeterKit"])
    ]
)
```

> “Platforms” tell users the minimum OS versions your library supports.

---

## 5) Use the library in an Xcode app (local)

If you want to try it in a sample app without pushing to GitHub:

1. In your app project: **File ▸ Add Packages…**
2. Click **Add Local…** and choose your `GreeterKit` folder.
3. Add the product **GreeterKit** to your app target.

Then:

```swift
import GreeterKit

let result = Greeter().hello(name: "Nana")
print(result) // Hello, Nana!
```

---

## 6) Make nice documentation (DocC)

DocC turns your `///` comments into clean docs.

### Quick start (Xcode UI)

* In Xcode: **Product ▸ Build Documentation**.
* You’ll see API docs generated from comments.
* Add more `///` comments to improve it.
* Optional: **File ▸ New ▸ File… ▸ Documentation Catalog** to create a `.docc` bundle for guides and tutorials.

### Static website (optional, GitHub Pages)

1. Add Apple’s DocC plugin so the `swift` command can export static docs:

   In `Package.swift` add:

   ```swift
   dependencies: [
       .package(url: "https://github.com/apple/swift-docc-plugin", from: "1.3.0")
   ],
   ```

2. Export docs:

   ```bash
   swift package generate-documentation \
     --target GreeterKit \
     --disable-indexing \
     --transform-for-static-hosting \
     --hosting-base-path GreeterKit \
     --output ./docs
   ```

3. Commit `/docs` and turn on **GitHub Pages** for the `docs/` folder.

---

## 7) Add CI (GitHub Actions) to build & test (optional)

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push: { branches: [ main ] }
  pull_request: { branches: [ main ] }

jobs:
  linux-swiftpm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: swift-actions/setup-swift@v2
        with:
          swift-version: "5.9"
      - name: Build
        run: swift build -v
      - name: Test
        run: swift test -v
```

> This makes sure the package builds and tests pass on every push/PR.

---

## 8) Choose a license

Create `LICENSE` with a friendly license like **MIT**:

```text
MIT License

Copyright (c) 2025 ...

Permission is hereby granted, free of charge, to any person obtaining a copy...
```

> A license tells others how they can use your code.

---

## 9) Prepare for release

1. Initialize Git and make the first commit:

   ```bash
   git init
   git add .
   git commit -m "Initial library"
   ```

2. Create a remote repo (e.g., GitHub) and push:

   ```bash
   git branch -M main
   git remote add origin https://github.com/<you>/GreeterKit.git
   git push -u origin main
   ```

3. Tag a version (use **Semantic Versioning**: MAJOR.MINOR.PATCH):

   ```bash
   git tag 1.0.0
   git push origin 1.0.0
   ```

> SPM uses Git tags. When others add your package, they pick a version rule like `from: "1.0.0"`.

---

## 10) Share via Swift Package Manager (recommended)

### How others add your library (Xcode)

* **File ▸ Add Packages…**
* Paste your repo URL, e.g.
  `https://github.com/<you>/GreeterKit`
* Choose **Dependency Rule**: **Up to Next Major** starting at **1.0.0**
* Add the product **GreeterKit** to their target.

### How others add it in their own Package.swift

```swift
// In their package:
dependencies: [
    .package(url: "https://github.com/<you>/GreeterKit.git", from: "1.0.0")
],
targets: [
    .target(
        name: "SomeApp",
        dependencies: [
            .product(name: "GreeterKit", package: "GreeterKit")
        ]
    )
]
```

---

## 11) Optional: Share as an XCFramework (binary)

Use this when you want to ship a prebuilt binary (for faster builds or closed-source).

1. Add a framework target in an Xcode project (or use `xcodebuild` with your package-generated project).

2. Build **archives** for each platform and simulator:

   ```bash
   xcodebuild archive \
     -scheme GreeterKit \
     -destination "generic/platform=iOS" \
     -archivePath build/ios \
     SKIP_INSTALL=NO BUILD_LIBRARY_FOR_DISTRIBUTION=YES

   xcodebuild archive \
     -scheme GreeterKit \
     -destination "generic/platform=iOS Simulator" \
     -archivePath build/iossim \
     SKIP_INSTALL=NO BUILD_LIBRARY_FOR_DISTRIBUTION=YES
   ```

3. Create the XCFramework:

   ```bash
   xcodebuild -create-xcframework \
     -framework build/ios.xcarchive/Products/Library/Frameworks/GreeterKit.framework \
     -framework build/iossim.xcarchive/Products/Library/Frameworks/GreeterKit.framework \
     -output GreeterKit.xcframework
   ```

4. Distribute `GreeterKit.xcframework` (attach to GitHub Release).
   Users drag it into their app and set **Embed & Sign**.

> `BUILD_LIBRARY_FOR_DISTRIBUTION=YES` helps with Swift “module stability” so your binary is usable across Swift minor versions.

---

## 12) Optional: CocoaPods support

1. Create `GreeterKit.podspec`:

   ```ruby
   Pod::Spec.new do |s|
     s.name         = 'GreeterKit'
     s.version      = '1.0.0'
     s.summary      = 'Friendly greeting utilities.'
     s.description  = 'A tiny Swift library that says hello.'
     s.homepage     = 'https://github.com/<you>/GreeterKit'
     s.license      = { :type => 'MIT' }
     s.author       = { '<you>' => '<you>@email.com' }
     s.source       = { :git => 'https://github.com/<you>/GreeterKit.git', :tag => s.version.to_s }
     s.swift_version = '5.9'
     s.platform     = :ios, '13.0'
     s.source_files = 'Sources/GreeterKit/**/*.swift'
   end
   ```

2. Validate:

   ```bash
   pod lib lint
   ```

3. Publish:

   ```bash
   pod trunk push GreeterKit.podspec
   ```

> Users can then add `pod 'GreeterKit', '~> 1.0'` to their Podfile.

---

## 13) Great README template (copy-paste)

Create `README.md`:

````markdown
## GreeterKit

A tiny Swift library that says hello.

## Installation (Swift Package Manager)

- Xcode: File ▸ Add Packages…  
  URL: `https://github.com/<you>/GreeterKit`
- Version: Up to Next Major from 1.0.0

## Usage

```swift
import GreeterKit

print(Greeter().hello(name: "World"))
````

## Requirements

* iOS 13+ / macOS 12+ / tvOS 13+ / watchOS 7+

## Documentation

* See the API docs (DocC): https://<you>.github.io/GreeterKit/

## License

```
MIT

```

---

## 14) Release checklist

- [ ] All public APIs have clear `///` comments.  
- [ ] `swift test` passes.  
- [ ] `README.md` shows install + usage.  
- [ ] `LICENSE` present.  
- [ ] Tag created: `git tag 1.0.0 && git push origin 1.0.0`.  
- [ ] (Optional) GitHub Release notes.  
- [ ] (Optional) Docs exported to `docs/` and GitHub Pages enabled.  
- [ ] (Optional) XCFramework built and attached to release.  
- [ ] (Optional) CocoaPods podspec pushed.

---

## 15) Troubleshooting (common issues)

**“No such module ‘GreeterKit’”**  
- Make sure you added the product to your app target (Xcode target settings).  
- Clean build folder (**Shift+Cmd+K**) and rebuild.

**“Module compiled with Swift X.Y cannot be imported by Swift X.Z”**  
- Rebuild with your current Xcode/Swift.  
- If distributing a binary, use `BUILD_LIBRARY_FOR_DISTRIBUTION=YES`.

**SPM can’t find the version**  
- Did you push the Git **tag**? (`git push origin 1.0.0`)  
- The repo must be public (or accessible to the user).

---

## 16) Next steps (ideas)

- Add more tests (edge cases).  
- Add async APIs if useful.  
- Add a `.docc` guide with examples and screenshots.  
- Set up another CI job on `macos-latest` to build for iOS with `xcodebuild`.  
- Add a simple example app in `Examples/HelloApp/`.
