#!/usr/bin/env node

import * as esbuild from 'esbuild'
import { promises as fs } from 'node:fs';

esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  splitting: true,
  minify: true,
  outdir: 'dist',
  entryNames: 'wce',
  format: 'esm',
  sourcemap: 'linked'
});

if (process.env.NETLIFY) {
  const URL = process.env.CONTEXT === 'production' ? process.env.URL : process.env.DEPLOY_PRIME_URL;
  const NAME = `@name WCE${process.env.BRANCH === 'main' ? '' : ' ' + process.env.BRANCH} loader`;
  ['dist/wce-fusam-loader.user.js', 'dist/wce-loader.user.js'].map(f => fs.readFile(f, {encoding: 'utf8'}).then(
    c => fs.writeFile(f, c.replace('http://localhost:4000', URL).replace('@name WCE loader', NAME))
  ));
}