# Eval Results: maplibre-martin-configuration-patterns

These results show the baseline model responses without the skill injected.

Eval config: [`evals/prompts/maplibre-martin-configuration-patterns.yaml`](../prompts/maplibre-martin-configuration-patterns.yaml)

## Summary

| Test                                                  | Type         | Baseline |
| ----------------------------------------------------- | ------------ | -------- |
|TOML config silently ignored by martin
| Explicit     | 0.00     |
| base_path vs public_urls                              | Explicit     | 0.00     |
| --config and CLI mutually exclusive                   | Explicit     | 0.00     |
| DATABASE_URL override does not log a warning          | Explicit     | 0.00     |
| Proxy headers alone not sufficient for TileJSON       | Anti-pattern | 0.00     |
| Martin has no built-in API key auth config key        | Anti-pattern | 0.00     |
| CORS default allows all origins                       | Explicit     | 0.00     |
| CORS restrict to specific origin                      | Implicit     | 0.00     |
| CORS disable entirely                                 | Explicit     | 0.00     |
| Negative — PMTiles hosting unrelated to Martin config | Negative     | 1.00     |
