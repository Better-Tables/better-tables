---
"@better-tables/core": minor
---

Harden the HTTP adapter: `authorize` / `constrainRequest` / `onError` route
options, honest 400/403/500 status mapping with generic server errors, fix
`fetchData.faceted` Map wire serialization, and add `FacetQueryParams.signal`
for cancellable facet reads.
