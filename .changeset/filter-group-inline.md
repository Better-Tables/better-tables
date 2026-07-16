---
"@better-tables/core": minor
---

Add `FilterGroup.inline` to control filter-menu layout

A `FilterGroup` can now set `inline: true` to render its columns directly at
the top level of the filter menu (flat, each individually selectable) instead
of as a collapsible row you drill into. Inline and drill-in groups can be
combined freely in one menu — e.g. render the semantic groups inline while a
catch-all "Other" bucket stays a drill-in group. Defaults to `false`
(drill-in), so existing menus are unchanged.

The bundled `@better-tables/ui` filter dropdown honors this flag, and its
auto-grouped layout now inlines the generated semantic groups by default while
keeping the "Other" bucket collapsible.
