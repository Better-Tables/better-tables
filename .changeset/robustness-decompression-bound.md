---
"@better-tables/core": patch
---

Fail-closed bounds on URL decompression: cap encoded payload length,
decompressed JSON size, and `renameKeys` recursion depth in
`decompressAndDecode` (plan 051, SEC-05).
