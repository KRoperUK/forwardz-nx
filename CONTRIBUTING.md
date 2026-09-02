# Contributing to Forwardz

Thanks for helping improve Forwardz. The project is a Nintendo Switch homebrew
application built with TypeScript, React Tela, and nx.js.

## Development setup

Install Node.js 24.x and pnpm 10.x, then run:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm nro
```

The NRO build creates `forwardz.nro` in the repository root. Copy it to
`sd:/switch/forwardz.nro` for testing and launch Forwardz in full application
memory mode rather than applet mode.

Never commit `prod.keys`, console dumps, private dumps, or other sensitive
console material. Tests and examples must use synthetic data.

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
