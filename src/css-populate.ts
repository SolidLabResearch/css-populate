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
import { getCliArgs } from "./css-populate-args.js";

async function main() {
  const cli = getCliArgs();
  const fetcher: AnyFetchType = false ? nodeFetch : es6fetch;

  const authFetchCache = new AuthFetchCache(
    cli.cssBaseUrl,
    true,
    "all",
    fetcher
  );

  if (cli.generateUsers) {
    await generatePodsAndUsers(
      cli,
      authFetchCache,
      cli.cssBaseUrl,
      cli.userCount
    );
  }

  if (cli.generateVariableSize) {
    await generateVariableSizeFiles(
      authFetchCache,
      cli.cssBaseUrl,
      cli.userCount,
      cli.addAclFiles,
      cli.addAcrFiles,
      cli.addAcFilePerResource,
      cli.addAcFilePerDir,
      cli.dirDepth
    );
  }

  if (cli.generateFixedSize) {
    await generateFixedSizeFiles(
      authFetchCache,
      cli.cssBaseUrl,
      cli.userCount,
      cli.fileCount,
      cli.fileSize,
      cli.addAclFiles,
      cli.addAcrFiles,
      cli.addAcFilePerResource,
      cli.addAcFilePerDir,
      cli.dirDepth
    );
  }

  if (cli.generateRdf) {
    await generateRdfFiles(
      cli.baseRdfFile || "error",
      authFetchCache,
      cli.cssBaseUrl,
      cli.userCount,
      cli.addAclFiles,
      cli.addAcrFiles
    );
  }

  if (cli.generateFromLdbcDir && cli.generatedDataBaseDir) {
    await generatePodsWithLdbcFiles(
      authFetchCache,
      cli.cssBaseUrl,
      cli.generatedDataBaseDir,
      cli.addAclFiles,
      cli.addAcrFiles
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
