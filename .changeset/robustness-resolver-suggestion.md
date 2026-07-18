---
"@better-tables/adapters-toolkit": patch
---

Resolver "did you mean" hints now include exact column-name matches under a
different table prefix (e.g. `user.name` suggests `users.name`; plan 051).
