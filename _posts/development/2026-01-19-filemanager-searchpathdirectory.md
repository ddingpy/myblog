---
title: "FileManager.SearchPathDirectory (Swift / Foundation)"
date: 2026-01-19 23:18:00 +0900
tags: [swift, foundation, filemanager, ios]
---


`FileManager.SearchPathDirectory` is an enum that identifies “well-known” directory locations. You typically use it with:

- `FileManager.default.urls(for:in:)` to *locate* common directories.  
- `FileManager.default.url(for:in:appropriateFor:create:)` to *locate (and optionally create)* a directory, and (notably) to get a temporary directory on a specific volume via `.itemReplacementDirectory`.

> Practical note for iOS developers: Many cases correspond to macOS “system” or user-facing folders (Desktop, Movies, PreferencePanes, etc.). In iOS app sandboxes, only a small subset is typically meaningful (most commonly `.documentDirectory`, `.cachesDirectory`, `.applicationSupportDirectory`, and `.libraryDirectory`). Apple’s APIs still define the cases, but whether a directory is returned depends on platform, sandboxing, and domain mask.

---

## The members (all cases)

The list below matches the canonical `NSSearchPathDirectory` set (the Objective-C ancestor of these directory constants), including raw values.

### Legend

- **Typical path (macOS)**: conventional location on macOS (not guaranteed; don’t hard-code).
- **iOS sandbox reality**: whether it’s commonly used/meaningful in an iOS app sandbox (high-level guidance).

---

## Directory Locations (cases)

### Core app-storage cases (commonly relevant on iOS)

| Case | Raw value | What it’s for | Typical path (macOS) | iOS sandbox reality |
|---|---:|---|---|---|
| `.documentDirectory` | 9 | User documents. | `~/Documents` (conceptually) | Common; persists; user data you want backed up (unless excluded). |
| `.cachesDirectory` | 13 | Discardable cache files (`Library/Caches`). | `~/Library/Caches` | Common; system may purge. |
| `.applicationSupportDirectory` | 14 | App support files (`Library/Application Support`). | `~/Library/Application Support` | Common; good for non-user-facing persistent data. |
| `.libraryDirectory` | 5 | “Documentation, support, and configuration” (`/Library`). | `/Library` (domain-dependent) | Often maps inside the app container (`Library/...`). |
| `.downloadsDirectory` | 15 | The user’s downloads directory. | `~/Downloads` | Usually not a meaningful concept for sandboxed iOS apps. |

### User-facing media/UI folders (mostly macOS user domain)

| Case | Raw value | What it’s for | Typical path (macOS) | iOS sandbox reality |
|---|---:|---|---|---|
| `.desktopDirectory` | 12 | The user’s Desktop. | `~/Desktop` | Generally not meaningful inside an iOS app sandbox. |
| `.moviesDirectory` | 17 | Movies folder. | `~/Movies` | Generally not meaningful inside an iOS app sandbox. |
| `.musicDirectory` | 18 | Music folder. | `~/Music` | Generally not meaningful inside an iOS app sandbox. |
| `.picturesDirectory` | 19 | Pictures folder. | `~/Pictures` | Generally not meaningful inside an iOS app sandbox. |
| `.sharedPublicDirectory` | 21 | Shared “Public” folder. | `~/Public` | Generally not meaningful inside an iOS app sandbox. |

### System / developer / admin locations (macOS-oriented)

| Case | Raw value | What it’s for | Typical path (macOS) | iOS sandbox reality |
|---|---:|---|---|---|
| `.applicationDirectory` | 1 | Installed applications. | `/Applications` (domain-dependent) | Not typically meaningful on iOS. |
| `.allApplicationsDirectory` | 100 | All application directories (across domains). | Multiple | Not typically meaningful on iOS. |
| `.demoApplicationDirectory` | 2 | Unsupported apps / demo versions. | System-defined | Not typically meaningful on iOS. |
| `.adminApplicationDirectory` | 4 | System/network admin apps. | System-defined | Not typically meaningful on iOS. |
| `.developerApplicationDirectory` | 3 | Developer apps (`/Developer/Applications`). | `/Developer/Applications` | Not typically meaningful on iOS. |
| `.developerDirectory` | 6 | Developer resources (`/Developer`). | `/Developer` | Not typically meaningful on iOS. |
| `.documentationDirectory` | 8 | Documentation directory. | System-defined | Not typically meaningful on iOS. |
| `.coreServiceDirectory` | 10 | Core services (`System/Library/CoreServices`). | `/System/Library/CoreServices` | Not typically meaningful on iOS. |
| `.userDirectory` | 7 | User home directories (`/Users`). | `/Users` | Not meaningful in iOS sandbox. |

### System configuration / integration folders (macOS-oriented)

| Case | Raw value | What it’s for | Typical path (macOS) | iOS sandbox reality |
|---|---:|---|---|---|
| `.inputMethodsDirectory` | 16 | Input Methods (`Library/Input Methods`). | `~/Library/Input Methods` | Not typically meaningful on iOS. |
| `.printerDescriptionDirectory` | 20 | Printer descriptions. | System-defined | Not typically meaningful on iOS. |
| `.preferencePanesDirectory` | 22 | System Preferences panes (`Library/PreferencePanes`). | `/Library/PreferencePanes` or `~/Library/PreferencePanes` | Not typically meaningful on iOS. |
| `.allLibrariesDirectory` | 101 | All library directories where resources can be stored. | Multiple | Not typically meaningful on iOS. |

### Autosave, scripts, temporary replacement, trash

| Case | Raw value | What it’s for | Typical path (macOS) | iOS sandbox reality |
|---|---:|---|---|---|
| `.autosavedInformationDirectory` | 11 | Autosaved docs (`Library/Autosave Information`). | `~/Library/Autosave Information` | Not commonly used in iOS app code. |
| `.applicationScriptsDirectory` | 23 | Per-app user scripts folder (`~/Library/Application Scripts/<code-signing-id>`). | `~/Library/Application Scripts/<bundle-id-ish>` | macOS sandbox feature; not an iOS concept. |
| `.itemReplacementDirectory` | 99 | Temporary directory used for safe file replacement workflows. | Volume-appropriate temp dir | Useful when doing atomic-ish replaces; platform-dependent. |
| `.trashDirectory` | 102 | The Trash directory. | `~/.Trash` (non-sandboxed) | Exists as an API; on iOS, Apple notes it’s within the app’s sandbox for `URL.trashDirectory`. |

---

## Usage patterns (Swift)

### 1) Preferred: `urls(for:in:)`
```swift
let fm = FileManager.default

let documents = fm.urls(for: .documentDirectory, in: .userDomainMask).first!
let caches    = fm.urls(for: .cachesDirectory, in: .userDomainMask).first!
let appSup    = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
```