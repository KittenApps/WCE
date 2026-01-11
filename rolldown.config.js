import { promises as fs } from "node:fs";
import { defineConfig } from "rolldown";

import LoaderBuilder from "./loaderBuilder.js";

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
*/`;
const loaderBuilder = new LoaderBuilder();

const config = defineConfig({
  input: "src/index.ts",
  output: {
    dir: "dist",
    entryFileNames: "wce.js",
    chunkFileNames: "[name].js",
    sourcemap: true,
    postBanner: c => (c.isEntry ? LICENSE : undefined),
    minify: true,
    legalComments: "inline",
    cleanDir: true,
  },
  transform: { target: "es2022", define: { PUBLIC_URL: `"${loaderBuilder.URL}"` } },
  resolve: { alias: { buttplug: "buttplug/dist/web/buttplug.mjs" } },
  plugins: [
    {
      name: "loader-builder-plugin",
      async generateBundle() {
        this.emitFile({ type: "asset", fileName: "wce-fusam-loader.user.js", source: loaderBuilder.generateFusamLoader() });
        this.emitFile({ type: "asset", fileName: "wce-loader.user.js", source: loaderBuilder.generateStandaloneLoader() });
        this.emitFile({ type: "asset", fileName: "dexie.js", source: "" });
        const publicFiles = await fs.readdir("public");
        await Promise.all(publicFiles.map(fileName => fs.readFile(`public/${fileName}`).then(source => this.emitFile({ type: "asset", fileName, source }))));
      },
    },
  ],
});

if (process.argv.includes("--watch")) {
  fs.writeFile("dist/wce-fusam-loader.user.js", loaderBuilder.generateFusamLoader());
  fs.writeFile("dist/wce-loader.user.js", loaderBuilder.generateStandaloneLoader());
  const publicFiles = await fs.readdir("public");
  publicFiles.map(fileName => fs.copyFile(`public/${fileName}`, `dist/${fileName}`));
  config.plugins = [];
  config.output.minify = false;
  config.output.cleanDir = false;
}

export default config;
