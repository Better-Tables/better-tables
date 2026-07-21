---
"@better-tables/core": minor
"@better-tables/adapters-drizzle": patch
"@better-tables/cli": minor
---

Ship data export. The current (filtered, sorted) view can now be downloaded as CSV or JSON.

- **core** — `ExportParams` gains optional `filters` / `sorting` (so an export reflects the current view) and `maxRows`; `DEFAULT_EXPORT_ROW_CAP` (50,000) bounds the export fetch. `httpAdapter` now advertises `features.export` and implements `exportData` by reusing its fetch proxy and formatting CSV/JSON client-side (no extra route; Excel unsupported over HTTP). New `csvExport()` plugin (rides the 049 hook seam) captures the latest fetch and formats it via the new `recordsToCsv` / `recordsToJson` helpers.
- **adapters-drizzle** — `exportData` now honors `params.filters`/`sorting` (previously ignored) and is bounded by `maxRows`/`DEFAULT_EXPORT_ROW_CAP` instead of an unbounded `MAX_SAFE_INTEGER` fetch; CSV formula-injection escaping is unchanged.
- **cli** — new `export` UI module (`better-tables add export`): copies `export-button.tsx` + `use-table-export.ts`. `ExportButton` occupies the `toolbarExtra` slot and offers CSV/JSON, rendering nothing when the adapter can't export.
