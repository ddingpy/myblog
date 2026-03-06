---
title: "Practical Password Security for Engineers"
date: 2026-03-03 07:45:00 +0900
categories: [security]
tags: [security, passwords, mfa, privacy]
---
Password security is often treated as basic, but most incidents still start with credential theft.

## Core Rules That Actually Matter

1. Use a password manager for every account.
2. Enable MFA everywhere, especially email and Git hosting.
3. Never reuse a password between personal and work accounts.

## Strong Password Pattern

If a site forces manual passwords, use long passphrases, for example:

- `correct-harbor-cactus-laptop-!`

Length helps more than complexity tricks.

## Recovery Is Part of Security

Set up these now, not after account loss:

- Backup codes for MFA
- Recovery email with MFA
- Updated phone number

## Team-Level Advice

For engineering teams:

- Enforce SSO for critical tools.
- Rotate leaked credentials immediately.
- Add secret scanning in CI to catch accidental token commits.

Security is mostly about reducing easy wins for attackers.
