# Official organizer sticker slot

The competition header badge reads its asset from this directory:

```
public/badges/ai-ignite-2026.svg   (or .png)
```

**This slot is intentionally empty.** The official YuNet AI Ignite 2026
sticker could not be retrieved from the build environment (no Devpost
asset access). Until the owner places the official asset here, the header
shows an honest text link badge — a clearly identified placeholder, not a
replica of the sticker and not a compliance claim.

## To activate the official sticker

1. Download the official sticker from the Devpost hackathon page
   (https://yunet-aignite26.devpost.com/) — use the organizer-provided
   asset, not a recreation.
2. Save it as `ai-ignite-2026.svg` or `ai-ignite-2026.png` in this folder.
3. If using PNG, update the two `src="/badges/ai-ignite-2026.svg"`
   references in `src/components/uraan/header.tsx` to the PNG filename.

The header probes the asset on load: when it exists, the official sticker
renders automatically (height-constrained, alt-labeled); when it does not,
the honest text badge remains. No code change or rebuild logic beyond the
asset drop is required for the SVG path.
