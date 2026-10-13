# Repository Guidelines

NotchPad is a Tauri 2 desktop note-taking application built with Vue 3, TypeScript, and Tiptap. The backend is Rust (`src-tauri`), the frontend is built with Vite, and `pnpm` is the package manager.

## Project Structure

```
src/
  renderer/       # The only frontend; talks to Rust via the window.api bridge
    src/
      api/        # bridge.ts: Tauri invoke bridge exposed as window.api
      components/ # Vue components (BottomBar, TopToolbar, Settings, LinkDialog)
      composables/ # Reusable logic (usePages, useSave, useEditorSetup, etc.)
      directives/ # Custom Vue directives
      extensions/ # Tiptap editor extensions
      utils/      # Helpers (dataConverter.ts)
src-tauri/        # Tauri 2 backend (Rust)
  src/            # main.rs, db.rs (rusqlite), notch.rs, attachments.rs
  tauri.conf.json # Window, custom protocol and CSP configuration
out/renderer/     # Built frontend consumed by Tauri (frontendDist)
docs/             # Project documentation site
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` / `pnpm tauri:dev` | Run the app in development mode with hot reload |
| `pnpm build` | Typecheck then build the renderer bundle |
| `pnpm tauri:build` | Build and package the desktop installer (NSIS) |
| `pnpm lint` | Run ESLint with caching |
| `pnpm format` | Auto-format code with Prettier |
| `pnpm typecheck` | Run Vue/TS type checking |

## Coding Style

- **Indentation**: 2 spaces, UTF-8, LF line endings
- **Prettier**: single quotes, no semicolons, 100-char print width, no trailing commas
- **ESLint**: flat config with TypeScript and Vue plugins; Prettier integration handles formatting
- **Vue**: `<script lang="ts">` blocks enforced via ESLint rule `vue/block-lang`
- **TypeScript**: strict-ish checks via `vue-tsc`; `explicit-function-return-type` is off
- **Component naming**: multi-word component names rule is disabled; PascalCase for component files

## Testing

- **Rust**: integration tests live in `src-tauri/tests/`, run with `cargo test` (requires the lib crate in `src/lib.rs` to expose modules)
- **Frontend**: Vitest + jsdom, tests live in `src/renderer/src/__tests__/`, run with `pnpm test`
- Place new tests alongside the feature they cover; pure logic (conversion, baselines, rules) is the priority for coverage

## Commits & Pull Requests

- Commit messages follow `type: description` format in Chinese or English
- Common prefixes: `feat`, `fix`, `refactor`
- Keep commits focused on a single logical change
- Pull requests should include a clear description of what changed and why
- Reference related issues where applicable

## Architecture Notes

Tauri 2 app: the Rust process owns the database (rusqlite with bundled SQLite), image attachments on disk, the notch/pill state machine (Win32 cursor polling), tray, and global shortcuts. The Vue renderer is backend-agnostic and only calls `window.api`, implemented by `src/renderer/src/api/bridge.ts` on top of Tauri `invoke`. Attachment URLs use `http://notchpad.localhost` on Windows (custom protocol form) and `notchpad://` elsewhere — always build them through the backend (`attachment_url` / `save_attachment`), never hardcode a scheme in the renderer. State is managed through Vue composables rather than a global store.
