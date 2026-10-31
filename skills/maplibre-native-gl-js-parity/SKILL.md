---
name: maplibre-native-gl-js-parity
description: Where MapLibre Native (Android, iOS) and MapLibre GL JS differ, release by release — custom URL schemes (`addProtocol`), globe projection, 3D terrain, `interpolate-hcl` and `interpolate-lab`, the `color-relief` layer, and PMTiles — with the Native release that closed each gap, the tracking issue for each still open, and what to do on Native instead. Use when a style or feature that works in the browser does nothing in an Android or iOS app, when porting MapLibre GL JS code to Kotlin or Swift, or when deciding whether a MapLibre feature exists on Native.
metadata:
  status: verified
---

# MapLibre Native and GL JS Parity

MapLibre GL JS and MapLibre Native read the same style specification but ship features at different times. A style key Native does not know is ignored, and a paint value it cannot parse drops its layer, both without a crash, so the symptom is a map that quietly differs from the browser. The table below names each gap this skill covers, the release that closed it where one has, and what to do on Native instead. Rows were checked against android-v13.7.1 (2026-10-15) and ios-v7.0.0 (2026-10-28).

## When to Use This Skill

These are symptoms as you would observe them, before you know the cause:

- **The browser shows a globe, the app stays flat:** the style sets `"projection": {"type": "globe"}` and nothing changes on Android or iOS however far the map zooms out (no Native release draws a globe).
- **One layer never draws on Android or iOS, no crash, every other layer fine:** a paint value uses an expression the installed release does not implement, such as `interpolate-hcl` before android-v13.7.1 or ios-v7.0.0, so the whole layer is dropped.
- **Porting `map.setTerrain(...)` to Kotlin or Swift:** there is nothing to port it to (no Native release has 3D terrain).
- **A `maplibregl.addProtocol` handler needs an Android or iOS equivalent:** there is no `addProtocol` on Native; app code answers the request in each platform's HTTP stack instead.
- **Elevation-banded color on a phone without pre-rendered tiles:** a `color-relief` layer, on Native since android-v13.0.0 and ios-v6.24.0.
- **A `.pmtiles` archive in an iOS or Android app:** no tile server, conversion, or package; `pmtiles://` is built in since android-v11.8.0 and ios-v6.10.0.

**Not this skill.** A question about a browser app alone has no Native caveat to add. The gaps outside this table are on MapLibre Native's [`js-parity` label](https://github.com/maplibre/maplibre-native/issues?q=label%3Ajs-parity).[1]

## The gaps, and what to do on Native

