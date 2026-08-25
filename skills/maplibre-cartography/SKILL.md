---
name: maplibre-cartography
description: Cartographic principles for MapLibre GL JS — label and symbol legibility on imagery vs. vector basemaps, figure-ground for point icons, styling vector roads over aerial imagery, visual hierarchy, sprites and route shields, layer ordering for data injection, and accessibility. Use when styling a map, choosing text or symbol colors, making markers or roads readable on satellite/aerial imagery, setting up icons, debugging shields, or ordering layers correctly.
status: verified
---

# MapLibre Cartography

MapLibre renders exactly what you describe in your style. This skill covers how to describe it well: choosing label colors for readability on any basemap, building a coherent visual hierarchy, sourcing and self-hosting icons, and ordering style layers correctly. For font/glyph setup, see [maplibre-fonts-glyphs](../maplibre-fonts-glyphs/SKILL.md).

## When to Use This Skill

- Reviewing a style against cartographic best practices before it ships
- Choosing label `text-color` and `text-halo-color`, or point symbol/icon colors, for a new or migrated style — including cases where they read fine on a flat vector basemap but disappear or camouflage once the basemap is imagery
- Setting up `sprite` for a custom or self-hosted style (for `glyphs`, see [maplibre-fonts-glyphs](../maplibre-fonts-glyphs/SKILL.md))
- Injecting your own data layers into an existing basemap without covering labels
- Restyling roads from a light-basemap vector palette so they sit in (not on top of) imagery
- Route shields render as bare numbers or missing badges
- Auditing a style for contrast accessibility

## Basemap Type Determines Label Colors

MapLibre places labels dynamically, so you cannot mask the background behind each label as you would on a static map. Instead, choose a `text-halo-color` that separates the label from every background it might land on, and a `text-color` that reads against the halo. On a single uniform basemap tone (flat light or dark vector), the halo can match that tone instead of contrasting it — the text itself does the contrasting against the basemap. Imagery has no single tone to match, so there the halo must contrast every possible background instead:

| Basemap type                                   | Background                                                 | Recommended text color          | Recommended halo                                 |
| ---------------------------------------------- | ---------------------------------------------------------- | ------------------------------- | ------------------------------------------------ |
| Light vector (streets, OpenFreeMap positron)   | Pale/white                                                 | Dark (`#333` or similar)        | Light semi-transparent (`rgba(255,255,255,0.8)`) |
| Dark vector (dark-matter, navigation night)    | Dark                                                       | White or near-white (`#ffffff`) | Dark semi-transparent (`rgba(0,0,0,0.75)`)       |
| Satellite or aerial imagery (NAIP, Sentinel-2) | Unpredictable — bright crops, dark forests, urban rooftops | White (`#ffffff`)               | **Dark semi-transparent (`rgba(0,0,0,0.75)`)**   |

The most common mistake is a white halo with no transparency: unless the background is pure white, it disrupts the spatial connection between the label and the feature it labels — add transparency. The second is reusing a light-vector palette over imagery, where it fails on dark terrain, forests, and water. **On imagery, always use white text and a dark semi-transparent halo** (`"text-color": "#ffffff"`, `"text-halo-color": "rgba(0,0,0,0.75)"`, `"text-halo-width": 1.2`).

For tinted labels (parks, water, POIs), use a light tint of the semantic color (`#c8f5cc` parks, `#a8d8ff` water) rather than the dark saturated version: tints read against dark halos while keeping semantic meaning, where full-saturation colors contrast poorly at small sizes.

### Halo width

Wider halos increase legibility but add visual weight. Typical values:

| Context                               | `text-halo-width` |
| ------------------------------------- | ----------------- |
| Body labels (city, town, village)     | 0.8–1.5           |
| Country / continent (large text)      | 1.5–2.0           |
| Small POI or peak labels              | 0.8–1.2           |
| Water / park labels with colored text | 1.0–1.5           |

`text-halo-width` is in pixels relative to the text. The halo must not bleed into adjacent labels: keep it tight at small text sizes and add transparency.

## Point Symbols and Icons on Imagery

Markers face the same figure-ground problem as labels, but with different tools. A colored icon on aerial imagery competes with an unpredictable, busy, _desaturated_ photographic background.

