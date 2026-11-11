---
name: maplibre-fonts-glyphs
description: Configuring fonts and glyphs for MapLibre GL JS and MapLibre Native — the style's `glyphs` URL, self-hosting or generating font PBFs, the GL JS local-font fallback (omitted `glyphs` or a failed glyph fetch), the `font-faces` property both SDKs read, and CJK, right-to-left and Devanagari script handling. Use when text labels aren't rendering in the intended font, setting up a glyphs server, choosing between self-hosting and generating font PBFs, or handling non-Latin scripts.
metadata:
  status: provisional
---

# MapLibre Fonts and Glyphs

MapLibre draws label text from precomputed glyph images that a server provides, or, for some scripts and setups, with local or web fonts. This skill covers where glyphs come from, the GL JS local-font fallback, the `font-faces` property, and non-Latin script support. For font sizing, weight, and other visual-hierarchy decisions, see [maplibre-cartography](../maplibre-cartography/SKILL.md).

## When to Use This Skill

- Text labels aren't rendering, or render in the wrong font
- Setting up a `glyphs` URL for a custom or self-hosted style
- Deciding whether to self-host existing font PBFs or generate your own from a TTF/OTF
- Rendering non-Latin scripts (CJK, Arabic, Hebrew, Devanagari, and others)
- Rendering fonts locally/offline without a glyphs server, on GL JS or Native

**Don't use this skill to pad an unrelated answer.** Fonts and glyphs only affect symbol layers that set `text-field`. A question about terrain, hillshade, or any other layer that draws no text gets a normal, focused answer that leaves fonts, glyphs, `font-faces`, and label scripts out entirely, caveats, troubleshooting rows, and optional label sections included.

## MapLibre renders text using SDF glyphs

MapLibre renders text using **SDF (signed-distance field) glyphs** — precomputed font files that scale cleanly at any zoom or screen density, served from a URL matching the style's `glyphs` field. **In GL JS ≥ 5.11.0** ([PR #4564](https://github.com/maplibre/maplibre-gl-js/pull/4564)), an unresolvable `glyphs` situation is no longer fatal: MapLibre renders text locally via TinySDF instead, treating `text-font` as a cascading list of local/web font names. This covers two cases:

