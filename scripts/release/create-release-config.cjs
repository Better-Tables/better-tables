'use strict';

const COMMIT_ANALYZER_PRESET = 'conventionalcommits';

/**
 * Shared semantic-release config for one publishable package in this
 * monorepo. `semantic-release-monorepo` scopes commit analysis to whatever
 * directory semantic-release is invoked from, so each package's
 * release.config.cjs must be run with that package's directory as cwd.
 *
 * Deliberately does NOT override `tagFormat`: semantic-release-monorepo's
 * `generateNotes`/`success`/`fail` wrapping unconditionally renders release
 * notes and changelog headings using its own `<name>-v<version>` format
 * (see its `version-to-git-tag.js`), regardless of what `tagFormat` this
 * config sets. Overriding `tagFormat` to a different scheme (e.g. the
 * `<name>@<version>` format the old changesets-based tags used) makes the
 * actual git tag disagree with the CHANGELOG.md/release-notes heading text.
 * Using the library's own default for both keeps them consistent.
 *
 * @param {{ name: string }} options
 */
function createReleaseConfig({ name }) {
  if (!name) {
    throw new Error('createReleaseConfig requires a package `name`');
  }

  return {
    branches: ['main'],
    extends: 'semantic-release-monorepo',
    plugins: [
      ['@semantic-release/commit-analyzer', { preset: COMMIT_ANALYZER_PRESET }],
      ['@semantic-release/release-notes-generator', { preset: COMMIT_ANALYZER_PRESET }],
      '@semantic-release/changelog',
      [
        '@semantic-release/exec',
        {
          // Bump package.json's version field via a plain JSON read/write
          // (bump-version.cjs) rather than `@semantic-release/npm`'s
          // `prepare` step, which shells out to the real `npm` CLI — `npm`
          // can't parse this repo's Bun workspace-catalog dependency specs
          // ("typescript": "catalog:", etc.) and fails with
          // EUNSUPPORTEDPROTOCOL. The actual publish is done via
          // `bun publish` below, which does understand `catalog:` and
          // `workspace:*` and resolves them to real semver before packing.
          prepareCmd: `node "$(git rev-parse --show-toplevel)/scripts/release/bump-version.cjs" \${nextRelease.version}`,
          publishCmd: 'bun publish --access public',
        },
      ],
      [
        '@semantic-release/git',
        {
          assets: ['package.json', 'CHANGELOG.md'],
          message: `chore(release): ${name} \${nextRelease.version} [skip ci]\n\n\${nextRelease.notes}`,
        },
      ],
      [
        '@semantic-release/github',
        {
          successComment: false,
          failComment: false,
        },
      ],
    ],
  };
}

module.exports = createReleaseConfig;
