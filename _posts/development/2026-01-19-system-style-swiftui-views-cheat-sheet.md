---
title: "System-Style SwiftUI Views Cheat Sheet"
date: 2026-01-19 23:18:00 +0900
tags: [swiftui, ios, apple, ui]
---

Yes — SwiftUI has quite a few “batteries‑included” views like `ContentUnavailableView` that give you a native, system‑consistent UI for common situations.

Here’s a Markdown doc you can drop straight into your notes/wiki.

---

## System-Style SwiftUI Views Cheat Sheet

This document focuses on **ready-made, opinionated system views** you can drop in to get platform‑native UI with minimal code — similar in spirit to `ContentUnavailableView`.

---

## 1. `ContentUnavailableView` – Empty & Error States

**Availability:** iOS 17+, macOS 14+, tvOS 17+, watchOS 10+ ([SwiftyLion][1])

Use this when your feature has **no content** to show (empty list, no search results, offline, etc.).

```swift
struct EmptyStateExample: View {
    let items: [String] = []

    var body: some View {
        List(items, id: \.self) { item in
            Text(item)
        }
        .overlay {
            if items.isEmpty {
                ContentUnavailableView(
                    "No Favorites Yet",
                    systemImage: "star",
                    description: Text("Tap the star on an item to add it here.")
                )
            }
        }
    }
}
```

There’s also a built-in search variant:

```swift
.overlay {
    if searchResults.isEmpty {
        ContentUnavailableView.search(text: searchText)
    }
}
```

---

## 2. `ProgressView` – Loading & Progress Indicators

**Availability:** iOS 14+ (all Apple platforms) ([Apple Developer][2])

A system progress indicator with **automatic styling** (circular or linear) and support for determinate / indeterminate states.

### Indeterminate (spinner)

```swift
ProgressView("Loading…")
    .progressViewStyle(.circular)
```

### Determinate (progress bar)

```swift
struct DownloadView: View {
    @State private var progress: Double = 0.4

    var body: some View {
        VStack {
            ProgressView(value: progress) {
                Text("Downloading")
            } currentValueLabel: {
                Text("\(Int(progress * 100))%")
            }
        }
        .padding()
    }
}
```

Built-in styles include `.automatic`, `.linear`, and `.circular`. ([Apple Developer][2])

---

## 3. `Gauge` – Meter-Style Value Display

**Availability:** iOS 16+, macOS 13+, watchOS 9+ ([Use Your Loaf][3])

A **meter-style** control for things like battery, speed, or progress — visually richer than `ProgressView`.

```swift
struct BatteryGauge: View {
    @State private var level = 0.65

    var body: some View {
        Gauge(value: level, in: 0...1) {
            Text("Battery")
        } currentValueLabel: {
            Text("\(Int(level * 100))%")
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .tint(.green)
        .padding()
    }
}
```

`Gauge` supports multiple styles (linear, circular, accessory variants) and automatically adapts to platform. ([Apple Developer][4])

---

## 4. `Label` – Icon + Text in One View

**Availability:** iOS 14+

`Label` is a small thing but extremely useful: it wraps **SF Symbol + Text** with system‑standard spacing and accessibility.

```swift
Label("Settings", systemImage: "gear")
    .labelStyle(.titleAndIcon)

Label("Downloads", systemImage: "arrow.down.circle")
    .labelStyle(.iconOnly)       // just the icon
```

Many other system views (e.g. `ShareLink`, menus, toolbars) use `Label` under the hood, so learning it pays off.

---

## 5. `ShareLink` – System Share Sheet

**Availability:** iOS 16+, iPadOS 16+, macOS 13+, watchOS 9+ ([Apple Developer][5])

A **SwiftUI-native share sheet**. Great when you want to share URLs, text, images, or `Transferable` types with almost no boilerplate.

### Share a URL

```swift
struct ShareArticleButton: View {
    let url = URL(string: "https://developer.apple.com")!

    var body: some View {
        ShareLink(item: url) {
            Label("Share Article", systemImage: "square.and.arrow.up")
        }
    }
}
```

### Share an image with a custom preview

```swift
struct ShareImageButton: View {
    let image = Image("cute-dog")

    var body: some View {
        ShareLink(
            "Share Dog",
            item: image,
            preview: SharePreview("Cute dog", image: image)
        )
    }
}
```

Because it uses the system share sheet, you automatically get any share destinations the user has installed.

---

## 6. `PhotosPicker` – Native Photo Library Picker

**Availability:** iOS 16+, iPadOS 16+, macOS 13+, watchOS 9+ ([Apple Developer][6])

SwiftUI’s built‑in view for selecting photos and videos from the system photo library.

```swift
import PhotosUI

struct PhotoSelectorView: View {
    @State private var selection: [PhotosPickerItem] = []
    @State private var selectedImage: Image?

    var body: some View {
        VStack {
            PhotosPicker(
                selection: $selection,
                maxSelectionCount: 1,
                matching: .images
            ) {
                Label("Select Photo", systemImage: "photo")
            }

            if let selectedImage {
                selectedImage
                    .resizable()
                    .scaledToFit()
                    .frame(height: 200)
            }
        }
        .task(id: selection) {
            guard let item = selection.first else { return }
            if let data = try? await item.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: data) {
                selectedImage = Image(uiImage: uiImage)
            }
        }
    }
}
```