| Feature                                              | MapLibre GL JS                                                  | MapLibre Native                                                                                                                      | Do on Native                                                                                                                                                                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A custom URL scheme for tiles (`vault://…`)          | `addProtocol`, promise-based since 4.0.0[9]                     | No `addProtocol`; [#3562](https://github.com/maplibre/maplibre-native/issues/3562) open[2]                                           | Android: a custom `HttpRequest` from a `ModuleProvider` (android-v11.0.0), an OkHttp interceptor on `https://` URLs the app marks, or a `CustomVectorSource` (android-v13.5.0). iOS: a `URLProtocol` in `MLNNetworkConfiguration`'s `sessionConfiguration` (every release). |
| Globe projection (`projection: globe`)               | Yes                                                             | No release; [#3161](https://github.com/maplibre/maplibre-native/issues/3161) open[3]                                                 | Stay on Mercator, or show the globe in a web view running GL JS                                                                                                                                                                                                             |
| 3D terrain (`map.setTerrain`, the style's `terrain`) | Yes                                                             | No release; [#252](https://github.com/maplibre/maplibre-native/issues/252) open[4]                                                   | `hillshade` or `color-relief` on the same `raster-dem` source: shading on a flat map, not relief                                                                                                                                                                            |
| `interpolate-hcl`, `interpolate-lab`                 | Yes                                                             | android-v13.7.1, ios-v7.0.0 ([#4668](https://github.com/maplibre/maplibre-native/pull/4668)); earlier releases drop the layer[5] [6] | Upgrade, or keep the release and use a plain `interpolate` ramp with intermediate stops                                                                                                                                                                                     |
| `color-relief` layer                                 | 5.6.0[9]                                                        | android-v13.0.0, ios-v6.24.0 ([#3965](https://github.com/maplibre/maplibre-native/pull/3965))[5] [6]                                 | Use it from the style; there is no `raster-color` on either renderer                                                                                                                                                                                                        |
| PMTiles                                              | The `pmtiles` package registers `pmtiles://` with `addProtocol` | Built in: `pmtiles://` since android-v11.8.0, ios-v6.10.0 ([#2882](https://github.com/maplibre/maplibre-native/pull/2882))[5] [6]    | `pmtiles://https://…` in the style, or on iOS `MLNVectorTileSource(identifier:configurationURLString:)`                                                                                                                                                                     |

## Custom URL schemes: four doors, and none is `addProtocol`

Native has no API that registers a scheme. It reads `asset://`, `file://`, `mbtiles://` and `pmtiles://` URLs itself and passes every other URL, `vault://` included, to the platform's HTTP stack, where app code can answer it.[10]

**Android: keep the style's `vault://` URLs and answer every request yourself.** A `ModuleProvider` hands MapLibre the `HttpRequest` it uses for every resource (tiles, the style, sprites, glyphs), since android-v11.0.0.[5] [7] Delegate what is not yours to the stock request:

```kotlin
import org.maplibre.android.MapLibre
import org.maplibre.android.ModuleProvider
import org.maplibre.android.http.HttpRequest
import org.maplibre.android.http.HttpResponder

class VaultHttpRequest(private val stock: HttpRequest) : HttpRequest {
    override fun executeRequest(
        responder: HttpResponder, nativePtr: Long, resourceUrl: String,
        dataRange: String?, etag: String?, modified: String?, offlineUsage: Boolean
    ) {
        if (!resourceUrl.startsWith("vault://")) {
            return stock.executeRequest(responder, nativePtr, resourceUrl, dataRange, etag, modified, offlineUsage)
        }
        val bytes = Vault.decryptTile(resourceUrl) // your code: the MVT bytes for this URL
        // code, eTag, lastModified, cacheControl, expires, retryAfter, xRateLimitReset, body
        responder.onResponse(200, null, null, null, null, null, null, bytes)
    }

    override fun cancelRequest() = stock.cancelRequest()
}

val stock = MapLibre.getModuleProvider()
MapLibre.setModuleProvider(object : ModuleProvider by stock {
    override fun createHttpRequest(): HttpRequest = VaultHttpRequest(stock.createHttpRequest())
})
```

Set the provider before the first `MapView` is created. Report a failure with `responder.handleFailure(type, message)` rather than an empty body; `type` is one of the three constants on `HttpRequest`: `CONNECTION_ERROR`, `TEMPORARY_ERROR`, `PERMANENT_ERROR`.

**Or, on Android, add the source from code and hand over tiles by `z/x/y`.** A `CustomVectorSource` (android-v13.5.0) asks a `CustomVectorTileProvider` for each tile and takes the raw MVT bytes back as `TileData.Mvt`.[5] [7] The style JSON does not reference it; the source and its layers are added in code:

```kotlin
val vault = CustomVectorSource(
    id = "vault",
    provider = object : CustomVectorTileProvider {
        override suspend fun fetchTile(z: Int, x: Int, y: Int): TileData =
            TileData.Mvt(Vault.decryptTile(z, x, y)) // your code: the MVT bytes
    },
    scope = lifecycleScope,
    maxZoom = 14
)
style.addSource(vault)
style.addLayer(FillLayer("parcels", "vault").withSourceLayer("parcels"))
```

**Or, on Android, change the tile URLs to `https://` ones the app marks, and answer those in an OkHttp interceptor.** It takes `http://` or `https://`: the stock request drops any URL OkHttp's `HttpUrl.parse` rejects, `vault://` included, before the client sees it, logging `[HTTP] Unable to parse resourceUrl` and never answering.[7] `HttpRequestUtil.setOkHttpClient` sets the OkHttp client that request uses, in every release, and an application interceptor on it returns its own `Response` for the marked requests, here those with a `vault` query parameter, and passes the rest to the network:

```kotlin
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.maplibre.android.module.http.HttpRequestUtil

HttpRequestUtil.setOkHttpClient(OkHttpClient.Builder().addInterceptor { chain ->
    val request = chain.request()
    if (request.url.queryParameter("vault") == null) return@addInterceptor chain.proceed(request)
    val bytes = Vault.decryptTile(request.url) // your code: the MVT bytes for this URL
    Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(200).message("OK")
        .body(bytes.toResponseBody()).build()
}.build())
```

MapLibre reads that `Response` like a server's, `ETag`, `Cache-Control` and `Expires` included, and stores the tile in its ambient cache.

**iOS: keep the style's `vault://` URLs and answer them in a `URLProtocol`.** MapLibre builds its `URLSession` from `MLNNetworkConfiguration.sharedManager.sessionConfiguration`, in every release (`MGLNetworkConfiguration` before ios-v6.0.0).[6] [10] Add a `URLProtocol` subclass whose `canInit(with:)` accepts the `vault` scheme to that configuration's `protocolClasses` before the first `MLNMapView` is created. Answer each request with an `HTTPURLResponse` (status 200) and the tile bytes; MapLibre reports a plain `URLResponse` as an error that reads `Response class is not NSHTTPURLResponse`.

- ❌ `MapLibre.addProtocol`, `MapLibreMap.addProtocol`, `Style.addProtocol`, or a request-handler option on `MapLibreMapOptions`: none exists.
- ❌ `FileSource.setResourceTransform` to serve bytes: it returns a replacement URL, nothing else.

## Globe projection: no release draws one

The style's `projection` key has no effect on Android or iOS; the map stays Mercator, and nothing in `MapView` or `MLNMapView` turns a globe on. The work is tracked in [#3161](https://github.com/maplibre/maplibre-native/issues/3161);[3] until a release note names it, the choices are a Mercator map or GL JS in a web view.

## 3D terrain: shade it, do not raise it

Native has no `setTerrain`, no `terrain` style block, no `TerrainOptions`, and no `Terrain(...)` constructor; the work is tracked in [#252](https://github.com/maplibre/maplibre-native/issues/252).[4] The same `raster-dem` source still draws two things, both on a flat map:

```json
{ "id": "shade", "type": "hillshade", "source": "dem" }
```

```json
{
  "id": "relief",
  "type": "color-relief",
  "source": "dem",
  "paint": {
    "color-relief-color": ["interpolate", ["linear"], ["elevation"], 0, "#2e8b57", 1500, "#8b5a2b", 3000, "#ffffff"]
  }
}
```

`color-relief` is on Android since android-v13.0.0 and on iOS since ios-v6.24.0; `hillshade` predates both.[5] [6] A hillshade or color-relief layer sits in the layer order like any other layer, so put it above the fills it should shade. `["elevation"]` is the DEM value at the pixel, an expression of its own that takes no argument. On Android the same layer is built in code with the ramp passed as JSON through `Expression.raw()`, which is the builder route for `["elevation"]`, `interpolate-hcl` and `interpolate-lab` alike:[7]

```kotlin
style.addLayer(
    ColorReliefLayer("relief", "dem").withProperties(
        PropertyFactory.colorReliefColor(
            Expression.raw("""["interpolate", ["linear"], ["elevation"], 0, "#2e8b57", 1500, "#8b5a2b", 3000, "#ffffff"]""")
        )
    )
)
```

## `interpolate-hcl` and `interpolate-lab`: a version boundary

Both expressions work on Native from android-v13.7.1 and ios-v7.0.0 ([#4668](https://github.com/maplibre/maplibre-native/pull/4668)).[5] [6] On Android they go in style JSON or through `Expression.raw()`; the typed `Expression` builders stop at `interpolate`.

On an earlier release the paint value does not parse and the whole layer is dropped, with no crash. The one trace is a log line that reads `[ParseStyle]: value must be a string` and nothing more: no layer id, no property name, no expression. The symptom to work back from is one missing layer. The fix for a release you cannot raise is a plain `interpolate` with intermediate stops along the ramp:

```json
"fill-color": ["interpolate", ["linear"], ["get", "density"], 0, "#f7fbff", 1250, "#c6dbef", 2500, "#6baed6", 3750, "#2171b5", 5000, "#08306b"]
```

## PMTiles: built in, with one iOS trap

Native reads a PMTiles archive directly through its own `pmtiles://` scheme, since android-v11.8.0 and ios-v6.10.0 ([#2882](https://github.com/maplibre/maplibre-native/pull/2882)):[5] [6] no tile server, no MBTiles conversion, no custom source, and no `pmtiles` package or `URLProtocol` subclass. Put the scheme in front of the archive's full URL in the style:

```json
{ "basemap": { "type": "vector", "url": "pmtiles://https://example.com/basemap.pmtiles" } }
```

That style entry works on Android and iOS alike. A source built in Swift code uses `configurationURLString:`, the initializer that takes the string as is. `URL(string:)` mangles `pmtiles://https://` on iOS 17, so a source made with `configurationURL:` never loads ([#3151](https://github.com/maplibre/maplibre-native/issues/3151)):[8]

```swift
let basemap = MLNVectorTileSource(
    identifier: "basemap",
    configurationURLString: "pmtiles://https://example.com/basemap.pmtiles"
)
style.addSource(basemap)
```

- ❌ `MLNVectorTileSource(identifier: "basemap", configurationURL: URL(string: "pmtiles://https://…")!)`: the `URL` form is the one iOS 17 breaks.

Since android-v13.7.1 an archive bundled in the APK loads with `pmtiles://asset://…`.[5]

## Related Skills

- [**maplibre-terrain-rendering**](../maplibre-terrain-rendering/SKILL.md) — `hillshade`, `color-relief`, and 3D terrain on GL JS
- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md) — the `pmtiles` package and `addProtocol` on GL JS; serving and building archives

## References

1. [**MapLibre Native `js-parity` label**](https://github.com/maplibre/maplibre-native/issues?q=label%3Ajs-parity) — every open gap between the two renderers
2. [**maplibre-native#3562**](https://github.com/maplibre/maplibre-native/issues/3562) — custom URL schemes (`addProtocol`) on Native
3. [**maplibre-native#3161**](https://github.com/maplibre/maplibre-native/issues/3161) — globe projection on Native
4. [**maplibre-native#252**](https://github.com/maplibre/maplibre-native/issues/252) — 3D terrain on Native
5. [**MapLibre Native Android CHANGELOG**](https://github.com/maplibre/maplibre-native/blob/main/platform/android/CHANGELOG.md) — 11.0.0 custom `ModuleProvider` ([#2231](https://github.com/maplibre/maplibre-native/pull/2231)); 11.8.0 PMTiles ([#2882](https://github.com/maplibre/maplibre-native/pull/2882)); 13.0.0 `color-relief` ([#3965](https://github.com/maplibre/maplibre-native/pull/3965)); 13.5.0 `CustomVectorSource` ([#4377](https://github.com/maplibre/maplibre-native/pull/4377)); 13.7.1 `interpolate-lab` and `interpolate-hcl` ([#4668](https://github.com/maplibre/maplibre-native/pull/4668)) and `pmtiles://asset://` ([#4602](https://github.com/maplibre/maplibre-native/pull/4602))
6. [**MapLibre Native iOS CHANGELOG**](https://github.com/maplibre/maplibre-native/blob/main/platform/ios/CHANGELOG.md) — 6.0.0 the `MGL` to `MLN` prefix change; 6.10.0 PMTiles; 6.24.0 `color-relief`; 7.0.0 `interpolate-lab` and `interpolate-hcl`
7. [**Android API, android-v13.7.1**](https://github.com/maplibre/maplibre-native/tree/android-v13.7.1/platform/android/MapLibreAndroid/src/main/java/org/maplibre/android) — `ModuleProvider.java`, `http/HttpRequest.java`, `http/HttpResponder.java`, `module/http/HttpRequestImpl.java`, `module/http/HttpRequestUtil.java`, `style/sources/CustomVectorSource.kt`, `style/sources/CustomVectorTileProvider.kt`, `style/sources/TileData.kt`, `style/layers/ColorReliefLayer.java`, `style/layers/PropertyFactory.java`, `style/expressions/Expression.java`
8. [**`MLNVectorTileSource.h`**](https://github.com/maplibre/maplibre-native/blob/main/platform/darwin/src/MLNVectorTileSource.h) — the `configurationURLString:` initializer and its iOS 17 note; [maplibre-native#3151](https://github.com/maplibre/maplibre-native/issues/3151)
9. [**MapLibre GL JS CHANGELOG**](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md) — 4.0.0 promise-based `addProtocol`; 5.6.0 `color-relief`
10. [**MapLibre Native resource loading, ios-v7.0.0**](https://github.com/maplibre/maplibre-native/tree/ios-v7.0.0/platform) — `default/src/mln/storage/main_resource_loader.cpp` (the schemes Native reads itself), `darwin/src/MLNNetworkConfiguration.h` (`sessionConfiguration`), `darwin/core/http_file_source.mm` (the `URLSession` built from it and the `NSHTTPURLResponse` check)

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
