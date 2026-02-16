# rp-chat

This is an experimental AI chat app focused on **roleplay, character consistency, and prompt control**.

It's built as a personal project to explore what a cleaner, more intentional AI chat experience can look like, especially for roleplay and long-form interactions, without the clutter or limitations of existing UIs.

The project is still early and evolving.

## What it does (so far)

- Chat with real AI models using your **own API keys**
- Support for multiple providers and models via API profiles
- Per-chat configuration:
  - API profile
  - Optional character preset
  - Optional instruction preset
- Character and instruction presets to control tone, style, and behavior
- API profile validation from Settings
- Manual "Fetch models" action in Settings to load provider model IDs
- Chat actions in sidebar (rename, edit settings, delete)
- Clean UI with a focus on readability
- Local-first persistence (no backend or accounts yet)

## What it is not (yet)

- No backend
- No accounts or cloud sync
- No cost tracking or analytics
- No guarantees of stability

This is an MVP meant for experimentation and iteration.

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS
- Frontend-only API calls (BYO keys)

## Why this exists

Most AI chat tools optimize for general assistance.  
This project explores a different angle: **giving the user explicit control over prompts, characters, and context**, while keeping the interface calm and unobtrusive.

It's built primarily for learning, testing ideas, and personal use.

## Status

Active development.  
Things will change.  
Expect rough edges.

---

If you're reading this and experimenting with the code, feel free to explore, but don't expect polish or long-term guarantees yet.