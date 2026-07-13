---
"@better-tables/core": minor
---

Date columns now apply real timezone conversion. `formatDateWithConfig` and
`formatDateRange` convert through `@date-fns/tz`'s `TZDate` when
`meta.dateFormat.timeZone` is set, instead of accepting-but-ignoring it as
before — the rendered date/time now reflects wall-clock time in the
configured IANA zone (e.g. `'America/New_York'`), not the viewer's local
zone. `formatRelative`'s calendar-relative phrasing ("today", "yesterday")
converts too, since it's day-boundary-sensitive; `formatDistance`'s
elapsed-time phrasing ("3 hours ago") does not, since it's timezone-invariant
by construction. An unrecognized IANA zone name soft-fails: no throw, one
`console.warn` per unknown zone name, falls back to unconverted rendering.

**Blast radius — read before upgrading if you use date columns:**
`DateColumnBuilder.format()`, `.dateTime()`, and `.timeOnly()` all default
`timeZone` to `'UTC'` when the caller doesn't pass one explicitly (this
default already existed pre-0.6 and flows into `meta.dateFormat.timeZone`
unconditionally). Because that default is now honored as a real conversion,
any date column using one of these three methods **without an explicit
`timeZone` option** will flip from rendering in the viewer's local time zone
to rendering in UTC. Columns that already passed an explicit `timeZone` will
simply start converting correctly instead of being silently ignored.
`.dateOnly()` and `.relative()` don't set a default `timeZone` and are
unaffected unless you explicitly configured one. See `MIGRATION.md` for the
full note.