- **You cannot separate a symbol from a background that owns its hue.** A green icon over green parkland, a brown icon over bare soil: both camouflage. Most aerial imagery is low-saturation, so the axis the background is weakest on is **chroma**. A saturated fill (amber, terracotta) separates while still reading as a natural, earthy color. Shifting hue alone, toward a different earth tone, does not help if that hue is also in the scene.
- **Carve the symbol out with `icon-halo-color`/`icon-halo-width`**, exactly as you would halo a label — this only affects SDF sprite images (`addImage(..., { sdf: true })` or a sprite built as SDF); a full-color raster icon has no halo paint property, so any edge treatment on it has to be baked into the artwork itself. A thin light halo reads against dark canopy and water; a darker edge holds against bright soil and rooftops. Keep it thin — a fat ring reads as a sticker — except for the one class of symbol meant to dominate the map (an emergency marker, the single most important thematic feature), where a heavier ring is the point.
- **Flat fills read as stickers on a photo.** Give landform or 3D symbols dimensional cues. A gradient (lighter on the lit slope, darker on the shaded slope) models form. A _contact shadow_, a blurred flattened ellipse pooled under the base, anchors the symbol to the ground far better than an offset drop-shadow, which makes it look like it floats. Match the symbol's lighting and shadow direction to the basemap's `hillshade-illumination-direction` (commonly NW, 315°) so the symbol sits in the same light as the terrain.

**SVG icons via `addImage`:** when loading an SVG into a sprite image at runtime (fetch the SVG, decode it as an `Image`, then `map.addImage`), the SVG rasterizes at decode time, so `linearGradient` and `feDropShadow` filters bake in correctly.[1] Two gotchas: pad the `viewBox` so halos and shadows are not clipped at the icon edge, and keep `width`/`height` proportional to the `viewBox` or the glyph distorts. Use `"icon-allow-overlap": true` for dense point data.

## Visual Hierarchy

