#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { generatePodsWithLdbcFiles } from "./ldbc-files.js";
import { generatePodsAndFiles } from "./generate-files.js";
import { generateUsers } from "./generate-users.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { AnyFetchType, es6fetch } from "./generic-fetch.js";
import nodeFetch from "node-fetch";

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 --url <url> --generate-xxx --generate-yyy ...")
  .option("url", {
    group: "CSS Server:",
    alias: "u",
    type: "string",
    description: "Base URL of the CSS",
    demandOption: true,
  })
  .option("user-count", {
    group: "CSS Server:",
    type: "number",
    description: "Number of users/pods to generate/populate",
    demandOption: true,
  })
  .option("generate-users", {
    group: "Generate users:",
    type: "boolean",
    description:
      "Generate users. If not specified, it is assumed users have already been generated.",
    default: false,
    demandOption: false,
  })
  .option("generate-rnd", {
    group: "Generate .rnd Content:",
    type: "boolean",
    description:
      "Generate files with random bin data named 10.rnd, 100.rnd, ...  10_000_000.rnd",
    default: false,
    demandOption: false,
  })
  .option("delete-count", {
    group: "Generate .rnd Content:",
    type: "number",
    description: "Number of files for delete test to generate",
    demandOption: false,
    default: 0,
    implies: ["generate-rnd"],
  })
  .option("generate-from-ldbc-dir", {
    group: "Generate Content from LDBC:",
    type: "boolean",
    description: "Generate content based on LDBC dir",
    default: false,
    demandOption: false,
  })
  .option("dir", {
    group: "Generate Content from LDBC:",
    type: "string",
    description: "Dir with the generated data",
    demandOption: false,
    implies: ["generate-from-ldbc-dir"],
  })
  .help()
  .check((argv, options) => {
    if (argv.generateUsers && !argv.userCount) {
      return "--generate-rnd requires --user-count";
    }
    if (argv.generateRnd && !argv.userCount) {
      return "--generate-rnd requires --user-count";
    }
    if (argv.generateFromLdbcDir && !argv.dir) {
      return "--generate-from-ldbc-dir generate requires --dir";
    }
    if (!argv.generateFromLdbcDir && !argv.generateRnd) {
      return "select at least one --generate-xxx option";
    }
    return true;
  })
  .wrap(120)
  .parseSync();

const cssBaseUrl = argv.url.endsWith("/") ? argv.url : argv.url + "/";
const generatedDataBaseDir =
  argv.source === "dir"
    ? argv.dir?.endsWith("/")
      ? argv.dir
      : argv.dir + "/"
    : null;
const usercount = argv.userCount || 1;

async function main() {
  const fetcher: AnyFetchType = true ? nodeFetch : es6fetch;

  const authFetchCache = new AuthFetchCache(cssBaseUrl, true, "all", fetcher);

  if (argv.generateUsers) {
    await generateUsers(authFetchCache, cssBaseUrl, usercount);
  }

  if (argv.generateRnd) {
    await generatePodsAndFiles(authFetchCache, cssBaseUrl, usercount);
  }

  if (argv.generateFromLdbcDir && generatedDataBaseDir) {
    await generatePodsWithLdbcFiles(
      authFetchCache,
      cssBaseUrl,
      generatedDataBaseDir
    );
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
