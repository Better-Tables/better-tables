---
"@better-tables/core": patch
---

getFormatterForType now formats date columns receiving ISO strings or epoch
numbers (as produced by JSON transports like httpAdapter) instead of
rendering them raw.