A well-ordered hierarchy means the most important features dominate at the appropriate zoom level — for labels and for line/polygon data layers alike. For labels, MapLibre controls hierarchy through text size, font weight, letter spacing, contrast, and zoom-range visibility. The same tools apply to lines and polygons: `line-width` and fill saturation stand in for text size, and contrast against the basemap (a saturated line on a muted background, a muted fill on a busy one) does as much hierarchy work as size does — see [Styling Vector Roads Over Imagery](#styling-vector-roads-over-imagery) below for the line/polygon case in detail.

### Text size by feature class

Text size should decrease as feature importance decreases. These stops are a starting point; adjust for your tile schema and zoom range:

| Label type       | Base zoom | Max zoom | Size range (px) |
| ---------------- | --------- | -------- | --------------- |
| Continent        | 1         | 4        | 14–20           |
| Country          | 2         | 7        | 11–17           |
| City             | 7         | 11       | 14–24           |
| Town             | 10        | 14       | 11–16           |
| Village / hamlet | 11        | 16       | 10–14           |
| Airport / POI    | 10        | 16       | 12–14           |
| Peak / summit    | 8         | 13       | 10–11           |

Points of interest (POI) labels should be visually lighter (smaller, thinner weight) than settlement labels at the same zoom. On an imagery map showing gentle terrain like rolling hills, keep peak labels smaller than airport labels — these are elevation markers, not dominant landmarks.

### Font weight

Use font weight to reinforce hierarchy via `text-font` (e.g. `["Noto Sans Bold"]`): **Bold** for countries and capital cities, **Regular** for towns, cities, and most labels, _Italic_ for water bodies, parks, and regions (a cartographic convention no longer always observed).

### Multi-line labels

For compact two-line labels (e.g. a symbol character above a name), reduce `text-line-height` below 1.0 to avoid excessive spacing:

```json
{
  "text-field": "△\n{name:latin}",
  "text-line-height": 0.9,
  "text-max-width": 8
}
```

Values around 0.9 produce tight, readable two-line labels at small sizes. Do not go below ~0.8 or lines will overlap at standard font sizes.

### Text transform and spacing

- Use `"text-transform": "uppercase"` for country and continent labels — a conventional cartographic practice
- Use `"text-letter-spacing": 0.05–0.1` for region labels to spread them across a territory

## Styling Vector Roads Over Imagery

Vector road palettes from light-basemap styles (OSM Bright, OSM Liberty) are tuned to pop against pale paper, using high saturation, warm hues, and full opacity. Those same properties compete with the photo once the basemap is imagery. Treat the imagery as the subject and the roads as a reference overlay layered on top of it, not the other way around.

- **Desaturate hard.** Move fills and casings toward neutral greys or muted tones. The bright orange/yellow road hierarchy (`#f90`, `#fd4`, `#b06010`) is the most common offender; replace fills with light greys and casings with a darker grey or a deep same-hue color.
- **Keep hierarchy in width and value, not hue.** The width ramps already encode motorway > residential; you do not need loud color to say it.
- **Opaque, not transparent.** Semi-transparent roads let imagery texture bleed through and flatten the whole map. Prefer opaque fills with a value-contained casing for crisp, layered roads.
- **The casing contains the road.** A casing darker than the fill draws the median line that keeps dual carriageways from merging into one blob. A _knockout casing_, a deeper shade of the fill's own hue rather than a foreign black, defines the edge without a harsh cartoon outline.
- **Control brightness by zoom.** Roads tuned at high zoom often read too heavy at the opening (low) zoom, where only thin major roads show and the casing dominates. Interpolate color by zoom: casing dark at low zoom lightening as you zoom in, fills the lightest element brightening as the network fills in.

```json
{
  "line-color": ["interpolate", ["linear"], ["zoom"], 10, "#454545", 12, "#5a5a5a", 14, "#6e6e6e"]
}
```

## Sprites: Icons and Markers

The style's `sprite` value is a **base URL with no file extension** (e.g. `https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite`, for testing purposes only, do not use in production); MapLibre appends `.json`, `.png`, and `@2x` variants itself. Symbol layers reference sprite images by ID with `icon-image`; the value must exactly match an ID in the sprite JSON index or the icon is silently not rendered.

### Self-hosted sprites

To avoid third-party dependencies, copy an existing sprite directory (PNG + JSON, plus any @2x files) from a style or tileset provider and host it under your own domain, pointing the style's `sprite` property at its base URL. Always check the provider's license before republishing and add attribution if required.

Host sprite assets on a static host you control (GitHub Pages, Netlify, Vercel, S3, same origin as the style). **Do not point production styles at `raw.githubusercontent.com`** Raw is for serving repository blobs, not production assets: anonymous requests are aggressively rate-limited so real users see intermittent HTTP 429s [2], caching is fixed at five minutes with no control, there is no SLA, and private-repo URLs return 404 to everyone but authenticated collaborators (it works for you while logged in, then fails for every other user) [3].

### Building a sprite from SVGs

Generate sprite assets from a directory of SVGs with tools such as [spritezero](https://github.com/mapbox/spritezero), [spreet](https://github.com/flother/spreet), or [Martin](https://maplibre.org/martin/sources-sprites/).

Useful icon sources include [Maki](https://github.com/mapbox/maki) and [Temaki](https://github.com/ideditor/temaki). These are common source repositories for map-style SVG icons, but check each repository's license before republishing derived sprite assets.

### Creating your own icons

For a small number of custom icons, `map.loadImage()` and `addImage()` can work without a full sprite pipeline. For larger reusable icon sets, generating a sprite remains the standard and more maintainable approach. [10]

### Broken route shields

Broken-looking route shields (bare floating numbers, missing badges) are almost always a **missing sprite image**. The shield number is text (font) and usually renders fine; the badge behind it is an `icon-image` from the sprite. Diagnose in this order:

1. **Confirm glyphs load.** Probe the `glyphs` server for the exact `text-font` names and expect HTTP 200. If they 200, the font is not the problem.
2. **Confirm the sprite carries the shield images.** OpenMapTiles and OSM Liberty shield style layers use `icon-image: "{network}_{ref_length}"` for known networks (e.g. `us-interstate_2`, `us-highway_3`, `us-state_2`) and `road_{ref_length}` for generic refs. A missing icon is silently omitted, so grep the sprite JSON for those keys.

Not every sprite carries shields localized for the US, so grep the sprite JSON for the `{network}_{ref_length}` keys before assuming they exist. Both the `demotiles.maplibre.org/styles/osm-bright-gl-style/sprite` and `openmaptiles.github.io/osm-bright-gl-style/sprite` sheets currently include `us-interstate_*`, `us-highway_*`, and `us-state_*` (alongside the generic `road_1`–`road_6`), but a minimal or custom sprite may ship only the generic `road_*`. If yours lacks the shield images and your tiles populate `network`, `ref`, and `ref_length` (the OSM US OpenMapTiles tiles do), point `sprite` at one that has them — the `{network}_{ref_length}` style layers then resolve with no layer edits.

## Style Layer Ordering

MapLibre renders style layers in the order they appear in the style's `layers` array — first item is drawn first (bottom), last is drawn last (top). Getting this wrong is the most common cause of data layers obscuring basemap labels.

### The injection pattern

When adding your own data to an existing basemap style at runtime, insert your data layers **before the first symbol layer** (find it with `map.getStyle().layers.find((l) => l.type === 'symbol')?.id` and pass it as the second argument of `addLayer`) so your geometry renders under labels. Without that argument the data layer goes above everything, including labels.

### Canonical style layer order for custom styles

When building a style from scratch, follow this ordering bottom to top:

1. `background`
2. Raster imagery (if using satellite/aerial source)
3. Hillshade layers (if any — see [maplibre-terrain-patterns](../maplibre-terrain-patterns/SKILL.md) for configuration)
4. Terrain fill (water, land, parks — polygon layers)
5. Line layers (roads, boundaries, rivers)
6. Your data polygon and line layers
7. The basemap's own symbol layers (place labels, road labels)
8. Your data symbol/label layers (if any)

Hillshade sits directly above raster imagery and below all vector layers, with sufficient transparency to allow the imagery to show through. If you add transparency to the imagery and layer it over the hillshade, the imagery will appear faded or washed out. Hillshade applied over vector layers will make line and fill colors look blotchy, blurry or muted.

## Accessibility

MapLibre styles are rendered in the browser as a WebGL canvas. Accessibility considerations:

- **Text contrast:** WCAG 2.1 AA requires 4.5:1 for normal text, 3:1 for large.[9] White text on a `rgba(0,0,0,0.75)` halo satisfies this for most backgrounds — check the **combined text+halo color**, not the text alone, with a tool like the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).
- **Do not rely on color alone:** use shape, size, or pattern in addition to hue.
- **Minimum label size:** prefer size stops that start at 10px even at low zoom.
- **Screen readers and the WebGL canvas:** MapLibre's canvas is not inherently accessible to screen readers. For accessible map experiences, provide an accessible alternative such as a data table or a text description of the map contents, and use [maplibre-gl-accessibility](https://github.com/maplibre/maplibre-gl-accessibility) for keyboard navigation and ARIA roles.

## Related Skills

- [**maplibre-fonts-glyphs**](../maplibre-fonts-glyphs/SKILL.md) — Setting up the `glyphs` URL, self-hosting or generating font PBFs, the GL JS local-font fallback, MapLibre Native's `font-faces`, and non-Latin script support.
- [**maplibre-tile-sources**](../maplibre-tile-sources/SKILL.md) — Choosing between GeoJSON and tiles for a dataset.
- [**maplibre-source-wiring**](../maplibre-source-wiring/SKILL.md) — Sprites and source configuration.
- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md) — Serving imagery (raster) and terrain sources from PMTiles files.
- [**maplibre-terrain-patterns**](../maplibre-terrain-patterns/SKILL.md) — Hillshade configuration, multi-pass techniques, 3D terrain, DEM sources.

## References

1. [**`Map.addImage()` (MapLibre GL JS API)**](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addimage)
2. [**Unauthenticated rate limits on `raw.githubusercontent.com` (GitHub Community Discussion)**](https://github.com/orgs/community/discussions/159123) — anonymous requests are rate-limited; production traffic sees intermittent HTTP 429
3. [**`raw.githubusercontent.com` and private repositories (GitHub Community Discussion)**](https://github.com/orgs/community/discussions/69281) — private-repo raw URLs return 404/403 to anonymous requests

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
