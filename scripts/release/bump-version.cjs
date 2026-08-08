#!/usr/bin/env node
'use strict';

// @semantic-release/npm's `prepare` step shells out to the real `npm` CLI to
// write the new version into package.json. `npm` fails on this repo's Bun
// workspace-catalog dependency specifiers ("typescript": "catalog:", etc.)
// with EUNSUPPORTEDPROTOCOL, since it doesn't understand `catalog:`. This
// script bumps just the `version` field via plain JSON read/write, which
// never parses dependency specifiers, so it works regardless of `catalog:`
// or `workspace:*` ranges elsewhere in the manifest.

const fs = require('node:fs');
const path = require('node:path');

const version = process.argv[2];
if (!version) {
  throw new Error('Usage: bump-version.cjs <version>');
}

const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
