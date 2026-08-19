---
name: maplibre-cartography
description: Cartographic principles for MapLibre GL JS — label and symbol legibility on imagery vs. vector basemaps, figure-ground for point icons, styling vector roads over aerial imagery, visual hierarchy, typography (glyphs/font stacks), sprites and route shields, layer ordering for data injection, and accessibility. Use when styling a map, choosing text or symbol colors, making markers or roads readable on satellite/aerial imagery, setting up fonts or icons, debugging shields, or ordering layers correctly.
status: verified
---

# MapLibre Cartography

MapLibre renders exactly what you describe in your style JSON. This skill covers how to describe it well: choosing label colors for readability on any basemap, building a coherent visual hierarchy, sourcing and self-hosting fonts and icons, and ordering layers correctly.

## When to Use This Skill

- Choosing label `text-color` and `text-halo-color` for a new or migrated style
- Map labels are hard to read against a background (imagery, dark basemap, complex vector)
- Setting up `glyphs` and `sprite` for a custom or self-hosted style
- Injecting your own data layers into an existing basemap without covering labels
- Making point symbols, markers, or custom icons readable on satellite/aerial imagery
- Restyling roads from a light-basemap vector palette so they sit in (not on top of) imagery
- Route shields render as bare numbers or missing badges
- Auditing a style for contrast accessibility

## Basemap Type Determines Label Colors

MapLibre places labels dynamically, so you cannot mask the background behind each label as you would on a static map. Instead, choose a `text-halo-color` that separates the label from every background it might land on, and a `text-color` that reads against the halo:

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
- **Carve the symbol out with a casing**, exactly as you would halo a label. A thin light casing reads against dark canopy and water; a darker edge holds against bright soil and rooftops. Keep it thin: a fat ring reads as a sticker. Terminology: a _halo_ contrasts the background to lift the symbol off it; a _knockout_ matches the background to mask busy texture immediately around the symbol. Both buy separation.
- **Flat fills read as stickers on a photo.** Give landform or 3D symbols dimensional cues. A gradient (lighter on the lit slope, darker on the shaded slope) models form. A _contact shadow_, a blurred flattened ellipse pooled under the base, anchors the symbol to the ground far better than an offset drop-shadow, which makes it look like it floats. Match the symbol's lighting and shadow direction to the basemap's `hillshade-illumination-direction` (commonly NW, 315°) so the symbol sits in the same light as the terrain.

**SVG icons via `addImage`:** when loading an SVG into a sprite image at runtime (fetch the SVG, decode it as an `Image`, then `map.addImage`), the SVG rasterizes at decode time, so `linearGradient` and `feDropShadow` filters bake in correctly.[1] Two gotchas: pad the `viewBox` so halos and shadows are not clipped at the icon edge, and keep `width`/`height` proportional to the `viewBox` or the glyph distorts. Use `"icon-allow-overlap": true` for dense point data.

## Visual Hierarchy

A well-ordered label hierarchy means the most important features dominate at the appropriate zoom level. MapLibre controls hierarchy through text size, font weight, letter spacing, and zoom-range visibility.

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

Vector road palettes from light-basemap styles (OSM Bright, OSM Liberty) are tuned to pop on pale paper. Dropped on imagery they dominate: high saturation against a desaturated photo, warm hues advance toward the eye, full opacity. Invert the priority. The imagery is the subject; roads are a reference overlay.

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

## Typography: Glyphs and Font Stacks

MapLibre renders text using **SDF (signed-distance field) glyphs** — precomputed font files that scale cleanly at any zoom or screen density. Glyphs are served from a URL matching the pattern in the style's `glyphs` field. **In MapLibre GL JS ≥ 5.11.0** ([PR #4564](https://github.com/maplibre/maplibre-gl-js/pull/4564)), an unresolvable `glyphs` situation is no longer fatal — MapLibre renders text locally via TinySDF instead, treating `text-font` as a cascading list of local/web font names. This covers two cases, both driven by the same fallback:

- **`glyphs` omitted from the style entirely.** A first-class local-fonts mode, not just error recovery: every `text-font` name is resolved as a web font (loaded with `@font-face` or `document.fonts.load()`) or a system font, the same way a browser resolves a CSS `font-family` list — no PBF generation, no glyph server. See the [local fonts](https://maplibre.org/maplibre-gl-js/docs/examples/style-labels-with-local-fonts/) and [web fonts](https://maplibre.org/maplibre-gl-js/docs/examples/style-labels-with-web-fonts/) examples.
- **`glyphs` is set but a specific glyph PBF fails to load** (wrong font name, 404, etc.) — the same local-render path fires per glyph range instead of failing the tile, logging `Unable to load glyph range ... Rendering codepoint U+... locally instead.` in the console. Treat an unresolvable `text-font` as a **cosmetic** risk (renders in a generic local/system font that looks different per OS/browser) rather than a correctness one — it does not go invisible or break the layer.

The PR author's own caveat still holds: **this is GL JS only**, and the PR text explicitly declines to "encourage style authors to rely on non-CJK local text rendering yet, because maplibre-native still needs corresponding Android and iOS implementations for interoperability" — so production styles that need to look the same on GL JS and Native should keep serving glyphs explicitly rather than designing around the fallback.

**MapLibre Native's equivalent is a different property, not the same one.** Native does not support omitting `glyphs` to fall back to local fonts (tracked, still open: [maplibre-native#165](https://github.com/maplibre/maplibre-native/issues/165)). Instead it has its own `font-faces` property (Android ≥ 11.13.0, iOS ≥ 6.18.0 — **not implemented in GL JS**, [gl-js#6637](https://github.com/maplibre/maplibre-gl-js/issues/6637)), which maps each font name in `text-font` to one or more local font files, each with an explicit Unicode range you specify. It solves the same "render offline without a glyph server" problem GL JS's fallback solves, but the opposite way: you get exact control over which file covers which codepoints instead of an automatic browser/OS font match, at the cost of having to work out those ranges yourself per font. Do not port `font-faces` config to a GL JS style, or the GL JS omit-`glyphs` pattern to Native — the two SDKs solve local fonts with unrelated mechanisms today.

### Setting the glyphs URL

The style's `glyphs` field is a URL template ending in `/{fontstack}/{range}.pbf` (e.g. `https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf`), where `{fontstack}` is the comma-joined `text-font` list and `{range}` a Unicode range — full mechanics: [style spec — glyphs](https://maplibre.org/maplibre-style-spec/glyphs/). `text-font` is itself a fallback list — see [Noto for global maps](#noto-for-global-maps) below.

### Font options

| Source                                | Fonts available                                                                          | Notes                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `demotiles.maplibre.org/font`         | Noto Sans (Latin, Arabic, CJK, etc.), Noto Sans Bold, Italic                             | Free, publicly hosted; good for prototyping              |
| OpenMapTiles `fonts.openmaptiles.org` | Klokantech Noto Sans family                                                              | Matched to OMT schema styles                             |
| Self-hosted, existing font            | Reuse prebuilt PBFs (openmaptiles/fonts, UNDP-Data/fonts, or your current server's tree) | Full control; no generation needed for standard fonts    |
| Self-hosted, custom font              | Generate PBFs from your own TTF/OTF                                                      | Only needed when no prebuilt PBF set exists for the font |

**For standard fonts (Noto Sans, Open Sans, Roboto, and similar), you do not need to generate anything.** The simplest no-generation path is to copy the `{fontstack}/{range}.pbf` tree a glyph server already serves (e.g. the one your style currently points at) onto your own origin. Projects such as [openmaptiles/fonts](https://github.com/openmaptiles/fonts) and [UNDP-Data/fonts](https://github.com/UNDP-Data/fonts) package the common standard fonts as glyph PBFs you can build or pull — note both also run hosted endpoints, which are themselves third-party servers to avoid if self-hosting is the point. Point the style's `glyphs` field at your own URL template; the font names in your `text-font` arrays must exactly match the served font-stack folder names.

**Generating glyphs from a TTF/OTF is a separate, heavier task** — only needed for a custom or brand font with no existing PBF set. Use [Font Maker](https://maplibre.github.io/font-maker/) or [fontnik](https://github.com/mapbox/fontnik) to produce the `.pbf` files, then serve and reference them the same way as above.

### Noto for global maps

Noto ("no tofu") is Google's open-source family built for near-universal Unicode coverage: Noto Sans covers Latin/Greek/Cyrillic, and script-specific fonts (Noto Sans Arabic, Noto Sans Devanagari, Noto Sans Thai, the region-specific Noto Sans CJK SC/TC/JP/KR) extend it. How you handle non-Latin text depends on the script, and CJK is the case people most often get wrong.

**CJK (Chinese, Japanese, Korean) — rendered locally by default; do not serve CJK glyph PBFs.** MapLibre GL JS's `localIdeographFontFamily` map option defaults to `'sans-serif'`, so CJK characters are generated on-device (TinySDF) and the style's `text-font` is **ignored** for them (except the weight keyword). This exists because CJK text has poor locality across Unicode ranges — a single tile can otherwise trigger dozens of large glyph requests.[3] Leave it on; optionally point it at a nicer on-device CJK font. Setting `localIdeographFontFamily: false` restores served glyphs for CJK, which is much slower — only do it if you specifically need the served font's shapes.

```javascript
const map = new maplibregl.Map({
  // ...
  localIdeographFontFamily: '"Noto Sans CJK SC", sans-serif' // optional; default is 'sans-serif'
});
```

**Other non-Latin scripts (Arabic, Hebrew, Thai, …) — need real glyphs.** `localIdeographFontFamily` does not apply here. Add the relevant Noto script font to the layer's `text-font` fallback list and serve its glyph PBFs (or rely on the GL JS ≥ 5.11.0 local fallback, which is environment-dependent — see the top of this section). Font names must match those the glyph server knows.

**Devanagari, Khmer, and other scripts requiring ligatures/reordering — glyphs alone will not fix this.** MapLibre maps each Unicode codepoint to one glyph with no shaping engine (no HarfBuzz/Raqm), so it cannot form the conjuncts and reordering these scripts require — serving the correct font's PBFs will not produce correct-looking text. There is currently no configuration fix; this is a known architectural limitation.[6]

```json
{ "text-font": ["Noto Sans Regular", "Noto Sans Devanagari Regular"] }
```

**Arabic and Hebrew additionally need the RTL text plugin** for correct right-to-left shaping and ordering — glyph coverage alone is not enough. MapLibre GL JS does not handle RTL by default[2]:

```javascript
import { setRTLTextPlugin } from 'maplibre-gl';
setRTLTextPlugin('https://unpkg.com/maplibre-gl/dist/maplibre-gl-rtl-text.js', null, true);
```

Call this before initializing the map.

## Sprites: Icons and Markers

The style JSON's `sprite` value is a **base URL with no file extension** (e.g. `https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite`, for testing purposes only, do not use in production); MapLibre appends `.json`, `.png`, and `@2x` variants itself. Symbol layers reference sprite images by ID with `icon-image`; the value must exactly match an ID in the sprite JSON index or the icon is silently not rendered.

### Self-hosted sprites

To avoid third-party dependencies, copy an existing sprite directory (PNG + JSON, plus any @2x files) from a style or tileset provider and host it under your own domain, pointing the style's `sprite` property at its base URL. Always check the provider's license before republishing and add attribution if required.

Host sprite assets on a static host you control (GitHub Pages, Netlify, Vercel, S3, same origin as the style). **Do not point production styles at `raw.githubusercontent.com`** Raw is for serving repository blobs, not production assets: anonymous requests are aggressively rate-limited so real users see intermittent HTTP 429s [4], caching is fixed at five minutes with no control, there is no SLA, and private-repo URLs return 404 to everyone but authenticated collaborators (it works for you while logged in, then fails for every other user) [5].

### Building a sprite from SVGs

Generate sprite assets from a directory of SVGs with tools such as [spritezero](https://github.com/mapbox/spritezero), [spreet](https://github.com/flother/spreet), or [Martin](https://maplibre.org/martin/sources-sprites/).

Useful icon sources include [Maki](https://github.com/mapbox/maki) and [Temaki](https://github.com/ideditor/temaki). These are common source repositories for map-style SVG icons, but check each repository's license before republishing derived sprite assets.

### Creating your own icons

For a small number of custom icons, `map.loadImage()` and `addImage()` can work without a full sprite pipeline. For larger reusable icon sets, generating a sprite remains the standard and more maintainable approach. [10]

### Broken route shields

Broken-looking route shields (bare floating numbers, missing badges) are almost always a **missing sprite image**. The shield number is text (font) and usually renders fine; the badge behind it is an `icon-image` from the sprite. Diagnose in this order:

1. **Confirm glyphs load.** Probe the `glyphs` server for the exact `text-font` names and expect HTTP 200. If they 200, the font is not the problem.
2. **Confirm the sprite carries the shield images.** OpenMapTiles and OSM Liberty shield layers use `icon-image: "{network}_{ref_length}"` for known networks (e.g. `us-interstate_2`, `us-highway_3`, `us-state_2`) and `road_{ref_length}` for generic refs. A missing icon is silently omitted, so grep the sprite JSON for those keys.

Not every sprite carries shields localized for the US, so grep the sprite JSON for the `{network}_{ref_length}` keys before assuming they exist. Both the `demotiles.maplibre.org/styles/osm-bright-gl-style/sprite` and `openmaptiles.github.io/osm-bright-gl-style/sprite` sheets currently include `us-interstate_*`, `us-highway_*`, and `us-state_*` (alongside the generic `road_1`–`road_6`), but a minimal or custom sprite may ship only the generic `road_*`. If yours lacks the shield images and your tiles populate `network`, `ref`, and `ref_length` (the OSM US OpenMapTiles tiles do), point `sprite` at one that has them — the `{network}_{ref_length}` layers then resolve with no layer edits.

## Layer Ordering

MapLibre renders layers in the order they appear in the style `layers` array — first item is drawn first (bottom), last is drawn last (top). Getting this wrong is the most common cause of data layers obscuring basemap labels.

### The injection pattern

When adding your own data to an existing basemap style at runtime, insert your layers **before the first symbol layer** (find it with `map.getStyle().layers.find((l) => l.type === 'symbol')?.id` and pass it as the second argument of `addLayer`) so your geometry renders under labels. Without that argument the layer goes above everything, including labels.

### Canonical layer order for custom styles

When building a style from scratch, follow this ordering bottom to top:

1. `background`
2. Raster imagery (if using satellite/aerial source)
3. Hillshade layers (if any — see [maplibre-terrain-patterns](../maplibre-terrain-patterns/SKILL.md) for configuration)
4. Terrain fill (water, land, parks — polygon layers)
5. Line layers (roads, boundaries, rivers)
6. Your data polygon and line layers
7. Symbol layers from the basemap (place labels, road labels)
8. Your data symbol/label layers (if any)

Hillshade sits directly above raster imagery and below all vector layers, with sufficient transparency to allow the imagery to show through. If you add transparency to the imagery and layer it over the hillshade, the imagery will appear faded or washed out. Hillshade applied over vector layers will make line and fill colors look blotchy, blurry or muted.

## Accessibility

MapLibre styles are rendered in the browser as a WebGL canvas. Accessibility considerations:

- **Text contrast:** WCAG 2.1 AA requires 4.5:1 for normal text, 3:1 for large.[9] White text on a `rgba(0,0,0,0.75)` halo satisfies this for most backgrounds — check the **combined text+halo color**, not the text alone, with a tool like the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).
- **Do not rely on color alone:** use shape, size, or pattern in addition to hue.
- **Minimum label size:** prefer size stops that start at 10px even at low zoom.
- **Screen readers and the WebGL canvas:** MapLibre's canvas is not inherently accessible to screen readers. For accessible map experiences, provide an accessible alternative such as a data table or a text description of the map contents, and use [maplibre-gl-accessibility](https://github.com/maplibre/maplibre-gl-accessibility) for keyboard navigation and ARIA roles.

## Related Skills

- [**maplibre-tile-sources**](../maplibre-tile-sources/SKILL.md) — Setting up glyphs, sprites, and source configuration.
- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md) — Serving imagery (raster) and terrain sources from PMTiles files.
- [**maplibre-terrain-patterns**](../maplibre-terrain-patterns/SKILL.md) — Hillshade configuration, multi-pass techniques, 3D terrain, DEM sources.

## References

1. [**`Map.addImage()` (MapLibre GL JS API)**](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addimage)
2. [**`setRTLTextPlugin` (MapLibre GL JS API)**](https://maplibre.org/maplibre-gl-js/docs/API/functions/setRTLTextPlugin/) — required for correct Arabic/Hebrew shaping
3. [**Use locally generated ideographs (MapLibre GL JS example)**](https://maplibre.org/maplibre-gl-js/docs/examples/use-locally-generated-ideographs/) — `localIdeographFontFamily` default and CJK rendering behavior
4. [**Unauthenticated rate limits on `raw.githubusercontent.com` (GitHub Community Discussion)**](https://github.com/orgs/community/discussions/159123) — anonymous requests are rate-limited; production traffic sees intermittent HTTP 429
5. [**`raw.githubusercontent.com` and private repositories (GitHub Community Discussion)**](https://github.com/orgs/community/discussions/69281) — private-repo raw URLs return 404/403 to anonymous requests
6. [**"About Text Rendering in MapLibre"**](https://github.com/wipfli/about-text-rendering-in-maplibre) — SDF glyph architecture, codepoint-to-glyph mapping, and why shaping-dependent scripts (Devanagari, Khmer) don't render correctly

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
