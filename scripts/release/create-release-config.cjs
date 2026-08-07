'use strict';

const COMMIT_ANALYZER_PRESET = 'conventionalcommits';

/**
 * Shared semantic-release config for one publishable package in this
 * monorepo. `semantic-release-monorepo` scopes commit analysis to whatever
 * directory semantic-release is invoked from, so each package's
 * release.config.cjs must be run with that package's directory as cwd.
 *
 * @param {{ name: string, tagFormat?: string }} options
 */
function createReleaseConfig({ name, tagFormat }) {
  if (!name) {
    throw new Error('createReleaseConfig requires a package `name`');
  }

  return {
    branches: ['main'],
    // Preserve the tag format used by the previous changesets-based release
    // workflow (`@scope/pkg@1.2.3`) so tag history stays continuous.
    tagFormat: tagFormat || `${name}@\${version}`,
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
