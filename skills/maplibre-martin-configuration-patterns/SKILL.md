---
name: maplibre-martin-configuration-patterns
description: >
  Expert guidance on Martin tile server deployment and configuration,
  covering operational gotchas that AI tools frequently hallucinate or get wrong:
  config format (YAML only), --config vs CLI mutual exclusion, DATABASE_URL silent
  override, TileJSON host behind reverse proxy, and no built-in authentication.
---

# Martin Configuration Patterns

Martin is a blazing-fast tile server written in Rust. It serves vector tiles
from PostGIS databases, MBTiles files, and PMTiles files.

Use this skill when:

- Debugging a Martin config file that isn't being read
- Martin is connecting to the wrong database unexpectedly
- Setting up Martin behind a reverse proxy
- Understanding why Martin has no built-in authentication
- Configuring PostgreSQL, MBTiles, or PMTiles sources

## Scope of This Skill

This skill covers the five core configuration gotchas from the
[martin-configuration-patterns issue](https://github.com/maplibre/maplibre-agent-skills/issues/18):

1. Config format: YAML only
2. `--config` and CLI args are mutually exclusive
3. `DATABASE_URL` silently overrides config
4. TileJSON `tiles` field reflects internal host behind a reverse proxy
5. No built-in authentication — by design

---

## Critical Gotchas

### 1. Config format: YAML only — not TOML, not JSON

Martin config files are **YAML only**. This is a confirmed source of AI
hallucination: in [martin#1892](https://github.com/maplibre/martin/issues/1892),
a developer was told by ChatGPT to use `.toml` format. Martin silently ignored it.

Wrong — Martin will silently ignore this:

```bash
martin --config config.toml
```

Correct — must be YAML:

```bash
martin --config config.yaml
```

**Rule:** File must end in `.yaml` or `.yml` and contain valid YAML.

---

### 2. `--config` and CLI connection parameters are mutually exclusive

If `--config` is set, CLI connection strings are **silently ignored** — no
warning is shown. See [martin#938](https://github.com/maplibre/martin/issues/938).

Wrong — connection string is ignored silently:

```bash
martin --config my-config.yaml postgres://user:pass@localhost/my_db
```

Correct — use one or the other:

```bash
martin --config my-config.yaml
```

**Rule:** Put all connection info inside the config file when using `--config`.
Do not mix with CLI connection strings.

---

### 3. `DATABASE_URL` silently overrides the config file

When `DATABASE_URL` is set in the environment, it **silently overrides** the
database connection in your config file. PaaS platforms like DigitalOcean,
Railway, and Render **automatically inject** `DATABASE_URL`, making this a
common trap in cloud deployments. See [martin#1050](https://github.com/maplibre/martin/issues/1050).

**Rule:** If Martin connects to the wrong database, check:

```bash
echo $DATABASE_URL
```

If set, either unset it or ensure it points to the correct database.

---

### 4. TileJSON `tiles` field reflects internal host behind a reverse proxy

When running behind a reverse proxy (Nginx, Caddy, etc.), the `tiles` field
in TileJSON responses shows the **internal** host (e.g. `http://localhost:3000/...`)
instead of your public URL. This breaks clients that use TileJSON to discover
tile endpoints. See [martin#1054](https://github.com/maplibre/martin/issues/1054).

✅ Fix — set `public_urls` in your config file:

```yaml
public_urls:
  - https://tiles.example.com
```

Or configure your reverse proxy to forward these headers:

- `X-Forwarded-Host`
- `X-Forwarded-Proto`
- `X-Forwarded-Port`

**Rule:** Always set `public_urls` when deploying behind a reverse proxy.

---

### 5. No built-in authentication — by design

Martin has **no built-in authentication**. There is no `auth:` key in Martin's
config — it does not exist. This is intentional.
See [martin#78](https://github.com/maplibre/martin/issues/78).

Security (JWT, bearer tokens, API keys, IP allowlists) must be layered at:

- A reverse proxy (Nginx, Caddy, Traefik)
- A CDN (Cloudflare, AWS CloudFront)
- An API gateway

**Rule:** Do not look for auth config in Martin. Route tile requests through
a proxy or CDN that handles authentication.

---

## Configuration File Reference

For all supported options, refer to the **fully commented config file**:

👉 [config.yaml](https://raw.githubusercontent.com/maplibre/martin/refs/heads/main/docs/content/files/config.yaml)

Read this before writing your own config from scratch. It covers every
supported key with inline explanations.

---

## Helpful Debugging Steps

When Martin isn't behaving as expected, check in this order:

1. **Config format** — Is your file `.yaml`? Not `.toml` or `.json`?
2. **`DATABASE_URL`** — Run `echo $DATABASE_URL`. Is it set unexpectedly?
3. **`--config` vs CLI args** — Are you mixing them? Pick one.
4. **TileJSON host** — Is `tiles` showing `localhost`? Set `public_urls`.
5. **Auth** — There is no built-in auth. Use a proxy.
6. **Debug logging** — `RUST_LOG=martin=debug martin --config config.yaml`
7. **Effective config** — `martin --save-config -` prints what Martin sees
   after merging env vars, CLI args, and config file.

---

## Reference

- [Martin documentation](https://maplibre.org/martin/)
- [Commented config file reference](https://raw.githubusercontent.com/maplibre/martin/refs/heads/main/docs/content/files/config.yaml)
- [Tile sources comparison](https://maplibre.org/martin/sources-tiles/)
- [PostGIS + MBTiles recipe](https://maplibre.org/martin/recipe-basemap-postgis/)
- [martin#938](https://github.com/maplibre/martin/issues/938) — `--config` vs CLI mutual exclusion
- [martin#1050](https://github.com/maplibre/martin/issues/1050) — `DATABASE_URL` silent override
- [martin#1054](https://github.com/maplibre/martin/issues/1054) — TileJSON host behind proxy
- [martin#1892](https://github.com/maplibre/martin/issues/1892) — TOML hallucination (confirmed)
