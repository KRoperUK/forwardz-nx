# Settings export/import

Personal library organisation (hidden apps, favourites, metadata overrides,
and preferences) lives in one versioned JSON document so it can move to
another SD card or console by copying a single file.

## Locations

- Live organisation: `sdmc:/switch/forwardz/state.json` (hidden apps and
  per-app overrides, written as you use the app).
- Last export/import document and preferences:
  `sdmc:/switch/forwardz/settings.json`.
- Automatic pre-import backup:
  `sdmc:/switch/forwardz/settings-backup.json`.
- Portable copy: `sdmc:/forwardz-settings.json` (SD root, written by
  Export on the backup screen, easy to find over USB/MTP).

## Format (version 1)

```json
{
  "version": 1,
  "hiddenPaths": ["sdmc:/switch/hidden-game.nro"],
  "favourites": ["sdmc:/switch/favourite-game.nro"],
  "overrides": {
    "sdmc:/switch/favourite-game.nro": {
      "name": "My Title",
      "author": "Homebrew Dev",
      "version": "1.2.0",
      "favourite": true,
      "iconPath": "sdmc:/switch/icons/custom.jpg"
    }
  },
  "preferences": {
    "largerText": false,
    "highContrast": false,
    "seenWalkthrough": true
  }
}
```

- `hiddenPaths`: NRO paths hidden from the library views.
- `favourites`: paths starred in the Edit screen; derived from overrides
  on export, so the two can never disagree.
- `overrides`: per-app metadata keyed by NRO path. All fields are optional;
  unknown fields are ignored on import for forward compatibility.
- `preferences`: accessibility and onboarding flags.

Console-specific secrets and `prod.keys` are never part of the document —
there is no field for them, so an export is safe to share.

## Import rules

1. The file must be valid JSON with `"version": 1`. Anything else fails
   with a reason and leaves current settings untouched.
2. Unknown fields are ignored; malformed entries are dropped.
3. Staging an import shows what changes before anything is replaced.
4. Confirming writes the current settings to `settings-backup.json`
   first, so a bad import rolls back from the backup screen.
