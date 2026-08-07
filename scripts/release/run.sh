#!/usr/bin/env bash
# Runs semantic-release once per publishable package, in dependency order,
# so that `bun publish` always sees already-bumped `workspace:*` versions
# for packages released earlier in the same run (e.g. adapters-toolkit
# before adapters-drizzle, which depends on it).
#
# Used by .github/workflows/release.yml on every push to main, and
# available locally as `bun run release:dry-run` for a safe, no-side-effect
# preview of what would be released.
set -euo pipefail

PACKAGES=(
  "packages/adapters/toolkit"
  "packages/core"
  "packages/adapters/drizzle"
  "packages/cli"
)

EXTRA_ARGS=()
if [ "${DRY_RUN:-}" = "1" ]; then
  EXTRA_ARGS+=("--dry-run")
fi

for pkg in "${PACKAGES[@]}"; do
  echo "=== semantic-release: ${pkg} ==="

  # In CI, a prior package in this loop may have already committed +
  # pushed a version bump to main (via @semantic-release/git). Sync before
  # each package so `bun publish` resolves `workspace:*` deps against the
  # latest released versions instead of a stale local checkout.
  if [ "${GITHUB_ACTIONS:-}" = "true" ] && [ "${DRY_RUN:-}" != "1" ]; then
    git fetch origin main
    git reset --hard origin/main
  fi

  (cd "${pkg}" && bunx semantic-release "${EXTRA_ARGS[@]}")
done
