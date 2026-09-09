---
name: maplibre-sprites-icons
description: Sprites and icon images for MapLibre GL JS — the style's `sprite` base URL, loading several sheets at once with the `{id, url}` array form, self-hosting sprite assets, building a sprite from SVGs, registering images at runtime with `addImage`, and diagnosing route shields that render as bare numbers. Use when a symbol layer's icons never appear, when adding your own icons to a style whose sprite you do not control, when setting up or self-hosting a sprite, or when shields are missing their badge.
status: verified
---

# MapLibre Sprites and Icons

Every icon a symbol layer draws comes from a **sprite** — a PNG atlas plus a JSON index served from the style's `sprite` URL — or from an image registered at runtime with `addImage`. This skill covers where those images come from, how one style loads more than one sheet, how to host or build your own, and why a route shield loses its badge. For icon color, halos, and figure-ground against imagery, see [maplibre-cartography](../maplibre-cartography/SKILL.md); for text and glyph setup, see [maplibre-fonts-glyphs](../maplibre-fonts-glyphs/SKILL.md).

## When to Use This Skill

- A symbol layer's icons silently do not render
- Setting up `sprite` for a custom or self-hosted style (for `glyphs`, see [maplibre-fonts-glyphs](../maplibre-fonts-glyphs/SKILL.md))
- Adding your own icon sheet to a style whose `sprite` you do not control
- Self-hosting sprite assets, or generating a sprite from a directory of SVGs
- Adding a handful of custom images at runtime instead of rebuilding a sprite
- Route shields render as bare numbers or missing badges
- Writing tooling that reads or generates symbol layers and has to recognize a shield

## The `sprite` value is a base URL

The style's `sprite` value is a **base URL with no file extension** (e.g. `https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite`, for testing purposes only, do not use in production); MapLibre appends `.json`, `.png`, and `@2x` variants itself.[1] Symbol layers reference sprite images by ID with `icon-image`; the value must exactly match an ID in the sprite JSON index or the icon is silently not rendered.

## Multiple sprite sheets in one style

