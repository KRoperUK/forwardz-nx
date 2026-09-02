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
- Explain why Hekate-style USB Mass Storage (full SD card access from a
  computer) is not available on the current runtime, instead of showing a
  non-functional button. See [USB SD Access](#usb-sd-access) below.

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

## USB SD Access

Forwardz includes a **USB SD Access** screen (press `ZL` from the library
screen) that explains why full Hekate-style USB Mass Storage — mounting the
entire SD card on a computer over USB, the way Hekate does from the
bootloader — is not offered as a real feature.

In short: Hekate can do this because it runs before Horizon (the Switch
system software) boots and owns the SD card. Forwardz runs as a normal
application after Horizon already owns it, and the current nx.js runtime
does not expose the native USB device-mode (`usb:ds`) support needed to hand
the SD card to a computer safely. Rather than ship a button that cannot
actually do this, Forwardz shows a clear explanation.

See [`docs/usb-sd-access.md`](docs/usb-sd-access.md) for the full feasibility
audit, the target lifecycle/state machine if the runtime ever adds support,
and FAT32/exFAT data-loss considerations. Progress is tracked in
[issue #10](https://github.com/KRoperUK/forwardz-nx/issues/10).

## Build from source

Requires Node.js 24.x, pnpm 10.x, and the published nx.js toolchain:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm nro
```

The build creates `forwardz.nro` in the repository root. The optional `pnpm
nsp` command creates an NSP package and requires a suitable local key setup.
`pnpm test` runs the Vitest unit tests (currently the USB SD Access
feasibility-reasoning module; no `Switch` hardware globals are required to
run them).

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
