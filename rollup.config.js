import esbuild from 'rollup-plugin-esbuild'
import nodeResolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import alias from '@rollup/plugin-alias';
import { promises as fs } from 'node:fs';

await fs.rm('dist', { recursive: true, force: true });

const LICENSE = `/**
* @license GPL-3.0-or-later
*     BCE/FBC
*  Copyright (C) 2024  Sid
*
*  This program is free software: you can redistribute it and/or modify
*  it under the terms of the GNU General Public License as published by
*  the Free Software Foundation, either version 3 of the License, or
*  (at your option) any later version.
*
*  This program is distributed in the hope that it will be useful,
*  but WITHOUT ANY WARRANTY; without even the implied warranty of
*  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*  GNU General Public License for more details.
*
*  You should have received a copy of the GNU General Public License
*  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
`;
const MATCH = `// @match https://bondageprojects.elementfx.com/*
// @match https://www.bondageprojects.elementfx.com/*
// @match https://bondage-europe.com/*
// @match https://www.bondage-europe.com/*`;
const URL = process.env.CONTEXT === 'production' ? process.env.URL : process.env.DEPLOY_PRIME_URL;

export default {
  input: 'src/index.ts',
  output: { 
    dir: 'dist',
    entryFileNames: 'wce.js',
    chunkFileNames: '[name].js',
    generatedCode: 'es2015',
    sourcemap: true,
    banner: (chunk) => chunk.name === 'index' ? LICENSE : undefined,
  },
  plugins: [
    alias({
      entries: [
        { find: 'buttplug', replacement: 'buttplug/dist/web/buttplug.mjs' },
        { find: 'dexie', replacement: 'dexie/dist/modern/dexie.mjs' }
      ],
    }),
    nodeResolve({ modulesOnly: true }),
    esbuild({
      sourceMap: true,
      minify: true,
      target: 'es2022',
      define: {
        PUBLIC_URL: URL ? `"${URL}"` : '"http://localhost:4000"',
      },
    }),
    copy({
      targets: [
        { src: 'public/*.png', dest: 'dist' },
        ...(process.env.NETLIFY && (process.env.BRANCH === 'main' || process.env.BRANCH === 'beta') ? [{ 
            src: 'public/wce-fusam-loader.user.js',
            dest: 'dist',
            transform: (contents) => contents.toString()
              .replace('@name WCE loader', `@name WCE${process.env.BRANCH === 'main' ? '' : ' ' + process.env.BRANCH} loader`)
              .replace('??= "stable";', `??= "${process.env.BRANCH === 'main' ? 'stable' : 'dev'}";`)
          }] : [{ 
            src: 'public/wce-local-loader.user.js',
            dest: 'dist',
            rename: 'wce-fusam-loader.user.js',
            transform: (contents) => {
              if (process.env.NETLIFY) {
                return contents.toString()
                  .replace('http://localhost:4000', URL)
                  .replace('@name WCE local loader', `@name WCE PR #${process.env.REVIEW_ID} loader`)
                  .replace('// @match http://localhost:*/*', MATCH);
              }
              return contents
            }
          }]
        ),
        { 
          src: 'public/wce-loader.user.js',
          dest: 'dist',
          transform: (contents) => {
            if (process.env.NETLIFY) {
              const BRANCH = process.env.BRANCH === 'main' ? '' : (process.env.BRANCH === 'beta' ? ' beta': ` PR #${process.env.REVIEW_ID}`);
              return contents.toString()
                .replace('http://localhost:4000', URL)
                .replace('@name WCE local loader', `@name WCE${BRANCH} loader`)
                .replace('// @match http://localhost:*/*', MATCH);
            }
            return contents
          }
        }
      ]
    })
  ],
}
