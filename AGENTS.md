# Repository Guidelines

NotchPad is an Electron-based desktop note-taking application built with Vue 3, TypeScript, and Tiptap. It uses `electron-vite` for builds and `pnpm` as its package manager.

## Project Structure

```
src/
  main/           # Electron main process (index.ts, ipc.ts, db.ts, notch.ts)
  preload/        # Preload scripts bridging main and renderer
  renderer/       # Vue 3 frontend
    src/
      components/ # Vue components (BottomBar, TopToolbar, Settings, LinkDialog)
      composables/ # Reusable logic (usePages, useSave, useEditorSetup, etc.)
      directives/ # Custom Vue directives
      extensions/ # Tiptap editor extensions
      utils/      # Helpers (dataConverter.ts)
build/            # Electron-builder assets (icons, entitlements)
resources/        # Tray icons and logos
docs/             # Project documentation site
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the app in development mode with hot reload |
| `pnpm build` | Run typecheck then build via electron-vite |
| `pnpm build:win` | Build and package for Windows |
| `pnpm build:mac` | Build and package for macOS |
| `pnpm build:linux` | Build and package for Linux |
| `pnpm start` | Preview the built application |
| `pnpm lint` | Run ESLint with caching |
| `pnpm format` | Auto-format code with Prettier |
| `pnpm typecheck` | Run TypeScript and Vue type checking |

## Coding Style

- **Indentation**: 2 spaces, UTF-8, LF line endings
- **Prettier**: single quotes, no semicolons, 100-char print width, no trailing commas
- **ESLint**: flat config with TypeScript and Vue plugins; Prettier integration handles formatting
- **Vue**: `<script lang="ts">` blocks enforced via ESLint rule `vue/block-lang`
- **TypeScript**: strict-ish checks via `vue-tsc`; `explicit-function-return-type` is off
- **Component naming**: multi-word component names rule is disabled; PascalCase for component files

## Testing

This project does not currently include a test suite. If tests are added in the future, place them alongside the source files they cover (e.g., `src/renderer/src/__tests__/`).

## Commits & Pull Requests

- Commit messages follow `type: description` format in Chinese or English
- Common prefixes: `feat`, `fix`, `refactor`
- Keep commits focused on a single logical change
- Pull requests should include a clear description of what changed and why
- Reference related issues where applicable

## Architecture Notes

The app follows the standard Electron three-process model: main process manages windows, database (sql.js), and IPC; preload scripts expose a safe API to the renderer; the renderer runs a Vue 3 + Tiptap rich-text editor. State is managed through Vue composables rather than a global store.
