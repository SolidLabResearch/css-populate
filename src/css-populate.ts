#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { generatePodsWithLdbcFiles } from "./ldbc-files.js";
import { generatePodsAndFiles } from "./generate-files.js";

const argv = yargs(hideBin(process.argv))
  .option("url", {
    alias: "u",
    type: "string",
    description: "Base URL of the CSS",
    demandOption: true,
  })
  .option("source", {
    alias: "s",
    type: "string",
    description: "Source of generated data",
    choices: ["dir", "generate"],
    demandOption: true,
  })
  .option("dir", {
    alias: "g",
    type: "string",
    description: "Dir with the generated data",
    demandOption: false,
    conflicts: ["count"],
  })
  .option("count", {
    alias: "c",
    type: "number",
    description: "Number of users/pods to generate",
    demandOption: false,
    conflicts: ["dir"],
  })
  .help()
  .check((argv, options) => {
    if (argv.source === "dir" && !argv.dir) {
      return "--source dir requires --dir";
    }
    if (argv.source === "generate" && !argv.count) {
      return "--source generate requires --count";
    }
    return true;
  })
  .parseSync();

const cssBaseUrl = argv.url.endsWith("/") ? argv.url : argv.url + "/";
const generatedDataBaseDir =
  argv.source === "dir"
    ? argv.dir?.endsWith("/")
      ? argv.dir
      : argv.dir + "/"
    : null;
const generateCount = argv.count || 1;

async function main() {
  if (argv.source === "dir" && generatedDataBaseDir) {
    await generatePodsWithLdbcFiles(cssBaseUrl, generatedDataBaseDir);
  }

  if (argv.source === "generate") {
    await generatePodsAndFiles(cssBaseUrl, generateCount);
  }
}

//require.main === module only works for CommonJS, not for ES modules in Node.js
//(though on my test system with node v15.14.0 it works, and on another system with node v17.5.0 it doesn't)
//so we will simply not check. That means you don't want to import this module by mistake.
// if (require.main === module) {
try {
  await main();
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
// }
