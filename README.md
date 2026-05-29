# TravelTrack Card

A Lovelace custom card for [TravelTrack](https://github.com/joshndroid) — shows your daily commute brief from the TravelTrack Home Assistant integration: Leave for Work and Finishing Work departures, Plan A / Plan B status, walk-by warnings, and trackwork alerts.

## Requirements

The TravelTrack add-on and integration must already be installed and exposing the `sensor.traveltrack_*` entities (Leave for Work/Finishing Work status, early/JIT departures, shift today/tomorrow, last updated).

## Installation

### HACS (recommended)

1. In Home Assistant go to **HACS → Frontend**.
2. Open the **⋮** menu (top right) → **Custom repositories**.
3. Add `https://github.com/joshndroid/traveltrack-card` with category **Dashboard**.
4. Find **TravelTrack Card** in the list and click **Download**.
5. Reload your browser. HACS adds the dashboard resource for you — no manual resource entry needed.

### Manual

1. Copy `traveltrack-card.js` to `config/www/community/traveltrack-card/traveltrack-card.js`.
2. Go to **Settings → Dashboards → ⋮ → Resources → Add resource**:
   - **URL:** `/local/community/traveltrack-card/traveltrack-card.js`
   - **Resource type:** JavaScript Module
3. Hard-refresh the browser (Ctrl/Cmd + Shift + R).

## Usage

Add the card to a dashboard (visual editor → "TravelTrack Card", or YAML):

```yaml
type: custom:traveltrack-card
title: My Commute   # optional
```

## Configuration

| Option  | Type   | Default       | Description                |
| ------- | ------ | ------------- | -------------------------- |
| `title` | string | `My Commute`  | Heading shown on the card. |

## Troubleshooting

- **Card doesn't appear / "Custom element doesn't exist".** The JavaScript resource isn't loaded. With HACS this is automatic; if you copied the file in manually, make sure you added the resource (step 2 above) and hard-refreshed. Open the browser console — you should see a `TRAVELTRACK-CARD v1.0.1` banner once the module loads.
- **Card shows "No shift today".** That's expected when no shift is scheduled; confirm `sensor.traveltrack_shift_today` has a value.

## License

[MIT](LICENSE)
