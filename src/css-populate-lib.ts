#!/usr/bin/env node

import {
  findAccountsFromDir,
  populatePodsFromDir,
} from "./populate-from-dir.js";
import {
  CreatedUserInfo,
  generateAccountsAndPodsFromList,
} from "./generate-users.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { AnyFetchType, es6fetch } from "./generic-fetch.js";
import nodeFetch from "node-fetch";
import { CliArgs } from "./css-populate-args.js";

export type { CreatedUserInfo } from "./generate-users.js";
export async function populateServersFromDir({
  verbose,
  urlToDirMap,
  authorization,
}: {
  verbose: boolean;
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
    addAclFiles: authorization == "WAC",
    addAcrFiles: authorization == "ACP",
    generateUsers: true,
    userJsonOut: undefined,
    dirDepth: 0,
    addAcFilePerDir: true,
    addAcFilePerResource: true,
    generateVariableSize: false,
    generateFixedSize: false,
    generateRdf: false,
    generateFromDir: true,
    generatedDataBaseDir: Object.values(urlToDirMap)[0],
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
      console.log(
        `Will generate user+pod for server ${cssBaseUrl}: ${JSON.stringify(
          accounts,
          null,
          3
        )}`
      );
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
