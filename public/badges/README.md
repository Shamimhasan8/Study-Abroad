# Official organizer sticker

The competition header badge reads its asset from this directory:

```
public/badges/ai-ignite-2026.png        (displayed — identity crop)
public/badges/ai-ignite-2026-original.png (unmodified 300×300 original)
```

**The official YuNet AI Ignite Buildathon 2026 sticker is present.** It
was retrieved on 2026-11-05 from the organizer's event page
(https://yunet-aignite26.devpost.com/ — the challenge thumbnail published
by the organizers on the Devpost CDN). Provenance, licence basis, and the
crop rationale are documented in `docs/ASSET_PROVENANCE.md`.

## Why two files?

- `ai-ignite-2026-original.png` — the exact organizer download, untouched.
- `ai-ignite-2026.png` — a crop of the original limited to the identity
  band (head-profile icon + "AIgnite" wordmark). The full lockup is
  illegible at header sizes; the implementation prompt requires a
  **readable** placement in both shells, so the header displays the
  identity band while the original ships alongside it.

## How rendering works

The sticker's availability is probed **server-side** by
`/api/capabilities` (an fs check on this directory, cached ~10 minutes)
and flows to the header through the app store. When the asset exists,
the official sticker renders automatically (height-constrained,
alt-labeled, linking to the event page); when it does not, the honest
text-pill badge remains — never a replica. The header never requests a
missing asset, so an empty slot produces no 404 noise in server logs or
the browser console.

To replace the artwork with a different official version, overwrite both
files (keep the same names) — no code change needed.
