# USB SD Access — feasibility audit and architecture plan

Tracks [issue #10](https://github.com/KRoperUK/forwardz-nx/issues/10): a
Hekate-style USB Mass Storage (UMS) mode that would let a computer mount the
whole Switch SD card over USB, the way Hekate does from the bootloader.

## Summary

**Full USB Mass Storage cannot be safely implemented inside the current
Forwardz NRO.** The blocker is not application logic, it is the runtime:
nx.js 0.0.69 does not expose the native `usb:ds` (device-mode / USB gadget)
service to JavaScript, and there is no safe way to hand SD ownership away from
Horizon while a normal application process is running. Forwardz therefore
ships a controller-first **USB SD Access** screen that explains this
unambiguously instead of a non-functional button, per the issue's
requirement not to ship fake UI.

This document records the audit, the reasoning, and the architecture that
would be required if the runtime gap is ever closed. It is also the
feasibility runbook for issue #10: the feature stays open until a human
verifies the hardware steps in [Human verification runbook](#human-verification-runbook).

## What "Hekate-style UMS" actually requires

Hekate can expose the raw SD card as a USB disk because it runs **before**
Horizon boots. There is no filesystem driver, no running OS, and no
concurrent owner to conflict with. It is not a homebrew app, it is a
bootloader that hasn't handed control to Horizon yet.

A Nintendo Switch homebrew NRO is a normal Horizon userland process launched
from the Homebrew Menu. To present the SD card as a USB disk from inside an
NRO, three things would all need to be true at once:

1. **A USB gadget/device-mode stack.** The console's USB port would need to
   stop acting as a host and instead register a Mass Storage Class (MSC)
   gadget with the host PC using `usb:ds`, including
   device/configuration/interface/endpoint descriptors and a Bulk-Only
   Transport (BOT) driver implementing the SCSI command set
   (`READ`/`WRITE`/`READ CAPACITY`/`INQUIRY`/etc). This is a substantial
   native USB stack, not something exposed by high-level WebUSB-style APIs.
2. **Exclusive, safe SD ownership.** Horizon's `fs` sysmodule owns the SD
   card (`sdmc:`) for the whole system, not just for Forwardz. Every other
   running process (Home Menu, applets, other resident services) also
   expects `sdmc:` to be available. An application-level NRO has no
   supported way to force Horizon to relinquish and later reclaim SD
   ownership system-wide; that is bootloader/firmware territory, not
   userland application territory.
3. **A BOT/SCSI implementation talking to raw block I/O**, bypassing the
   FAT32/exFAT driver Horizon itself uses, so writes from the host don't
   race writes from Horizon on the same blocks.

None of this is available through nx.js's JavaScript API, and (2) in
particular is not something any userland process, JS or native, is meant to
do on a stock, non-bootloader-modified console.

## Runtime and toolchain audit

Audit date: 2026-11-18. Runtime version pinned in `package.json`:
`@nx.js/runtime` 0.0.69.

### nx.js runtime (0.0.69)

Verified against the installed runtime (`node_modules/@nx.js/runtime`,
`dist/index.d.ts`):

- The typings expose **zero** `usb`-named bindings — no `usbDs*`
  device-mode/gadget primitives, no endpoint registration, no block-device
  access.
- The only USB-adjacent surface nx.js offers to JavaScript is
  `navigator.usb` (host-mode WebUSB, the Switch acting as a USB **host**
  talking to an attached peripheral). It is unrelated to exposing the
  Switch itself as a mass-storage device to a PC.
- The `Switch` API exposes file-level `sdmc:` access (`readFileSync`,
  `writeFileSync`, `readDirSync`, `mkdirSync`) plus a generic
  `Switch.Service` IPC wrapper (`dispatchInOut`) — used in this repo by
  `src/ipc/spl.ts` against `spl:mig`. There is no API to unmount/remount
  `sdmc:`, no exclusive/raw block access bypassing the FAT driver, and no
  gadget-mode IPC support for USB roles.

### devkitPro / libnx toolchain

The devkitPro/libnx toolchain used to build the NRO ships a complete native
C API for `usb:ds` (`usbDsInitialize`, `usbDsRegisterInterface`,
`UsbDsInterface`, `UsbDsEndpoint`, and related calls in
`libnx/include/switch/services/usbds.h`). Critically, this is a **native C
API**: using it means writing native code, exposing new bindings through
nx.js's native bridge, and rebuilding the nx.js runtime itself. That is a
change to the runtime Forwardz depends on, upstream of this repository — not
something an application author can wire up from `src/` alone.

### Existing Forwardz USB code

There is no USB Mass Storage code in this repository. Nothing in `src/`
references `navigator.usb`, `usb:ds`, or `usb:hs`; the only Horizon-service
precedent is `src/ipc/spl.ts` (simple `spl:mig` command wrappers), which
shows the low-level pattern a hypothetical `usb:ds` binding would need but
cannot substitute for the missing gadget-mode runtime support.

### Conclusion

Implementing full SD-card UMS would require, at minimum:

- A native libnx component (C/C++) implementing the BOT/SCSI gadget, most
  plausibly landed upstream in nx.js itself as new native bridge functions,
  or
- A companion sysmodule that owns `usb:ds` and the SD block device outside
  the application process, coordinating handoff with a running NRO over IPC,
  plus
- A safe, system-wide SD quiesce/restore mechanism that today only exists at
  the bootloader level (Hekate) or would need new Horizon-level support.

This is out of scope for an application-level change to this repository and
cannot be done safely from inside the existing NRO on the current runtime.
Shipping a button that pretends to do this would risk data loss with no way
to make good on the promise, which is explicitly against the goal of this
issue.

## What Forwardz ships instead

Feature flag: `USB_SD_ACCESS_EXPLANATION_ENABLED` in
`src/usb-sd-access/support.ts`. While full UMS stays unimplemented, the flag
gates only the explanation scaffolding — there is no code path that claims
to start a USB session, touches the SD card, or changes any lifecycle.

- A controller-first **USB SD Access** screen (`/usb-sd-access`), reachable
  from the Backup (settings) screen with `ZR` (see `src/routes/Settings.tsx`
  and the Backup table in `docs/CONTROLS.md`).
- The screen states plainly that the feature is unavailable on the current
  runtime, why (summarized from this document), and what would need to
  change for it to become possible.
- It offers no fake "start" action. `A`/`B` both dismiss back to the
  previous screen; the screen performs no SD reads or writes.
- The screen's copy and the reasoning behind it live in
  `src/usb-sd-access/support.ts`, a small pure module (no react-tela, no
  `Switch` global) so the "why" logic has unit tests independent of
  rendering (`src/usb-sd-access/support.test.ts`).
- The route is registered in `src/main.tsx` only when the flag is enabled;
  flipping the flag off removes the screen and its entry point without
  touching anything else.

## If the runtime gap closes: target architecture

Should nx.js gain native `usb:ds` bindings (or Forwardz gains a companion
sysmodule) in the future, the feature should be implemented as an explicit
state machine, not a toggle, because every transition has a real
data-safety consequence:

```
                 A-button confirm
   idle ────────────────────────────► preparing
     ▲                                    │
     │ error                             │ SD quiesced, usb:ds interface
     │ (unsupported firmware/            │ registered + enabled
     │  runtime, init failure)           ▼
     └───────────────────────────── mounted
                                          │
                        stop requested    │  unexpected cable removal
                    (user, host eject)    │  detected via GetStateChangeEvent
                          │               │
                          ▼               ▼
                       stopping ──────► error (needs recovery guidance)
                          │
                 usb:ds disabled, SD
                 handed back to Horizon
                          ▼
                      restored
                          │
                          ▼
                        idle
```

States, matching the issue's required lifecycle:

- **idle** — normal operation. All Forwardz SD reads/writes, app scanning,
  forwarder generation, and installation run as usual.
- **preparing** — after explicit `A`-button confirmation only. Forwardz
  must finish and block on: any in-flight forwarder generation/installation,
  the app-scan, and `forwarder-state.ts` read/writes. Only once all SD I/O
  from Forwardz has drained does it request SD quiesce and register/enable
  the `usb:ds` interface.
- **mounted** — the host sees a removable disk. Forwardz suspends *all* SD
  access completely (no scanning, no installs, no state writes) and shows a
  persistent on-screen warning ("SD card is mounted on the computer — do not
  disconnect the cable, eject the disk on your computer first"). This is
  the only state where the console does not own the SD card.
- **stopping** — triggered by explicit user stop or a clean host-initiated
  eject. Disables the `usb:ds` interface, waits for in-flight transfers to
  finish, and re-mounts the SD card for Horizon.
- **restored** — SD access has been handed back to Horizon and verified
  (a test read of a known path) before Forwardz resumes normal scanning.
  Transitions back to **idle** automatically.
- **error** — reached from any state on: unsupported firmware/runtime
  (feature-detection failure before `preparing` is even allowed to start),
  `usb:ds` init failure, or **unexpected cable removal** while `mounted`.
  On unexpected removal, Forwardz cannot know the host's filesystem cache
  state, so `error` must show explicit recovery guidance (reinsert/reboot
  guidance, and confirmation of whether the SD card is still readable)
  rather than silently trying to resume.

Feature detection (to produce the "unsupported firmware/runtime" error
instead of a broken button) would check, in order: nx.js runtime version
exposes `usb:ds` bindings, firmware version supports the required `usb:ds`
commands, and successful `usb:ds` session initialization. Any failure
short-circuits straight to **error** with a specific reason string, never
to **preparing**.

## FAT32 / exFAT and data-loss risk

- Switch SD cards are **either FAT32 or exFAT**, and both are common.
  Horizon supports FAT32 natively, while exFAT requires Nintendo's optional
  exFAT driver update. Cards larger than 32GB often arrive exFAT-formatted
  from the manufacturer, but custom-firmware setups are frequently
  reformatted to FAT32 because the Switch's exFAT support has a poor
  reliability reputation (Hekate and Atmosphère guidance generally favours
  FAT32). A future implementation must detect and mount whichever
  filesystem the card actually has — never assume one, and never reformat,
  since that destroys the user's data.
- Neither FAT32 nor exFAT is a journaling filesystem. If the cable is
  removed mid-write, or the host does not flush/eject cleanly, files being
  written at that moment (and, worst case, the filesystem's allocation
  tables) can be corrupted. This is true of any USB flash disk, but it is
  worth stating explicitly since the whole point of this feature is
  bypassing Horizon's own filesystem driver.
- "Eject before disconnecting" is not a formality: on Windows/macOS/Linux,
  ejecting flushes the host's write cache to the device. Disconnecting
  without ejecting can lose recently-written data even if the Switch side
  did everything correctly.
- Any future implementation must never begin the handoff (`preparing`
  state) while Forwardz itself has unflushed writes pending, and must refuse
  to enter `preparing` if a forwarder install or generation is in progress.

## Troubleshooting

**The screen's reason mentions the runtime version.** The copy comes from
`evaluateUsbSdAccessFeasibility()` in `src/usb-sd-access/support.ts`,
driven by `Switch.version` (`nxjs`, `libnx`, `hos`). If the console's nx.js
build ever reports version fields the function doesn't recognize, it falls
back to "Unable to determine the current runtime version." rather than
guessing support is available — this is intentional; see
`support.test.ts`.

**The `ZR` hint doesn't appear on the Backup screen.** The entry (hint
line, `ZR` handler, and route) is gated by
`USB_SD_ACCESS_EXPLANATION_ENABLED` in `src/usb-sd-access/support.ts`. If
the flag is off, the screen and its entry point are both absent by design.

**I want to actually test USB Mass Storage on hardware.** You can't yet —
that's the point of this document. There is no `preparing`/`mounted`
session to enter on the current nx.js runtime. If you're investigating
whether a newer nx.js release has closed the gap, check whether the nx.js
runtime exposes `usbDs*` native bridge calls, and update
`evaluateUsbSdAccessFeasibility` and this document together if so — do not
flip `supported` to `true` without also implementing the full lifecycle
state machine described above.

## Security notes

- No keys, console-unique identifiers, or SD contents are read, logged, or
  embedded by the USB SD Access screen or its support module. It only
  displays static explanatory text.
- If a future implementation lands, `usb:ds` device descriptors (vendor
  string, product string) must not embed console-unique data, and no
  diagnostic logging should include file paths or contents from the user's
  SD card.

## Human verification runbook

Do **not** claim on-device verification without Switch hardware. When a
console is available, a human should:

1. Build and copy the NRO: `pnpm nro`, copy `forwardz.nro` to
   `sdmc:/switch/forwardz/forwardz.nro`, launch in full application memory
   mode (not applet mode).
2. Library screen renders as before (no footer changes there in this
   tranche).
3. Open Backup: press `ZL` from the library. Confirm the Backup screen
   shows the `ZR` USB SD hint line and all existing footer hints
   (`X Y A B Plus L R ZL`) still read correctly with larger text and high
   contrast toggled on.
4. Press `ZR`: the **USB SD ACCESS** screen appears, states the feature is
   unavailable and why, and offers no start/mount action.
5. Press `B` (and separately `A`): returns to the previous screen. No SD
   activity occurs — nothing is mounted, exposed, or modified.
6. Attempting the real acceptance criteria (a computer detecting the Switch
   as a removable disk) is expected to **fail**: there is no UMS session to
   start. Record the nx.js runtime version from the screen and re-run this
   audit if it differs from 0.0.69.

Keep issue #10 open until steps 1–6 pass on hardware **and** a runtime with
`usb:ds` support exists to implement against. This tranche was verified
without hardware: `pnpm typecheck`, `pnpm lint`, and `pnpm test` only.
