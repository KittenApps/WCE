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
`
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
        { find: 'dexie', replacement: 'dexie/dist/dexie.mjs' }
      ],
    }),
    nodeResolve({ modulesOnly: true }),
    esbuild({
      sourceMap: true,
      minify: true,
      target: 'esnext',
      define: {
        PUBLIC_URL: URL ? `"${URL}"` : '"http://localhost:4000"',
      },
    }),
    copy({
      targets: [
        { src: 'public/*.png', dest: 'dist' },
        { 
          src: 'public/*.user.js',
          dest: 'dist',
          transform: (contents) => {
            if (process.env.NETLIFY) {
              const NAME = `@name WCE${process.env.BRANCH === 'main' ? '' : ' ' + process.env.BRANCH} loader`;
              return contents.toString().replace('http://localhost:4000', URL).replace('@name WCE loader local', NAME);
            }
            return contents
          }
        }
      ]
    })
  ],
}