import { promises as fs } from 'node:fs';
import LoaderBuilder from './loaderBuilder.js';
import { defineConfig } from 'rolldown';

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

export default defineConfig({
  input: 'src/index.ts',
  output: { 
    dir: 'dist',
    entryFileNames: 'wce.js',
    chunkFileNames: '[name].js',
    generatedCode: 'es2015',
    sourcemap: true,
    banner: c => c.isEntry ? LICENSE : undefined,
    minify: true,
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
        await Promise.all(['baby.png', 'icon.png', 'stutter.png'].map(fileName =>
          fs.readFile(`public/${fileName}`).then(source => this.emitFile({ type: 'asset', fileName, source }))
        ));
      },
    },
  ],
});
