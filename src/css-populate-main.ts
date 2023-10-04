#!/usr/bin/env node

import { populatePodsFromDir } from "./populate-from-dir.js";
import {
  generateFixedSizeFiles,
  generateRdfFiles,
  generateVariableSizeFiles,
} from "./generate-files.js";
import {
  accountEmail,
  CreatedUserInfo,
  generateAccountsAndPods,
  ProvidedAccountInfo,
} from "./generate-users.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { AnyFetchType, es6fetch } from "./generic-fetch.js";
import nodeFetch from "node-fetch";
import {
  AccountAction,
  AccountSource,
  getCliArgs,
} from "./css-populate-args.js";
import fs from "fs";
import { readFile } from "node:fs/promises";

async function main() {
  const cli = getCliArgs();
  const fetcher: AnyFetchType = false ? nodeFetch : es6fetch;

  const providedAccountInfo: ProvidedAccountInfo[] = [];
  if (cli.accountSource === AccountSource.Template) {
    for (let index = 0; index < cli.accountSourceCount; index++) {
      const username = cli.accountSourceTemplateUsername.replaceAll(
        "{{NR}}",
        `${index}`
      );
      providedAccountInfo.push({
        username,
        password: cli.accountSourceTemplatePass.replaceAll(
          "{{NR}}",
          `${index}`
        ),
        podName: username,
        email: accountEmail(username),
        index,
      });
    }
  } else if (cli.accountSource === AccountSource.File) {
    const providedAccountInfoFileContent = await readFile(
      cli.accountSourceFile || "error",
      { encoding: "utf8" }
    );
    const providedAccountInfoArr = JSON.parse(providedAccountInfoFileContent);
    if (!Array.isArray(providedAccountInfoArr)) {
      throw new Error(
        `File "${cli.accountSourceFile}" does not contain a JSON array.`
      );
    }
    let index = 0;
    for (const ui of providedAccountInfoArr) {
      if (!ui.username || !ui.password) {
        throw new Error(
          `File "${cli.accountSourceFile}" contains an entry without username and/or password.`
        );
      }
      providedAccountInfo.push({
        username: ui.username,
        password: ui.password,
        podName: ui.padName ?? ui.username,
        email: ui.email ?? accountEmail(ui.username),
        index,
      });
      index++;
    }
  } else {
    throw new Error(`Unsupported --account-source ${cli.accountSource}`);
  }

  const createdUsersInfo: CreatedUserInfo[] = [];

  for (const cssBaseUrl of cli.cssBaseUrl) {
    const authFetchCache = new AuthFetchCache(
      cli,
      cssBaseUrl,
      true,
      "all",
      fetcher
    );

    if (cli.accountAction != AccountAction.UseExisting) {
      //TODO handle Auto and Create differently
      await generateAccountsAndPods(
        cli,
        cssBaseUrl,
        authFetchCache,
        providedAccountInfo,
        createdUsersInfo
      );
    }

    if (cli.generateVariableSize) {
      await generateVariableSizeFiles(
        authFetchCache,
        cli,
        cssBaseUrl,
        providedAccountInfo,
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
        providedAccountInfo,
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
        providedAccountInfo,
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
