# Contributing

Thanks for helping improve the project. This is a small monorepo — keep changes focused and match existing patterns in each package.

## Getting set up

1. Fork and clone the repo.
2. Install [Bun](https://bun.sh).
3. Follow the [Quick start](./README.md#quick-start-local-development) in the README to run the server and at least one client locally.
4. Create a branch from `main`:

   ```bash
   git checkout -b your-name/short-description
   ```

## Making changes

- **One concern per PR** — e.g. a bug fix, a client feature, or a server change. Avoid mixing unrelated refactors.
- **Match the package you touch** — TypeScript everywhere; Bun for server/terminal scripts; Expo conventions in `mobile/`; Next.js App Router patterns in `web/`.
- **Keep secrets out of git** — no `.env`, tokens, or database files.
- **Test manually** — run the server and the client(s) you changed. For WebSocket or auth work, test with two sessions (two browsers or browser + terminal).
- **Terminal UI** — always verify the TUI in a real system terminal.
- **Mobile** — test keyboard/input behavior on a device or emulator when touching chat UI.

## Code style

- Prefer small, readable diffs over large rewrites.
- Reuse existing helpers (`lib/ws.ts`, `lib/theme.ts`, `username-color`, etc.) instead of duplicating logic across clients.
- Only add comments when the *why* is not obvious from the code.
- Do not add dependencies unless they clearly pay for themselves.

## Commit messages

Write clear, imperative subject lines:

```
Fix reconnect status flicker on web client
Add keyboard avoidance to mobile chat input
```

Optional body: explain *why* if the change is not self-evident.

## Pull requests

1. Push your branch and open a PR against `main`.
2. Describe what changed and how you tested it.
3. Link any related issue if one exists.
4. Keep PRs reviewable — split large work into stacked PRs when possible.

**PR checklist**

- [ ] Server still starts (`cd server && bun run dev`)
- [ ] Affected client(s) run without errors
- [ ] No secrets or generated files committed
- [ ] Typecheck passes for packages you edited

## Reporting bugs

Include:

- Which client (web / mobile / terminal / server)
- Steps to reproduce
- Expected vs actual behavior
- OS and Bun versions if relevant

## Questions and design decisions

For larger features, open an issue first and describe the problem you are solving before opening a large PR.