- **`glyphs` omitted entirely.** A first-class local-fonts mode, not just error recovery. Every `text-font` name is resolved as a web font (loaded with `@font-face` or `document.fonts.load()`) or a system font, the same way a browser resolves a CSS `font-family` list. No PBF generation, no glyph server. See the [local fonts](https://maplibre.org/maplibre-gl-js/docs/examples/style-labels-with-local-fonts/) and [web fonts](https://maplibre.org/maplibre-gl-js/docs/examples/style-labels-with-web-fonts/) examples.
- **`glyphs` is set but a specific glyph PBF fails to load** (wrong font name, 404, etc.). The same local-render path fires per glyph range instead of failing the tile, logging `Unable to load glyph range ... Rendering codepoint U+... locally instead.` Treat this as **cosmetic**, not correctness: the text renders in a generic local/system font that varies by OS/browser, but doesn't go invisible or break the layer.

The PR author's own caveat still holds: **this fallback is GL JS only.** Native has no equivalent of omitting `glyphs` (tracked, still open: [maplibre-native#165](https://github.com/maplibre/maplibre-native/issues/165)), so a style that must look the same on GL JS and Native should keep serving glyphs explicitly instead of relying on the fallback.

**`font-faces` names font files for `text-font` names, and both SDKs read it.** The style's root [`font-faces`](https://maplibre.org/maplibre-style-spec/root/#font-faces) property maps each `text-font` name to one or more font files, each optionally limited to a `unicode-range`. Characters those files cover are drawn from them, and everything else falls back to the `glyphs` URL. Native has read it since Android 11.13.0 and iOS 6.18.0, with HarfBuzz shaping, and GL JS since 6.7.0, with [`map.setFontFaces()`](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setfontfaces) to change it at runtime. GL JS loads the files through the browser, so each `url` must be one the browser can fetch: a Native config whose URLs point at files on the device needs URLs the web app serves before GL JS can use it.

## Setting the glyphs URL

The style's `glyphs` field is a URL template ending in `/{fontstack}/{range}.pbf` (e.g. `https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf`), where `{fontstack}` is the comma-joined `text-font` list and `{range}` a Unicode range — full mechanics: [style spec — glyphs](https://maplibre.org/maplibre-style-spec/glyphs/). `text-font` is itself a fallback list — see [Noto for global maps](#noto-for-global-maps) below.

## Font options

| Source                                | Fonts available                                                                          | Notes                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `demotiles.maplibre.org/font`         | Noto Sans (Latin, Arabic, CJK, etc.), Noto Sans Bold, Italic                             | Free, publicly hosted; good for prototyping              |
| OpenMapTiles `fonts.openmaptiles.org` | Klokantech Noto Sans family                                                              | Matched to OMT schema styles                             |
| Self-hosted, existing font            | Reuse prebuilt PBFs (openmaptiles/fonts, UNDP-Data/fonts, or your current server's tree) | Full control; no generation needed for standard fonts    |
| Self-hosted, custom font              | Generate PBFs from your own TTF/OTF                                                      | Only needed when no prebuilt PBF set exists for the font |

**For standard fonts (Noto Sans, Open Sans, Roboto, and similar), you don't need to generate anything.** The simplest path is copying the `{fontstack}/{range}.pbf` tree a glyph server already serves (e.g. the one your style currently points at) onto your own origin. [openmaptiles/fonts](https://github.com/openmaptiles/fonts) and [UNDP-Data/fonts](https://github.com/UNDP-Data/fonts) package the common standard fonts as glyph PBFs you can build or pull. Both also run hosted endpoints of their own — third-party servers, so skip those if self-hosting is the point. Point the style's `glyphs` field at your own URL template; the font names in your `text-font` arrays must exactly match the served font-stack folder names.

**Generating glyphs from a TTF/OTF is a separate, heavier task** — only needed for a custom or brand font with no existing PBF set. Use [Font Maker](https://maplibre.github.io/font-maker/) or [fontnik](https://github.com/mapbox/fontnik) to produce the `.pbf` files, then serve and reference them the same way as above.

## Noto for global maps

Noto ("no tofu") is Google's open-source family built for near-universal Unicode coverage: Noto Sans covers Latin/Greek/Cyrillic, and script-specific fonts (Noto Sans Arabic, Noto Sans Devanagari, Noto Sans Thai, the region-specific Noto Sans CJK SC/TC/JP/KR) extend it. How you handle non-Latin text depends on the script, and CJK is the case people most often get wrong.

**CJK (Chinese, Japanese, Korean) — rendered locally by default; do not serve CJK glyph PBFs.** GL JS's `localIdeographFontFamily` map option defaults to `'sans-serif'`, so CJK characters are generated on-device (TinySDF), and `text-font` is **ignored** for them (except the weight keyword). This exists because CJK text has poor locality across Unicode ranges: a single tile can otherwise trigger dozens of large glyph requests.[2] Leave it on; optionally point it at a nicer on-device CJK font. Setting `localIdeographFontFamily: false` restores served glyphs for CJK, which is much slower — only do it if you specifically need the served font's shapes.

```javascript
const map = new maplibregl.Map({
  // ...
  localIdeographFontFamily: '"Noto Sans CJK SC", sans-serif' // optional; default is 'sans-serif'
});
```

**Arabic, Hebrew and other alphabetic scripts — need real glyphs.** `localIdeographFontFamily` does not apply here. Add the relevant Noto script font to the style layer's `text-font` fallback list and serve its glyph PBFs (or rely on the GL JS ≥ 5.11.0 local fallback, which is environment-dependent — see the top of this skill). Font names must match those the glyph server knows.

**Devanagari, Khmer, Thai, Myanmar and other scripts that join letters with marks — on GL JS, drawn with the browser.** A `glyphs` URL serves one codepoint at a time, so it cannot supply a letter written together with its vowel signs, and before 6.7.0 GL JS drew these scripts letter by letter, with no fix short of upgrading. GL JS 6.7.0 began drawing them a grapheme cluster at a time with the browser's text engine, 6.9.0 improved it, and since 6.15.0 every letter of these scripts is drawn that way even when the style has a `glyphs` URL, so a word never mixes two fonts. The glyph server's PBFs for these scripts then go unused, and the face is whatever the browser finds for the `text-font` names. To choose it, declare the font file in `font-faces`:

```json
"font-faces": {
  "Noto Sans Regular": [
    {
      "url": "https://example.com/fonts/NotoSansDevanagari-Regular.ttf",
      "unicode-range": ["U+0900-097F"]
    }
  ]
}
```

On Native, `font-faces` is also what brings HarfBuzz shaping to these scripts.

**Arabic and Hebrew — GL JS 6.9.0 and later need no plugin.** Since 6.9.0, GL JS shapes Arabic and lays out right-to-left text itself, and `setRTLTextPlugin` is deprecated. Before 6.9.0, load the right-to-left text plugin once, before creating the map:

```javascript
import { setRTLTextPlugin } from 'maplibre-gl';
setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js', false);
```

## Related Skills

- [**maplibre-cartography**](../maplibre-cartography/SKILL.md) — Font size, weight, and letter-spacing for visual hierarchy.
- [**maplibre-sprites-icons**](../maplibre-sprites-icons/SKILL.md) — Sprites and icon images; the badge behind a route shield's text.
- [**maplibre-source-wiring**](../maplibre-source-wiring/SKILL.md) — Where `glyphs` and `sprite` fit into a style's other components; CORS for self-hosted assets.

## References

1. [**`setRTLTextPlugin` (MapLibre GL JS API)**](https://maplibre.org/maplibre-gl-js/docs/API/functions/setRTLTextPlugin/) — deprecated since GL JS 6.9.0; needed for Arabic and Hebrew before it
2. [**Use locally generated ideographs (MapLibre GL JS example)**](https://maplibre.org/maplibre-gl-js/docs/examples/use-locally-generated-ideographs/) — `localIdeographFontFamily` default and CJK rendering behavior
3. [**`font-faces` (MapLibre Style Specification)**](https://maplibre.org/maplibre-style-spec/root/#font-faces) and the [GL JS CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md) (6.7.0, 6.9.0 and 6.15.0) — font files per `text-font` name, and complex and right-to-left scripts drawn without a plugin

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
