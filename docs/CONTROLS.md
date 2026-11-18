# Controls

Every action in Forwardz is reachable with a controller — no touch or tiny
text required. Each screen also lists its own controls in the footer; the
canonical table lives in `src/accessibility.ts` (`CONTROLLER_MAP`) and the
screens render from it.

## Library

| Button | Action |
| --- | --- |
| Stick / D-pad | Move selection |
| A | Configure forwarder |
| B | Back |
| X | Open file picker |
| Y | Hide or show app |
| L / R | Previous / next view |
| Minus | Batch mode |
| ZR | Refresh library |
| ZL | Backup screen |
| Plus | Exit |

In batch mode, A toggles selection, X reviews the queue, and Minus is done.

## Edit

| Button | Action |
| --- | --- |
| Up / Down | Move between fields |
| A | Import icon / toggle favourite (on those rows) |
| X | Install forwarder |
| Y | Save forwarder |
| B | Back |

Installing over an already-installed title asks twice: the first press
arms the replacement, the second confirms it.

## Backup

| Button | Action |
| --- | --- |
| X | Export settings |
| Y | Import settings |
| A | Confirm replace / restore |
| B | Back |
| L | Toggle larger text |
| R | Toggle high contrast |
| ZL | Replay walkthrough |
| ZR | USB SD access info |
| Plus | Exit |

## Keys and walkthrough

On the keys screen, X retries detection after copying `prod.keys` — no
restart needed. The first-run walkthrough advances with A, goes back with
B, and skips with Plus.
