---
name: update-phone-app
description: Updates the user's phone app wirelessly using EAS Update and optionally pushes to git. Use when the user asks to "update my phone app", "push update to my phone", "git push now", or similar.
---

# Update Phone App

Publish the latest JavaScript changes directly to the user's phone over-the-air using Expo EAS Update, and optionally push to GitHub.

## Trigger Rules

- Run **only when explicitly requested by the user** (e.g., "update my phone app", "push now").

## Commands

- To update phone app only:
  ```bash
  npx eas-cli update --auto
  ```
- To push to GitHub and update phone app together:
  ```bash
  git push:now
  ```
