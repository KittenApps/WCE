import { promises as fs } from 'node:fs';
import LoaderBuilder from './loaderBuilder.js';
import { defineConfig, build } from 'rolldown';

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
*/`
const loaderBuilder = new LoaderBuilder();

const config = defineConfig({
  input: 'src/index.ts',
  output: { 
    dir: 'dist',
    entryFileNames: 'wce.js',
    chunkFileNames: '[name].js',
    sourcemap: true,
    banner: c => c.isEntry ? LICENSE : undefined,
    minify: true,
    target: 'es2022',
    legalComments: 'inline',
  },
  resolve: {
    conditionNames: ['import'],
    alias: { 
      'dexie': 'dexie/dist/modern/dexie.mjs',
      'buttplug': 'buttplug/dist/web/buttplug.mjs',
    },
  },
  define: {
    PUBLIC_URL: `"${loaderBuilder.URL}"`,
  },
  plugins: [
    {
      name: 'loader-builder-plugin',
      async buildStart() {
        await fs.rm('dist', { recursive: true, force: true });
      },
      async generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'wce-fusam-loader.user.js', source: loaderBuilder.generateFusamLoader() });
        this.emitFile({ type: 'asset', fileName: 'wce-loader.user.js', source: loaderBuilder.generateStandaloneLoader() });
        await Promise.all((await fs.readdir('public')).map(fileName =>
          fs.readFile(`public/${fileName}`).then(source => this.emitFile({ type: 'asset', fileName, source }))
        ));
      },
    },
  ],
});

if (process.argv.includes('--watch')){
  await build({ input: 'loaderBuilder.js', plugins: [{ generateBundle(_, b) { delete b['loaderBuilder.js']; } }, config.plugins[0]]});
  config.plugins = [];
  config.output.minify = false;
  delete config.output.target;
}

export default config;
