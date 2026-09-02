# Forwardz

Generate and install Nintendo Switch NRO forwarders directly from the Switch.

This build includes a library-style interface with Installed, To Install, and
Hidden views; persistent per-app hiding; common `prod.keys` path detection; and
an offline QR code for the key-dump guide when keys are missing.

## Build

Requires Node.js, pnpm, and the nx.js Switch toolchain.

```sh
pnpm install
pnpm run typecheck
pnpm run nro
```

The output is `forwardz.nro`. Copy it to:

```text
sd:/switch/forwardz.nro
```

The HOME-menu title is **Forwardz**.

## Key requirement

The app searches these common locations for `prod.keys`:

```text
sd:/switch/prod.keys
sd:/prod.keys
sd:/switch/keys/prod.keys
sd:/switch/DBI/prod.keys
```

If none are found, the app displays the key-dump warning and QR code instead
of attempting forwarder generation.

## License

MIT. The forwarder generation implementation is based on the original
open-source project by Nathan Rajlich.
