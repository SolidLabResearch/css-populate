#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  findAccountsFromDir,
  populatePodsFromDir,
} from "./populate-from-dir.js";
import {
  generateFixedSizeFiles,
  generateRdfFiles,
  generateVariableSizeFiles,
} from "./generate-files.js";
import {
  CreatedUserInfo,
  generateAccountsAndPods,
  generateAccountsAndPodsFromList,
} from "./generate-users.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { AnyFetchType, es6fetch } from "./generic-fetch.js";
import nodeFetch from "node-fetch";
import { CliArgs, getCliArgs } from "./css-populate-args.js";
import fs from "fs";

async function main() {
  const cli = getCliArgs();
  const fetcher: AnyFetchType = false ? nodeFetch : es6fetch;

  const createdUsersInfo: CreatedUserInfo[] = [];

  for (const cssBaseUrl of cli.cssBaseUrl) {
    const authFetchCache = new AuthFetchCache(
      cli,
      cssBaseUrl,
      true,
      "all",
      fetcher
    );

    if (cli.generateUsers) {
      //TODO might not want to create all users everywhere
      await generateAccountsAndPods(
        cli,
        cssBaseUrl,
        authFetchCache,
        cli.userCount,
        createdUsersInfo
      );
    }

    if (cli.generateVariableSize) {
      await generateVariableSizeFiles(
        authFetchCache,
        cli,
        cssBaseUrl,
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
        cli,
        cssBaseUrl,
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
        cli,
        cssBaseUrl,
        cli.userCount,
        cli.addAclFiles,
        cli.addAcrFiles
      );
    }

    if (cli.generateFromDir && cli.generatedDataBaseDir) {
      await populatePodsFromDir(
        authFetchCache,
        cli,
        cssBaseUrl,
        cli.generatedDataBaseDir,
        cli.addAclFiles,
        cli.addAcrFiles
      );
    }
  }

  if (cli.userJsonOut) {
    await fs.promises.writeFile(
      cli.userJsonOut,
      JSON.stringify(createdUsersInfo, null, 3),
      { encoding: "utf-8" }
    );
    cli.v2(`Wrote user info to '${cli.userJsonOut}'`);
  }
}

async function populateServersFromDir({
  verbose,
  rootDir,
  urlToDirMap,
  authorization,
}: {
  verbose: boolean;
  rootDir: string;
  urlToDirMap: { [dir: string]: string };
  authorization: "WAC" | "ACP" | undefined;
}): Promise<CreatedUserInfo[]> {
  //just hack together some CliArgs for consistency
  const cli: CliArgs = {
    verbosity_count: verbose ? 1 : 0,
    cssBaseUrl: Object.keys(urlToDirMap).map((u) =>
      u.endsWith("/") ? u : u + "/"
    ),
    userCount: 0,
    fileSize: 0,
    fileCount: 0,
    addAclFiles: authorization == "ACP",
    addAcrFiles: authorization == "WAC",
    generateUsers: true,
    userJsonOut: undefined,
    dirDepth: 0,
    addAcFilePerDir: true,
    addAcFilePerResource: true,
    generateVariableSize: false,
    generateFixedSize: false,
    generateRdf: false,
    generateFromDir: true,
    generatedDataBaseDir: rootDir,
    baseRdfFile: undefined,

    v3: (message?: any, ...optionalParams: any[]) => {},
    v2: (message?: any, ...optionalParams: any[]) => {},
    v1: (message?: any, ...optionalParams: any[]) => {
      if (verbose) console.log(message, ...optionalParams);
    },
  };
  const fetcher: AnyFetchType = false ? nodeFetch : es6fetch;

  const createdUsersInfo: CreatedUserInfo[] = [];

  for (const [cssBaseUrl, dir] of Object.entries(urlToDirMap)) {
    const authFetchCache = new AuthFetchCache(
      cli,
      cssBaseUrl,
      true,
      "all",
      fetcher
    );

    if (cli.generateUsers) {
      const accounts = await findAccountsFromDir(dir);
      //TODO find out which users we want to create for this server
      //     for this, we check the subdirs in "dir"
      //     we need to create all these users
      await generateAccountsAndPodsFromList(
        cli,
        cssBaseUrl,
        authFetchCache,
        accounts,
        createdUsersInfo
      );
    }

    await populatePodsFromDir(
      authFetchCache,
      cli,
      cssBaseUrl,
      dir,
      cli.addAclFiles,
      cli.addAcrFiles
    );
  }

  return createdUsersInfo;
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
