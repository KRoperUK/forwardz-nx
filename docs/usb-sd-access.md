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
would be required if the runtime gap is ever closed.

## What "Hekate-style UMS" actually requires

Hekate can expose the raw SD card as a USB disk because it runs **before**
Horizon boots. There is no filesystem driver, no running OS, and no
concurrent owner to conflict with. It is not a homebrew app, it is a
bootloader that hasn't handed control to Horizon yet.

A Nintendo Switch homebrew NRO is a normal Horizon userland process launched
from the Homebrew Menu. To present the SD card as a USB disk from inside an
NRO, three things would all need to be true at once:

1. **A USB gadget/device-mode stack.** The console's USB port would need to
   stop acting as a host (or stop using `usb:hs` client APIs) and instead
   register a Mass Storage Class (MSC) gadget with the host PC using
   `usb:ds`, including device/configuration/interface/endpoint descriptors
   and a Bulk-Only Transport (BOT) driver implementing the SCSI command set
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

### nx.js runtime (0.0.69, `@nx.js/runtime`)

Confirmed by reading the nx.js source
(`packages/runtime/src/navigator/usb.ts` and `packages/runtime/src/switch/`
in [TooTallNate/nx.js](https://github.com/TooTallNate/nx.js)):

- `navigator.usb` (`USB`/`USBDevice`) wraps libnx's **`usb:hs`** host-mode
  service. Its native bridge calls are `usbInit`, `usbGetDevices`,
  `usbDeviceOpen`/`usbDeviceClose`, `usbClaimInterface`, `usbTransferIn`/
  `usbTransferOut`, `usbControlTransferIn`, `usbResetDevice`. This is the
  WebUSB-style API Forwardz's existing USB-adjacent code (and any future
  companion-app USB transfer feature) would use: the Switch acting as a USB
  **host**, talking to an attached peripheral. It is unrelated to exposing
  the Switch itself as a mass-storage device to a PC.
- There is no `usbDs*` binding anywhere in the runtime. Searching the
  runtime source and the native bridge type surface (`packages/runtime/src/$.ts`)
  turns up no device-mode, gadget, endpoint-registration, or block-device
  primitives at all.
- There is no API to unmount/remount `sdmc:` from JavaScript, and no API to
  get exclusive/raw block access to the SD card bypassing the FAT driver.

### devkitPro / libnx toolchain

Confirmed by reading the installed libnx headers
(`C:\devkitPro\libnx\include\switch\services\usbds.h`) that ship with the
devkitPro SwitchDev toolchain used to build the NRO:

- libnx **does** provide a complete native C API for `usb:ds`
  (`usbDsInitialize`, `usbDsRegisterInterface`, `UsbDsInterface`,
  `UsbDsEndpoint`, `usbDsInterface_CtrlInPostBufferAsync`, and so on). This
  is the same primitive that community tools such as
  [libusbhsfs](https://github.com/DarkMatterCore/libusbhsfs) (host-mode UMS
  client) and nxdumptool's custom device-mode USB protocol build on.
- Critically, this is a **native C API**. Using it means writing native
  code, exposing new bindings through nx.js's native bridge (`$`), and
  rebuilding the nx.js runtime itself — this is not something an
  application author can wire up from `src/` alone. It is a change to the
  runtime Forwardz depends on, upstream of this repository.

### Existing Forwardz USB code

There is no USB Mass Storage code in this repository today. The only
USB-adjacent surface is `navigator.usb` (host-mode WebUSB), which Forwardz
does not currently use anywhere in `src/`. `src/ipc/spl.ts` is the one
example in this codebase of talking to a native Horizon service directly
(`new Switch.Service('spl:mig')` plus hand-written `dispatchInOut` command
wrappers) — the same low-level pattern a hypothetical `usb:ds` binding would
need, but wiring it up requires the service call surface to actually work
for gadget-mode IPC, which in turn depends on native runtime support that
does not exist yet either (see above: `Switch.Service.dispatchInOut` is a
`stub()` in the current runtime source and has no gadget/event/buffer
transfer support wired in for USB roles).

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

- A controller-first **USB SD Access** screen (`/usb-sd-access`), reachable
  from the library screen via a dedicated `ZL` footer entry (see
  `src/routes/Select.tsx`).
- The screen states plainly that the feature is unavailable on the current
  runtime, why (summarized from this document), and what would need to
  change for it to become possible.
- It does not offer a fake "start" action, and it does not touch the SD
  card, gamepad state machine, or any lifecycle beyond display and simple
  `A`/`B` dismissal, matching the "no fake button" requirement.
- The screen's copy and the reasoning behind it are backed by
  `src/usb-sd-access/support.ts`, a small pure module so the "why" logic has
  unit tests independent of the react-tela rendering.
- The screen's geometry is computed by `src/usb-sd-access/layout.ts` from
  measured, wrapped text rather than fixed pixel offsets. react-tela
  positions every entity absolutely, so stacked blocks of wrapping text will
  silently overlap if their heights are assumed instead of measured. The
  layout is unit tested to confirm the panel stays inside the 1280x720
  screen, detail rows never overlap, and the closing note never collides
  with the footer bar — including when the explanation text grows.

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
  the app-scan (`apps.ts`'s module-level scan would need to become
  re-entrant/cancellable instead of load-time-only), and
  `forwarder-state.ts` read/writes. Only once all SD I/O from Forwardz has
  drained does it request SD quiesce and register/enable the `usb:ds`
  interface.
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
  rather than silently trying to resume. This satisfies the "cable loss
  leaves the console in a recoverable state" requirement: the console never
  crashes or leaves `sdmc:` in a half-mounted state, but it also does not
  pretend everything is fine.

Feature detection (to produce the "unsupported firmware/runtime" error
instead of a broken button) would check, in order: nx.js runtime version
exposes `usb:ds` bindings, firmware version supports the required `usb:ds`
commands (`RegisterInterface`/`EnableDevice` availability differs across
firmware ranges per
[switchbrew.org/wiki/USB_services](https://switchbrew.org/wiki/USB_services)),
and successful `usb:ds` session initialization. Any failure short-circuits
straight to **error** with a specific reason string, never to **preparing**.

## FAT32 / exFAT and data-loss risk

- The Switch's SD card is typically formatted **exFAT** by Horizon (FAT32
  only on very small/old cards). A future implementation must mount using
  the filesystem the card actually has; forcing FAT32 would require
  destructive reformatting and must never happen automatically.
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
- Any future implementation must never begin the handoff (`preparing` state)
  while Forwardz itself has unflushed writes pending, and must refuse to
  enter `preparing` if a forwarder install or generation is in progress.

## Troubleshooting

**"USB SD Access" shows a different reason than expected.** The screen's
reasoning comes from `evaluateUsbSdAccessFeasibility()` in
`src/usb-sd-access/support.ts`, driven by `Switch.version` (`nxjs`, `libnx`,
`hos`). If the console's nx.js build ever reports version fields the
function doesn't recognize, it falls back to "Unable to determine the
current runtime version." rather than guessing support is available — this
is intentional; see the unit tests in `support.test.ts`.

**The `ZL` hint doesn't appear on the library screen.** Footer hints are
laid out by `layoutFooterItems()` (`src/layout/footer.ts`) from measured
label widths, so they cannot overlap. If a hint is missing entirely, check
that it is present in the `actions` array passed to `<Footer>` in
`Select.tsx`. If hints look cramped, the layout has shrunk the gap to fit;
`layoutFooterItems` returns `overflows: true` when even the minimum gap
doesn't fit, which indicates too many or too long hints for the screen
width.

**I want to actually test USB Mass Storage on hardware.** You can't yet —
that's the point of this document. There is no `preparing`/`mounted` session
to enter on the current nx.js runtime. If you're investigating whether a
newer nx.js release has closed the gap, check whether
`packages/runtime/src/navigator/usb.ts` (or a new module) in
[TooTallNate/nx.js](https://github.com/TooTallNate/nx.js) exposes `usbDs*`
native bridge calls, and update `evaluateUsbSdAccessFeasibility` and this
document together if so — do not flip `supported` to `true` without also
implementing the full lifecycle state machine described above.

## Security notes

- No keys, console-unique identifiers, or SD contents are read, logged, or
  embedded by the USB SD Access screen or its support module. It only
  displays static explanatory text.
- If a future implementation lands, `usb:ds` device descriptors (vendor
  string, product string) must not embed console-unique data, and no
  diagnostic logging should include file paths or contents from the user's
  SD card.
