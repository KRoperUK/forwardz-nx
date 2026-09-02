# Contributing to Forwardz

Thanks for helping improve Forwardz. The project is a Nintendo Switch homebrew
application built with TypeScript, React Tela, and nx.js.

## Development setup

Install Node.js 24.x and pnpm 10.x, then run:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm nro
```

The NRO build creates `forwardz.nro` in the repository root. Copy it to
`sd:/switch/forwardz.nro` for testing and launch Forwardz in full application
memory mode rather than applet mode.

`pnpm test` runs Vitest unit tests on Node.js. Keep logic that depends on the
`Switch` global (filesystem, native services, gamepad) thin and push
reasoning that can be tested without hardware into plain functions/modules,
following the pattern in `src/usb-sd-access/support.ts`.

Never commit `prod.keys`, console dumps, private dumps, or other sensitive
console material. Tests and examples must use synthetic data.

## Hardware validation

Automated checks (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm nro`) can
all run on a development machine, but they cannot verify on-console
behaviour. Before merging a change that affects rendering, gamepad input, or
SD-card I/O, validate on real hardware:

1. Copy the built `forwardz.nro` to `sd:/switch/forwardz.nro` on a test SD
   card (not one containing data you cannot lose).
2. Launch from the Homebrew Menu in full application memory mode.
3. Exercise the affected screen(s) with a real controller, including the
   footer button hints, to confirm they match what's rendered.
4. For SD-card-related changes, confirm the app still starts correctly with
   `prod.keys` present and absent (`/error-missing-prod-keys` path).

For the USB SD Access screen specifically: confirm it opens from the library
screen's `ZL` hint, displays the unsupported explanation, and that `A`/`B`
both return to the previous screen without touching the SD card. There is
no USB Mass Storage session to validate today, since the feature is not
implemented — see `docs/usb-sd-access.md`.

## Pull requests

- Create a focused feature or fix branch from `main`.
- Use Conventional Commit-style messages such as `feat:`, `fix:`, `docs:`,
  `refactor:`, `perf:`, `test:`, `build:`, or `ci:`.
- Run typecheck, lint, and the NRO build locally.
- Explain controller mappings and on-device testing steps for UI changes.
- Include screenshots or a short recording when visual behaviour changes.
- Keep changes compatible with the existing SD-card layout unless migration is
  included and documented.

Release Please uses Conventional Commits to prepare release pull requests and
changelogs. A `feat:` commit normally indicates a feature release, while a
`fix:` commit indicates a patch release.

## Security and keys

Please do not report exposed keys or sensitive console data in a public issue.
Follow [SECURITY.md](SECURITY.md) for private reporting instructions.
