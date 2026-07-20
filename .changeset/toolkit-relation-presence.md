---
'@better-tables/adapters-toolkit': patch
---

Fix related columns silently rendering blank when a nullable relation column was requested first

`DataTransformer` decided whether a one-to-one related row existed by testing a
single column — whichever related column the caller happened to list first.
When that column was `NULL` for a row, the entire related object was replaced
with `null`, so every other related column rendered blank even though the JOIN
had returned data for them.

Requesting `['profile.github', 'profile.location', 'profile.bio']` against real
data lost the whole profile on ~half the page (rows where `github` was NULL),
while the identical query with `profile.id` listed first returned everything.
Callers were only safe by accident, depending on column order.

Presence is now derived from the related table's primary key — the same signal
`processOneToManyColumn` already used — falling back to "any requested related
column carries a value" when the PK was not selected. Results no longer depend
on the order columns are requested in. One-to-many relations were never
affected.
