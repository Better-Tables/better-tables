---
"@better-tables/core": minor
---

Remove reserved-but-unimplemented config surface (0.6 policy: replaced
surface is removed outright, no compat shims): `TableConfig.defaultFilters`
(use the `initialFilters` prop), `.actionsConfig`, `.exportOptions`,
`.theme`, `.loadingState` (use the `loading` prop), and the `TableFeatures`
flags `bulkActions`, `export`, `columnResizing`, `virtualScrolling` (use the
`virtualized` prop), `realTimeUpdates`, `rowExpansion`. The now-orphaned
`ExportConfig`, `LoadingStateConfig`, `TableTheme`, and `ActionsConfig` types
are removed with them. Each capability returns only with a real
implementation (export UI, actions module, etc.). The adapter contract
(`exportData`, `subscribe`, `AdapterFeatures`) is unchanged.
