---
name: maplibre-fonts-glyphs
description: Configuring fonts and glyphs for MapLibre GL JS and MapLibre Native — the stylesheet's `glyphs` URL, self-hosting or generating font PBFs, the GL JS local-font fallback (omitted `glyphs` or a failed glyph fetch), MapLibre Native's `font-faces` property, and Noto/CJK/RTL/Devanagari script handling. Use when text labels aren't rendering in the intended font, setting up a glyphs server, choosing between self-hosting and generating font PBFs, or handling non-Latin scripts.
status: provisional
---

# MapLibre Fonts and Glyphs

MapLibre does not render text with the fonts installed on a machine by default. It fetches precomputed glyph images from a server, or (on GL JS, since 5.11.0) falls back to local/system fonts. This skill covers that mechanism: where glyphs come from, when you need to generate anything at all, the GL JS local-font fallback, MapLibre Native's separate `font-faces` mechanism, and non-Latin script support. For font sizing, weight, and other visual-hierarchy decisions, see [maplibre-cartography](../maplibre-cartography/SKILL.md).

## When to Use This Skill

- Text labels aren't rendering, or render in the wrong font
- Setting up a `glyphs` URL for a custom or self-hosted stylesheet
- Deciding whether to self-host existing font PBFs or generate your own from a TTF/OTF
- Rendering non-Latin scripts (CJK, Arabic, Hebrew, Devanagari, and others)
- Rendering fonts locally/offline without a glyphs server, on GL JS or on Native

## MapLibre renders text using SDF glyphs

MapLibre renders text using **SDF (signed-distance field) glyphs** — precomputed font files that scale cleanly at any zoom or screen density. Glyphs are served from a URL matching the pattern in the stylesheet's `glyphs` field. **In MapLibre GL JS ≥ 5.11.0** ([PR #4564](https://github.com/maplibre/maplibre-gl-js/pull/4564)), an unresolvable `glyphs` situation is no longer fatal. MapLibre renders text locally via TinySDF instead, treating `text-font` as a cascading list of local/web font names. This covers two cases, both driven by the same fallback:

- **`glyphs` omitted from the stylesheet entirely.** A first-class local-fonts mode, not just error recovery. Every `text-font` name is resolved as a web font (loaded with `@font-face` or `document.fonts.load()`) or a system font, the same way a browser resolves a CSS `font-family` list. No PBF generation, no glyph server. See the [local fonts](https://maplibre.org/maplibre-gl-js/docs/examples/style-labels-with-local-fonts/) and [web fonts](https://maplibre.org/maplibre-gl-js/docs/examples/style-labels-with-web-fonts/) examples.
- **`glyphs` is set but a specific glyph PBF fails to load** (wrong font name, 404, etc.). The same local-render path fires per glyph range instead of failing the tile, logging `Unable to load glyph range ... Rendering codepoint U+... locally instead.` in the console. Treat an unresolvable `text-font` as a **cosmetic** risk, not a correctness one: it renders in a generic local/system font that looks different per OS/browser, but does not go invisible or break the layer.

The PR author's own caveat still holds: **this is GL JS only.** The PR text explicitly declines to "encourage style authors to rely on non-CJK local text rendering yet, because maplibre-native still needs corresponding Android and iOS implementations for interoperability." Production stylesheets that need to look the same on GL JS and Native should keep serving glyphs explicitly rather than designing around the fallback.

**MapLibre Native's equivalent is a different property, not the same one.** Native does not support omitting `glyphs` to fall back to local fonts (tracked, still open: [maplibre-native#165](https://github.com/maplibre/maplibre-native/issues/165)). Instead it has its own `font-faces` property (Android ≥ 11.13.0, iOS ≥ 6.18.0 — **not implemented in GL JS**, [gl-js#6637](https://github.com/maplibre/maplibre-gl-js/issues/6637)), which maps each font name in `text-font` to one or more local font files, each with an explicit Unicode range you specify. It solves the same "render offline without a glyph server" problem GL JS's fallback solves, but the opposite way: you get exact control over which file covers which codepoints, instead of an automatic browser/OS font match. The cost is working out those ranges yourself, per font. Do not port `font-faces` config to a GL JS stylesheet, or the GL JS omit-`glyphs` pattern to Native. The two SDKs solve local fonts with unrelated mechanisms today.

## Setting the glyphs URL

The stylesheet's `glyphs` field is a URL template ending in `/{fontstack}/{range}.pbf` (e.g. `https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf`), where `{fontstack}` is the comma-joined `text-font` list and `{range}` a Unicode range — full mechanics: [style spec — glyphs](https://maplibre.org/maplibre-style-spec/glyphs/). `text-font` is itself a fallback list — see [Noto for global maps](#noto-for-global-maps) below.

## Font options

| Source                                | Fonts available                                                                          | Notes                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `demotiles.maplibre.org/font`         | Noto Sans (Latin, Arabic, CJK, etc.), Noto Sans Bold, Italic                             | Free, publicly hosted; good for prototyping              |
| OpenMapTiles `fonts.openmaptiles.org` | Klokantech Noto Sans family                                                              | Matched to OMT schema styles                             |
| Self-hosted, existing font            | Reuse prebuilt PBFs (openmaptiles/fonts, UNDP-Data/fonts, or your current server's tree) | Full control; no generation needed for standard fonts    |
| Self-hosted, custom font              | Generate PBFs from your own TTF/OTF                                                      | Only needed when no prebuilt PBF set exists for the font |

**For standard fonts (Noto Sans, Open Sans, Roboto, and similar), you do not need to generate anything.** The simplest no-generation path is to copy the `{fontstack}/{range}.pbf` tree a glyph server already serves (e.g. the one your stylesheet currently points at) onto your own origin. Projects such as [openmaptiles/fonts](https://github.com/openmaptiles/fonts) and [UNDP-Data/fonts](https://github.com/UNDP-Data/fonts) package the common standard fonts as glyph PBFs you can build or pull. Both also run hosted endpoints of their own — third-party servers, so skip those if self-hosting is the point. Point the stylesheet's `glyphs` field at your own URL template; the font names in your `text-font` arrays must exactly match the served font-stack folder names.

**Generating glyphs from a TTF/OTF is a separate, heavier task** — only needed for a custom or brand font with no existing PBF set. Use [Font Maker](https://maplibre.github.io/font-maker/) or [fontnik](https://github.com/mapbox/fontnik) to produce the `.pbf` files, then serve and reference them the same way as above.

## Noto for global maps

Noto ("no tofu") is Google's open-source family built for near-universal Unicode coverage: Noto Sans covers Latin/Greek/Cyrillic, and script-specific fonts (Noto Sans Arabic, Noto Sans Devanagari, Noto Sans Thai, the region-specific Noto Sans CJK SC/TC/JP/KR) extend it. How you handle non-Latin text depends on the script, and CJK is the case people most often get wrong.

**CJK (Chinese, Japanese, Korean) — rendered locally by default; do not serve CJK glyph PBFs.** MapLibre GL JS's `localIdeographFontFamily` map option defaults to `'sans-serif'`, so CJK characters are generated on-device (TinySDF), and the stylesheet's `text-font` is **ignored** for them (except the weight keyword). This exists because CJK text has poor locality across Unicode ranges: a single tile can otherwise trigger dozens of large glyph requests.[2] Leave it on; optionally point it at a nicer on-device CJK font. Setting `localIdeographFontFamily: false` restores served glyphs for CJK, which is much slower. Only do it if you specifically need the served font's shapes.

```javascript
const map = new maplibregl.Map({
  // ...
  localIdeographFontFamily: '"Noto Sans CJK SC", sans-serif' // optional; default is 'sans-serif'
});
```

**Other non-Latin scripts (Arabic, Hebrew, Thai, …) — need real glyphs.** `localIdeographFontFamily` does not apply here. Add the relevant Noto script font to the stylesheet layer's `text-font` fallback list and serve its glyph PBFs (or rely on the GL JS ≥ 5.11.0 local fallback, which is environment-dependent — see the top of this skill). Font names must match those the glyph server knows.

**Devanagari, Khmer, and other scripts requiring ligatures/reordering — glyphs alone will not fix this.** MapLibre maps each Unicode codepoint to one glyph with no shaping engine (no HarfBuzz/Raqm), so it cannot form the conjuncts and reordering these scripts require — serving the correct font's PBFs will not produce correct-looking text. There is currently no configuration fix; this is a known architectural limitation.[3]

```json
{ "text-font": ["Noto Sans Regular", "Noto Sans Devanagari Regular"] }
```

**Arabic and Hebrew additionally need the RTL text plugin** for correct right-to-left shaping and ordering — glyph coverage alone is not enough. MapLibre GL JS does not handle RTL by default[1]:

```javascript
import { setRTLTextPlugin } from 'maplibre-gl';
setRTLTextPlugin('https://unpkg.com/maplibre-gl/dist/maplibre-gl-rtl-text.js', null, true);
```

Call this before initializing the map.

## Related Skills

- [**maplibre-cartography**](../maplibre-cartography/SKILL.md) — Font size, weight, and letter-spacing for visual hierarchy; sprites and icons.
- [**maplibre-tile-sources**](../maplibre-tile-sources/SKILL.md) — Where `glyphs` and `sprite` fit into a stylesheet's other components; CORS for self-hosted assets.

## References

1. [**`setRTLTextPlugin` (MapLibre GL JS API)**](https://maplibre.org/maplibre-gl-js/docs/API/functions/setRTLTextPlugin/) — required for correct Arabic/Hebrew shaping
2. [**Use locally generated ideographs (MapLibre GL JS example)**](https://maplibre.org/maplibre-gl-js/docs/examples/use-locally-generated-ideographs/) — `localIdeographFontFamily` default and CJK rendering behavior
3. [**"About Text Rendering in MapLibre"**](https://github.com/wipfli/about-text-rendering-in-maplibre) — SDF glyph architecture, codepoint-to-glyph mapping, and why shaping-dependent scripts (Devanagari, Khmer) don't render correctly