`sprite` is not limited to a single string. Since MapLibre GL JS 3.0 ([#1805](https://github.com/maplibre/maplibre-gl-js/pull/1805)) it also accepts an **array of `{id, url}` objects**,[1] so a style can load its own icons alongside a basemap provider's sheet without merging the two. Use the array form whenever you are adding icons to a style whose sprite you do not control — merging sheets, or falling back to `addImage()` for everything, is the workaround for a limit that no longer exists.

```json
{
  "sprite": [
    { "id": "default", "url": "https://tiles.openfreemap.org/sprites/ofm_f384/ofm" },
    { "id": "my-icons", "url": "https://example.com/sprites/poi" }
  ]
}
```

Rules that follow from that form:

- **Reference images by `id:image-name`** — `"icon-image": "my-icons:cafe"`. An unprefixed `"cafe"` resolves against the `default` sheet only.
- **The `id` `default` is the one exception**: its images take no prefix, which is what keeps an existing style's `icon-image` values working when you convert its string `sprite` to the array form. Give the basemap's sheet `id: "default"` and the shield and POI layers already in the style keep resolving unchanged.
- **All ids and all URLs must be unique.** Duplicates are a validation error (`all the sprites' ids must be unique, but <id> is duplicated`), not a last-one-wins merge.
- **Each URL is still extension-less** — MapLibre appends `.json`, `.png`, and the `@2x` variants per entry, exactly as for the string form.
- ✅ `{ "id": "my-icons", "url": "https://example.com/sprites/poi" }` → `"icon-image": "my-icons:cafe"`
- ❌ `{ "id": "my-icons", "url": "https://example.com/sprites/poi.json" }` → requests `poi.json.json`
- ❌ Typing `sprite` as `string` in your own tooling: an array value stringifies to `[object Object]`, and the loader rejects it with `Invalid sprite URL "[object Object]", must be absolute`. Handle both shapes wherever you read a style's `sprite`.

## Self-hosted sprites

To avoid third-party dependencies, copy an existing sprite directory (PNG + JSON, plus any @2x files) from a style or tileset provider and host it under your own domain, pointing the style's `sprite` property at its base URL. Always check the provider's license before republishing and add attribution if required.

Host sprite assets on a static host you control (GitHub Pages, Netlify, Vercel, S3, same origin as the style). **Do not point production styles at `raw.githubusercontent.com`** Raw is for serving repository blobs, not production assets: anonymous requests are aggressively rate-limited so real users see intermittent HTTP 429s [5], caching is fixed at five minutes with no control, there is no SLA, and private-repo URLs return 404 to everyone but authenticated collaborators (it works for you while logged in, then fails for every other user) [6].

## Building a sprite from SVGs

Generate sprite assets from a directory of SVGs with tools such as [spritezero](https://github.com/mapbox/spritezero), [spreet](https://github.com/flother/spreet), or [Martin](https://maplibre.org/martin/sources-sprites/).

Useful icon sources include [Maki](https://github.com/mapbox/maki) and [Temaki](https://github.com/ideditor/temaki). These are common source repositories for map-style SVG icons, but check each repository's license before republishing derived sprite assets.

## Runtime images with `addImage`

For a small number of custom icons, `map.loadImage()` and `addImage()` can work without a full sprite pipeline.[3] For larger reusable icon sets, generating a sprite remains the standard and more maintainable approach.

`addImage`'s options carry the same per-image metadata the sprite index does — `pixelRatio`, `sdf`, `stretchX`, `stretchY`, and `content` — so a runtime image can be an SDF (which `icon-color` and `icon-halo-color` then apply to) or a stretchable badge, exactly like one baked into a sheet.[3]

## Broken route shields

Broken-looking route shields (bare floating numbers, missing badges) are almost always a **missing sprite image**. The shield number is text (font) and usually renders fine; the badge behind it is an `icon-image` from the sprite. Diagnose in this order:

1. **Confirm glyphs load.** Probe the `glyphs` server for the exact `text-font` names and expect HTTP 200. If they 200, the font is not the problem.
2. **Confirm the sprite carries the shield images.** OpenMapTiles and OSM Liberty shield style layers use `icon-image: "{network}_{ref_length}"` for known networks (e.g. `us-interstate_2`, `us-highway_3`, `us-state_2`) and `road_{ref_length}` for generic refs. A missing icon is silently omitted, so grep the sprite JSON for those keys.

Not every sprite carries shields localized for the US, so grep the sprite JSON for the `{network}_{ref_length}` keys before assuming they exist. Both the `demotiles.maplibre.org/styles/osm-bright-gl-style/sprite` and `openmaptiles.github.io/osm-bright-gl-style/sprite` sheets currently include `us-interstate_*`, `us-highway_*`, and `us-state_*` (alongside the generic `road_1`–`road_6`), but a minimal or custom sprite may ship only the generic `road_*`. If yours lacks the shield images and your tiles populate `network`, `ref`, and `ref_length` (the OSM US OpenMapTiles tiles do), point `sprite` at one that has them — the `{network}_{ref_length}` style layers then resolve with no layer edits.

**What makes a symbol a shield is `icon-text-fit`.** A shield is an icon scaled around its text, and `icon-text-fit` is the property that does that scaling: `"both"` (or `"width"`) with `icon-text-fit-padding` sizes one badge image to whatever number lands on it, so `I-5` and `I-405` both fit. Its default is `none`,[2] so a value other than `none` is the reliable signal when you are auditing or generating shield layers — not `text-anchor` (which defaults to `center`, so its absence tells you nothing) and not the sprite image name (an authoring convention that varies by style). Pair it with a **stretchable** sprite image (`stretchX`/`stretchY` + `content` in the sprite JSON)[1] so the badge's border stays undistorted as it widens; a shield without `icon-text-fit` renders the badge at its intrinsic size and wide refs overflow it.

```json
{
  "layout": {
    "icon-image": "us-interstate_{ref_length}",
    "icon-text-fit": "both",
    "icon-text-fit-padding": [1, 4, 1, 4],
    "text-field": "{ref}"
  }
}
```

When reading layout values back out of a style, remember they are not always strings: `symbol-placement` and friends can hold an expression or a legacy `{stops: [...]}` zoom function, so `layout['symbol-placement'] === 'point'` silently skips those layers. Test the value's shape before comparing it.

## Related Skills

- [**maplibre-cartography**](../maplibre-cartography/SKILL.md) — Icon color, `icon-halo-color`/`icon-halo-width`, and figure-ground for point symbols on aerial imagery; style layer ordering.
- [**maplibre-fonts-glyphs**](../maplibre-fonts-glyphs/SKILL.md) — The `glyphs` URL, font PBFs, and the GL JS local-font fallback; the text half of a shield.
- [**maplibre-source-wiring**](../maplibre-source-wiring/SKILL.md) — Where `sprite` sits among a style's other root properties, and CORS for self-hosted assets.
- [**maplibre-v6-migration**](../maplibre-v6-migration/SKILL.md) — `styleimagemissing` is notify-only in v6; `setMissingStyleImageResolver` is how a v6 map supplies an `icon-image` that is not in the sheet.

## References

1. [**Style Spec: `sprite`**](https://maplibre.org/maplibre-style-spec/sprite/) — the string and `{id, url}` array forms, image-name prefixing, the `default` id, and the sprite index file's `content`, `stretchX`/`stretchY`, and `textFitWidth`/`textFitHeight` fields
2. [**Style Spec: symbol layer layout properties**](https://maplibre.org/maplibre-style-spec/layers/#icon-text-fit) — `icon-text-fit` values (`none` default, `width`, `height`, `both`) and `icon-text-fit-padding`
3. [**`Map.addImage()` (MapLibre GL JS API)**](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addimage)
4. [**MapLibre GL JS CHANGELOG**](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md) — "Add support for multiple `sprite` declarations in one style file" ships in 3.0.0
5. [**Unauthenticated rate limits on `raw.githubusercontent.com` (GitHub Community Discussion)**](https://github.com/orgs/community/discussions/159123) — anonymous requests are rate-limited; production traffic sees intermittent HTTP 429
6. [**`raw.githubusercontent.com` and private repositories (GitHub Community Discussion)**](https://github.com/orgs/community/discussions/69281) — private-repo raw URLs return 404/403 to anonymous requests

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
