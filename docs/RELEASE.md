# Forwardz releases

This document describes how Forwardz release artifacts are produced and how
to install and verify them (issue #9).

## How releases are built

Releases are cut automatically from `main` with Release Please:

1. Pushes to `main` using [Conventional Commits](https://www.conventionalcommits.org/)
   are grouped into a release PR.
2. Merging the release PR creates a tag (for example `v0.2.0`) and a
   GitHub release.
3. The `Release` workflow (`.github/workflows/release.yml`) checks out the
   **tagged commit** — never the branch tip — then runs, in order:
   `pnpm typecheck`, `pnpm lint`, and `pnpm nro` (esbuild bundle plus the
   `nxjs-nro` packaging step). Any failure stops the release before
   anything is published.

## Artifacts and verification

Every release attaches:

| File                 | Contents                                              |
| -------------------- | ----------------------------------------------------- |
| `forwardz.nro`       | The homebrew binary, built from the tagged commit.    |
| `forwardz.nro.sha256`| SHA-256 checksum of the NRO.                          |
| `build-info.txt`     | Tag, source commit SHA, build timestamp, and toolchain versions. |
| `build-info.txt.sha256` | SHA-256 checksum of the provenance file.           |

To verify a download (macOS/Linux):

```sh
sha256sum -c forwardz.nro.sha256
sha256sum -c build-info.txt.sha256
```

Compare the `commit` line in `build-info.txt` with the tagged commit shown
on the release page. They must match: the NRO is always built from that
exact source commit in GitHub Actions, never on a maintainer machine, so no
local development toolchain is needed to reproduce it.

## Installing

1. Copy `forwardz.nro` to the `switch/` folder of your SD card
   (for example as `switch/forwardz/forwardz.nro`).
2. Launch it from the Homebrew Menu in full-memory (title override) mode.
   Applet mode is rejected with an explanation screen.
3. On first launch, the app asks for `prod.keys`. Dump your own keys with
   Lockpick_RCM and place `prod.keys` in one of the locations listed
   in-app. Key material is only ever read on the console: it is never
   logged, never uploaded, and no release artifact contains key material.
   If generation is attempted without keys, the app stops with a guidance
   screen instead of producing a broken forwarder.

## Supported versions

Each release notes the Atmosphere release and Nintendo system firmware it
was smoke-tested against. As a rule, run a currently supported Atmosphere
release on a recent firmware; if your combination is untested, the notes
say so. Unsupported runtime behavior is reported in-app rather than
failing silently.
