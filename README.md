# Forwardz

Forwardz is a controller-first Nintendo Switch homebrew utility for browsing
NRO applications and creating HOME-menu forwarders for them.

## Features

- Browse NRO applications from `sd:/switch/`.
- Create forwarders with the app's title, author, version, and artwork.
- Install a generated forwarder directly to the SD card.
- Distinguish installed and not-installed forwarders.
- Hide applications from the main library while retaining them in a Hidden view.
- Detect `prod.keys` in common SD-card locations.
- Show an offline key-dump guide and QR code when keys are missing.
- Preserve the previous hidden-app state location during the Forwardz migration.

## Install

Download `forwardz.nro` from the latest GitHub Release and copy it to:

```text
sd:/switch/forwardz.nro
```

Launch **Forwardz** from Homebrew Menu in full application memory mode. Applet
mode does not provide enough memory for forwarder generation.

## Keys

Forwarder generation requires `prod.keys` dumped from the user's own console.
Forwardz checks these common locations:

```text
sd:/switch/prod.keys
sd:/prod.keys
sd:/switch/keys/prod.keys
sd:/switch/DBI/prod.keys
```

If no keyset is found, Forwardz stops before generation and displays this guide:

[https://docs.ryujinx.app/guides/dumping/keys/](https://docs.ryujinx.app/guides/dumping/keys/)

Never share `prod.keys` or include it in an issue, pull request, build log, or
release artifact.

## Build from source

Requires Node.js 24.x, pnpm 10.x, and the published nx.js toolchain:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm nro
```

The build creates `forwardz.nro` in the repository root. The optional `pnpm
nsp` command creates an NSP package and requires a suitable local key setup.

## Development and releases

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and pull
request expectations. Forwardz uses Conventional Commits and Release Please:

1. Open a pull request with a focused change such as `feat:`, `fix:`, or `docs:`.
2. Merge the Release Please version pull request when it is ready.
3. Release Please creates the version tag and GitHub Release.
4. GitHub Actions validates the tagged source, builds `forwardz.nro`, creates
   `forwardz.nro.sha256`, and attaches both files to the release.

The UMS design is tracked in [issue #10](https://github.com/KRoperUK/forwardz-nx/issues/10).

## License and attribution

Forwardz is MIT licensed. Forwarder generation is based on the original
open-source project by Nathan Rajlich.