This handles the whole photo-picking experience with system UI, and uses the `Transferable` API under the hood.

---

## 7. `Map` (MapKit for SwiftUI) – System Maps

**Availability:** modern iOS/macOS/watchOS versions via MapKit for SwiftUI ([Apple Developer][7])

A SwiftUI-native map view from MapKit that lets you show Apple Maps with annotations, overlays, and camera control.

```swift
import MapKit

struct SimpleMapView: View {
    @State private var position: MapCameraPosition = .region(
        .init(
            center: .init(latitude: 37.334_900, longitude: -122.009_020),
            span: .init(latitudeDelta: 0.05, longitudeDelta: 0.05)
        )
    )

    var body: some View {
        Map(position: $position) {
            Marker("Apple Park", coordinate: .init(
                latitude: 37.334_900,
                longitude: -122.009_020
            ))
        }
        .mapStyle(.standard(elevation: .realistic))
    }
}
```

Compared to rolling your own map wrapper, the new MapKit+SwiftUI APIs give you a rich, declarative API with platform‑native styling.

---

## 8. `Form`, `List`, `Section` – System Lists & Forms

These are older but still very much in the same spirit: **drop-in containers** that immediately look like system UI.

### `Form` – Settings-style screens

```swift
struct SettingsForm: View {
    @State private var notifications = true
    @State private var username = ""

    var body: some View {
        Form {
            Section("Account") {
                TextField("Username", text: $username)
            }

            Section("Notifications") {
                Toggle("Enable notifications", isOn: $notifications)
            }
        }
    }
}
```

`Form` automatically gives you grouped sections, appropriate padding, and platform‑native behavior (e.g. differently on macOS vs iOS).

### `List` + `Section` – Table/List screens

```swift
struct ContactsListView: View {
    let favorites: [String]
    let others: [String]

    var body: some View {
        List {
            Section("Favorites") {
                ForEach(favorites, id: \.self, content: Text.init)
            }

            Section("All Contacts") {
                ForEach(others, id: \.self, content: Text.init)
            }
        }
    }
}
```

The `List`/`Form`/`Section` triad is your go‑to for “default iOS look” with very little effort.

---

## 9. `Menu` – Pull-Down / Context Menus

**Availability:** iOS 14+

A built‑in control for showing a system‑styled menu that can live in toolbars, nav bars, or inline.

```swift
struct SortMenu: View {
    @State private var sortOption = "Date"

    var body: some View {
        Menu {
            Button("Date")   { sortOption = "Date" }
            Button("Name")   { sortOption = "Name" }
            Button("Rating") { sortOption = "Rating" }
        } label: {
            Label("Sort: \(sortOption)", systemImage: "arrow.up.arrow.down")
        }
    }
}
```

On iOS, this becomes a pull‑down; on macOS, it renders more like a standard menu button.

---

## 10. `Picker`, `DatePicker`, `ColorPicker` – System Input Controls

These are all *Views* that render as the native control for the current platform.

### `Picker`

```swift
Picker("Sort by", selection: $sortOption) {
    Text("Date").tag("date")
    Text("Name").tag("name")
}
.pickerStyle(.segmented)
```

### `DatePicker`

```swift
DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)
    .datePickerStyle(.compact)
```

### `ColorPicker`

```swift
ColorPicker("Tint Color", selection: $tintColor, supportsOpacity: false)
```

All of these automatically adapt to device type, input method, and accessibility settings.

---

## Where to Go From Here

If you like `ContentUnavailableView`, you’ll probably also get a lot of value from:

* `ProgressView` & `Gauge` for loading/metrics.
* `ShareLink` and `PhotosPicker` for “system-y” flows with almost no UI code.
* `Map` for rich map experiences with native controls.
* `Form` / `List` / `Section` / `Menu` / various pickers for standard controls and layouts.

If you tell me what kind of screen/state you’re working on (e.g. “empty search results”, “loading dashboard”, “settings page”), I can suggest a small pattern combining several of these views in idiomatic SwiftUI.

[1]: https://swiftylion.com/articles/contentunavailableview-handle-empty-states?utm_source=chatgpt.com "ContentUnavailableView Handle Empty States in SwiftUI"
[2]: https://developer.apple.com/documentation/swiftui/progressview?utm_source=chatgpt.com "ProgressView | Apple Developer Documentation"
[3]: https://useyourloaf.com/blog/swiftui-gauges/?utm_source=chatgpt.com "SwiftUI Gauges - Use Your Loaf"
[4]: https://developer.apple.com/documentation/swiftui/gauge?utm_source=chatgpt.com "Gauge | Apple Developer Documentation"
[5]: https://developer.apple.com/documentation/swiftui/sharelink?utm_source=chatgpt.com "ShareLink | Apple Developer Documentation"
[6]: https://developer.apple.com/documentation/photosui/photospicker?utm_source=chatgpt.com "PhotosPicker | Apple Developer Documentation"
[7]: https://developer.apple.com/documentation/mapkit/mapkit-for-swiftui?utm_source=chatgpt.com "MapKit for SwiftUI | Apple Developer Documentation"
