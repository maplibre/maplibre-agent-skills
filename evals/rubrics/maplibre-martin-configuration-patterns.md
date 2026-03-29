# Rubric: maplibre-martin-configuration-patterns

Scope: five core configuration gotchas only.

## What a correct answer must include

- [ ] States that Martin uses YAML format only for config files
- [ ] Clarifies that TOML and JSON are not supported config formats
- [ ] Explains that `--config` and CLI connection strings are mutually
      exclusive — when `--config` is set, CLI args are silently ignored
- [ ] Mentions that `DATABASE_URL` environment variable silently overrides
      the database connection in the config file
- [ ] States that `public_urls` must be set in the config file when Martin
      runs behind a reverse proxy, so TileJSON shows the correct public URL
- [ ] States that Martin has no built-in authentication — no `auth:` key exists
- [ ] Explains that authentication must be layered at a reverse proxy or CDN
