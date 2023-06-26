#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { generatePodsWithLdbcFiles } from "./ldbc-files.js";
import {
  generateFixedSizeFiles,
  generateRdfFiles,
  generateVariableSizeFiles,
} from "./generate-files.js";
import { generatePodsAndUsers } from "./generate-users.js";
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
  .option("generate-variable-size", {
    group: "Generate Variable Size Content:",
    type: "boolean",
    description:
      "Generate 7 files with random data of increasing size: 10.rnd, ...  10_000_000.rnd",
    default: false,
    demandOption: false,
  })
  .option("generate-fixed-size", {
    group: "Generate Fixed Size Content:",
    type: "boolean",
    description:
      "Generate a configurable number of files of configurable fixed size",
    default: false,
    demandOption: false,
  })
  .option("file-count", {
    group: "Generate Fixed Size Content:",
    type: "number",
    description: "Number of files to generate",
    demandOption: false,
    default: 0,
    implies: ["generate-fixed-size"],
  })
  .option("file-size", {
    group: "Generate Fixed Size Content:",
    type: "number",
    description: "Size of files to generate",
    demandOption: false,
    default: 0,
    implies: ["generate-fixed-size"],
  })
  .option("generate-rdf", {
    group: "Generate RDF Content:",
    type: "boolean",
    description: "Generate RDF files with various content types",
    default: false,
    demandOption: false,
  })
  .option("base-rdf-file", {
    group: "Generate RDF Content:",
    type: "string",
    description:
      "Base RDF file to upload. Will be converted into various RDF file formats.",
    demandOption: false,
    implies: ["generate-rdf"],
  })
  .option("generate-from-ldbc-dir", {
    group: "Generate Content from LDBC:",
    type: "boolean",
    description: "Generate content based on LDBC dir",
    default: false,
    demandOption: false,
  })
  .option("add-acl-files", {
    group: "Generate Content:",
    type: "boolean",
    description:
      "Upload a corresponding .acl file for each generated file and/or dir",
    default: false,
    demandOption: false,
  })
  .option("add-acr-files", {
    group: "Generate Content:",
    type: "boolean",
    description:
      "Upload a corresponding .acr file for each generated file and/or dir",
    default: false,
    demandOption: false,
  })
  .option("add-ac-file-per-resource", {
    group: "Generate Content:",
    type: "boolean",
    description:
      "Upload a corresponding .acl/.acr file for each generated file. Use --no-add-ac-file-per-resource to set to false.",
    default: true,
    demandOption: false,
  })
  .option("add-ac-file-per-dir", {
    group: "Generate Content:",
    type: "boolean",
    description:
      "Upload a corresponding .acl/.acr file for each pod root and subdir. Use --no-add-ac-file-per-dir to set to false.",
    default: true,
    demandOption: false,
  })
  .option("dir-depth", {
    group: "Generate Content:",
    type: "number",
    description:
      "Put the generated content in this amount of nested subdirs. Use 0 for no subdirs (= files in pod root). " +
      "Subdirs will all be named 'data'. " +
      "Example generated file if this option is 2: https://example.com/user0/data/data/10.rnd",
    default: 0,
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
      return "--generate-users requires --user-count";
    }
    if (argv.generateFixedSize && !argv.userCount) {
      return "--generate-fixed-size requires --user-count";
    }
    if (argv.generateFixedSize && !argv.fileSize) {
      return "--generate-fixed-size requires --file-size";
    }
    if (argv.generateFixedSize && !argv.fileCount) {
      return "--generate-fixed-size requires --file-count";
    }
    if (argv.generateFromLdbcDir && !argv.dir) {
      return "--generate-from-ldbc-dir requires --dir";
    }
    if (argv.generateRdf && !argv.baseRdfFile) {
      return "--generate-rdf requires --base-rdf-file";
    }
    if (
      !argv.generateFromLdbcDir &&
      !argv.generateVariableSize &&
      !argv.generateRdf &&
      !argv.generateFixedSize
    ) {
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
const fileSize = argv.fileSize || 10;
const fileCount = argv.fileCount || 1;
const addAclFiles = argv.addAclFiles || false;
const addAcrFiles = argv.addAcrFiles || false;
const dirDepth = argv.dirDepth || 0;
const addAcFilePerDir = argv.addAcFilePerDir || true;
const addAcFilePerResource = argv.addAcFilePerResource || true;

async function main() {
  const fetcher: AnyFetchType = false ? nodeFetch : es6fetch;

  const authFetchCache = new AuthFetchCache(cssBaseUrl, true, "all", fetcher);

  if (argv.generateUsers) {
    await generatePodsAndUsers(authFetchCache, cssBaseUrl, usercount);
  }

  if (argv.generateVariableSize) {
    await generateVariableSizeFiles(
      authFetchCache,
      cssBaseUrl,
      usercount,
      addAclFiles,
      addAcrFiles,
      addAcFilePerResource,
      addAcFilePerDir,
      dirDepth
    );
  }

  if (argv.generateFixedSize) {
    await generateFixedSizeFiles(
      authFetchCache,
      cssBaseUrl,
      usercount,
      fileCount,
      fileSize,
      addAclFiles,
      addAcrFiles,
      addAcFilePerResource,
      addAcFilePerDir,
      dirDepth
    );
  }

  if (argv.generateRdf) {
    await generateRdfFiles(
      argv.baseRdfFile || "error",
      authFetchCache,
      cssBaseUrl,
      usercount,
      addAclFiles,
      addAcrFiles
    );
  }

  if (argv.generateFromLdbcDir && generatedDataBaseDir) {
    await generatePodsWithLdbcFiles(
      authFetchCache,
      cssBaseUrl,
      generatedDataBaseDir,
      addAclFiles,
      addAcrFiles
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
