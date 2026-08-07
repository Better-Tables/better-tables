#!/usr/bin/env bash
# Runs semantic-release once per publishable package, in dependency order,
# so that `bun publish` always sees already-bumped `workspace:*` versions
# for packages released earlier in the same run: adapters-toolkit depends
# on core (peerDependency), and adapters-drizzle depends on both core and
# adapters-toolkit.
#
# Each package's semantic-release run (@semantic-release/git) commits its
# own version bump + CHANGELOG.md locally and pushes it before returning,
# so the working tree here is already up to date for the next package in
# the loop without needing to re-fetch/reset from origin. Deliberately NOT
# re-syncing from origin/main between iterations: this job is scoped to
# the exact commit that the triggering Test Suite run validated
# (.github/workflows/release.yml concurrency-serializes release runs so
# nothing else pushes to main mid-loop), and pulling in unrelated later
# commits here would let a later package publish source that never passed
# that gate.
#
# Used by .github/workflows/release.yml on every push to main, and
# available locally as `bun run release:dry-run` for a safe, no-side-effect
# preview of what would be released.
set -euo pipefail

PACKAGES=(
  "packages/core"
  "packages/adapters/toolkit"
  "packages/adapters/drizzle"
  "packages/cli"
)

EXTRA_ARGS=()
if [ "${DRY_RUN:-}" = "1" ]; then
  EXTRA_ARGS+=("--dry-run")
fi

for pkg in "${PACKAGES[@]}"; do
  echo "=== semantic-release: ${pkg} ==="
  (cd "${pkg}" && bunx semantic-release "${EXTRA_ARGS[@]}")
done
