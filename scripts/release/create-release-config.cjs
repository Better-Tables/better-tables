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
      // Only bump package.json's version field here; the actual publish is
      // done via `bun publish` below so bun can resolve `workspace:*"`
      // dependency ranges to real semver before the tarball is packed.
      ['@semantic-release/npm', { npmPublish: false }],
      [
        '@semantic-release/exec',
        {
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
