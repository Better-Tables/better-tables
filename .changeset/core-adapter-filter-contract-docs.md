---
"@better-tables/core": patch
---

Correct `FetchDataParams.filters` and `EditableConfig.field` docs to match runtime: adapters receive both flat arrays and group trees (no pre-dispatch canonicalization), and relationship-path edits resolve via write-target / saveAction rather than being callback-only.
