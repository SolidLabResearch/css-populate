import fetch from "node-fetch";
import { ResponseError } from "./error.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { AnyFetchType } from "./generic-fetch.js";
import { CONTENT_TYPE_ACL, CONTENT_TYPE_ACR } from "./content-type.js";
import { makeAclContent } from "./wac-acl.js";
import { makeAcrContent } from "./acp-acr.js";
import { CliArgs } from "./css-populate-args.js";
import {
  AccountApiInfo,
  createAccountPod,
  createEmptyAccount,
  createPassword,
  getAccountApiInfo,
  getAccountInfo,
} from "./css-accounts-api.js";

function accountEmail(account: string): string {
  return `${account}@example.org`;
}

export interface CreatedUserInfo {
  IdPType: "CSS"; /// <=v6 or >v7 doesn't matter
  serverBaseURL: string;
  webID: string;
  podRoot: string;
  username: string;
  password: string;
}

/**
 *
 * @param {string} cli the cli arguments
 * @param {string} cssBaseUrl the CSS server's base URL. (we can't get this from cli if there is more than 1 server)
 * @param {string} authFetchCache The AuthFetchCache
 * @param {string} nameValue The name used to create the pod (same value as you would give in the register form online)
 */
export async function createPod(
  cli: CliArgs,
  cssBaseUrl: string,
  authFetchCache: AuthFetchCache,
  nameValue: string
): Promise<CreatedUserInfo> {
  let try1, try6, try7;

  const accountApiInfo = await getAccountApiInfo(cli, `${cssBaseUrl}.account/`);
  if (accountApiInfo && accountApiInfo?.controls?.account?.create) {
    cli.v2(`Account API confirms v7`);
    try1 = false;
    try6 = false;
    try7 = true;
  } else {
    cli.v2(`Account API unclear`);
    try1 = true;
    try6 = true;
    try7 = false;
  }

  let mustCreatePod = true;
  let res: CreatedUserInfo | null = null;

  cli.v2(`Accounts API variants to try: 1=${try1} 6=${try6} 7=${try7}`);

  if (try1 && mustCreatePod) {
    [mustCreatePod, res] = await createPodAccountsApi1(
      cli,
      cssBaseUrl,
      authFetchCache,
      nameValue
    );
  }

  if (try6 && mustCreatePod) {
    [mustCreatePod, res] = await createPodAccountsApi6(
      cli,
      cssBaseUrl,
      authFetchCache,
      nameValue
    );
  }

  if (try7 && mustCreatePod) {
    [mustCreatePod, res] = await createPodAccountsApi7(
      cli,
      cssBaseUrl,
      authFetchCache,
      nameValue,
      accountApiInfo!
    );
  }

  if (mustCreatePod || !res) {
    console.error(
      `createPod: Accounts API problem: 404 for all Accounts API variants`
    );
    throw new Error(
      `createPod: Accounts API problem: 404 for all Accounts API variants`
    );
  }

  return res;
}

export async function createPodAccountsApi1(
  cli: CliArgs,
  cssBaseUrl: string,
  authFetchCache: AuthFetchCache,
  account: string
): Promise<[boolean, CreatedUserInfo | null]> {
  cli.v1(`Will create pod "${account}"...`);
  const settings = {
    podName: account,
    email: accountEmail(account),
    password: "password",
    confirmPassword: "password",
    register: true,
    createPod: true,
    createWebId: true,
  };

  let idpPath = `idp`;

  cli.v2(`POSTing to: ${cssBaseUrl}${idpPath}/register/`);

  // @ts-ignore
  let res = await fetch(`${cssBaseUrl}${idpPath}/register/`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify(settings),
  });

  cli.v3(`res.ok`, res.ok, `res.status`, res.status);

  if (res.status == 404) {
    cli.v1(`404 registering user: incompatible IdP path`);

    return [true, null];
  }

  const body = await res.text();
  if (!res.ok) {
    if (body.includes("Account already exists")) {
      //ignore
      return [false, null];
    }

    if (body.includes("outside the configured identifier space")) {
      cli.v1(
        `error registering account ${account} (${res.status} - ${body}): assuming incompatible IdP path`
      );

      return [true, null];
    }

    console.error(`${res.status} - Creating pod for ${account} failed:`);
    console.error(body);
    throw new ResponseError(res, body);
  }

  const jsonResponse = JSON.parse(body);
  cli.v3(`Created account info: ${JSON.stringify(jsonResponse, null, 3)}`);
  return [
    false,
    {
      IdPType: "CSS",
      serverBaseURL: cssBaseUrl,
      webID: jsonResponse.webId, //`${cssBaseUrl}${account}/profile/card#me`,
      podRoot: jsonResponse.podBaseUrl, //`${cssBaseUrl}${account}/`,
      username: account,
      password: "password",
    },
  ];
}

export async function createPodAccountsApi6(
  cli: CliArgs,
  cssBaseUrl: string,
  authFetchCache: AuthFetchCache,
  account: string
): Promise<[boolean, CreatedUserInfo | null]> {
  cli.v1(`Will create pod "${account}"...`);
  const settings = {
    podName: account,
    email: accountEmail(account),
    password: "password",
    confirmPassword: "password",
    register: true,
    createPod: true,
    createWebId: true,
  };

  let idpPath = `.account`;

  cli.v2(`POSTing to: ${cssBaseUrl}${idpPath}/register/`);

  // @ts-ignore
  let res = await fetch(`${cssBaseUrl}${idpPath}/register/`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify(settings),
  });

  cli.v3(`res.ok`, res.ok, `res.status`, res.status);

  if (res.status == 404) {
    cli.v1(`404 registering user: incompatible IdP path`);

    return [true, null];
  }

  const body = await res.text();
  if (!res.ok) {
    if (body.includes("Account already exists")) {
      //ignore
      return [false, null];
    }

    if (body.includes("outside the configured identifier space")) {
      cli.v1(
        `error registering account ${account} (${res.status} - ${body}): assuming incompatible IdP path`
      );

      return [true, null];
    }
    console.error(`${res.status} - Creating pod for ${account} failed:`);
    console.error(body);
    throw new ResponseError(res, body);
  }

  const jsonResponse = JSON.parse(body);
  cli.v3(`Created account info: ${JSON.stringify(jsonResponse, null, 3)}`);
  return [
    false,
    {
      IdPType: "CSS",
      serverBaseURL: cssBaseUrl,
      webID: jsonResponse.webId, //`${cssBaseUrl}${account}/profile/card#me`,
      podRoot: jsonResponse.podBaseUrl, //`${cssBaseUrl}${account}/`,
      username: account,
      password: "password",
    },
  ];
}

/**
 *
 * @param {string} cli CliArgs
 * @param {string} authFetchCache The AuthFetchCache
 * @param {string} account The name used to create the pod (same value as you would give in the register form online)
 * @param {string} basicAccountApiInfo AccountApiInfo (not logged in)
 */
export async function createPodAccountsApi7(
  cli: CliArgs,
  cssBaseUrl: string,
  authFetchCache: AuthFetchCache,
  account: string,
  basicAccountApiInfo: AccountApiInfo
): Promise<[boolean, CreatedUserInfo | null]> {
  const cookieHeader = await createEmptyAccount(
    cli,
    account,
    basicAccountApiInfo
  );
  if (!cookieHeader) {
    cli.v1(`404 registering user: incompatible Accounts API path`);
    return [true, null];
  }

  //We have an account now! And the cookies to use it.

  cli.v2(`Fetching account endpoints...`);
  const fullAccountApiInfo = await getAccountApiInfo(
    cli,
    basicAccountApiInfo.controls.main.index,
    cookieHeader
  );
  if (!fullAccountApiInfo) {
    return [true, null];
  }
  if (!fullAccountApiInfo.controls?.password?.create) {
    cli.v1(`Account API is missing expected fields`);
    return [true, null];
  }

  /// Create a password for the account ////
  const passwordCreated = await createPassword(
    cli,
    cookieHeader,
    account,
    accountEmail(account),
    "password",
    fullAccountApiInfo
  );
  if (!passwordCreated) {
    //user already existed. We ignore that.
    return [false, null];
  }

  /// Create a pod and link the WebID in it ////
  const createdPod = await createAccountPod(
    cli,
    cookieHeader,
    account,
    fullAccountApiInfo
  );
  if (!createdPod) {
    //pod not created
    return [true, null];
  }

  const accountInfo = await getAccountInfo(
    cli,
    cookieHeader,
    fullAccountApiInfo
  );
  return [
    false,
    {
      IdPType: "CSS",
      serverBaseURL: cssBaseUrl,
      webID: accountInfo.webIds[0],
      podRoot: accountInfo.pods[0],
      username: account,
      password: "password",
    },
  ];
}

export async function uploadPodFile(
  cli: CliArgs,
  cssBaseUrl: string,
  account: string,
  fileContent: string | Buffer,
  podFileRelative: string,
  authFetch: AnyFetchType,
  contentType: string,
  debugLogging: boolean = false
) {
  let retry = true;
  let retryCount = 0;
  while (retry) {
    retry = false;
    if (debugLogging) {
      cli.v1(
        `Will upload file to account ${account}, pod path "${podFileRelative}"`
      );
    }

    const res = await authFetch(`${cssBaseUrl}${account}/${podFileRelative}`, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: fileContent,
    });

    // console.log(`res.ok`, res.ok);
    // console.log(`res.status`, res.status);
    const body = await res.text();
    // console.log(`res.text`, body);
    if (!res.ok) {
      console.error(
        `${res.status} - Uploading to account ${account}, pod path "${podFileRelative}" failed:`
      );
      console.error(body);

      if (retryCount < 5) {
        retry = true;
        retryCount += 1;
        console.error(
          "Got 408 Request Timeout. That's strange... Will retry. (max 5 times)"
        );
      } else {
        throw new ResponseError(res, body);
      }
    }
  }
}

function lastDotToSemi(input: string): string {
  //another dirty hack
  return input.replace(/.(\s*)$/, ";$1");
}

//OLD DIRTY FUNCTION (remove)
// export async function makeAclReadPublic(
//   cssBaseUrl: string,
//   account: string,
//   podFilePattern: string,
//   authFetch: AnyFetchType
// ) {
//   const aclContent = await downloadPodFile(
//     cssBaseUrl,
//     account,
//     ".acl",
//     authFetch
//   );
//
//   //Quick and dirty acl edit
//   let newAclContent = "";
//   let seenPublic = false;
//   let needsUpdate = true;
//   for (const line of aclContent.split(/\n/)) {
//     if (line.trim() === "<#public>") {
//       seenPublic = true;
//     }
//     if (seenPublic && line.includes(`acl:accessTo <./${podFilePattern}>`)) {
//       needsUpdate = false;
//       break;
//     }
//     if (seenPublic && line.includes(`acl:default <./>`)) {
//       needsUpdate = false;
//       break;
//     }
//     if (seenPublic && line.trim() === "") {
//       newAclContent = lastDotToSemi(newAclContent);
//       //doesn't work. So I don't see to understand this.
//       // newAclContent += `    acl:accessTo <./${podFilePattern}>;\n`;
//       // newAclContent += '    acl:mode acl:Read.\n';
//       //this works, but gives access to everything. Which is fine I guess.
//       newAclContent += `    acl:default <./>.\n`;
//       seenPublic = false;
//     }
//     newAclContent += line + "\n";
//   }
//
//   if (needsUpdate) {
//     // console.log("Replacing .acl with:\n" + newAclContent + "\n");
//     await uploadPodFile(cssBaseUrl, account, newAclContent, ".acl", authFetch);
//   } else {
//     // console.log(".acl already OK.\n");
//   }
// }

export async function addAuthZFiles(
  cli: CliArgs,
  cssBaseUrl: string,
  account: string,
  authFetch: AnyFetchType,
  targetFilename: string,
  publicRead: boolean = true,
  publicWrite: boolean = false,
  publicControl: boolean = false,
  debugLogging: boolean = false,
  addAclFiles: boolean = false,
  addAcrFiles: boolean = false,
  addAcFilePerResource: boolean = true,
  addAcFilePerDir: boolean = true,
  dirDepth: number = 0
) {
  const authZTypes: ("ACP" | "WAC")[] = [];
  if (addAclFiles) {
    authZTypes.push("WAC");
  }
  if (addAcrFiles) {
    authZTypes.push("ACP");
  }

  for (const authZType of authZTypes) {
    if (addAcFilePerDir) {
      //We always assume the .acr or .acl file at the pod root is already present.
      for (let curDepth = 1; curDepth < dirDepth + 1; curDepth++) {
        let targetDirName = ``;
        for (let i = 0; i < curDepth; i++) {
          targetDirName += "data/";
        }
        await addAuthZFile(
          cli,
          cssBaseUrl,
          account,
          authFetch,
          targetDirName,
          "",
          publicRead,
          publicWrite,
          publicControl,
          debugLogging,
          authZType,
          true
        );
      }
    }

    if (addAcFilePerResource) {
      let subDirs = ``;
      for (let i = 0; i < dirDepth; i++) {
        subDirs += "data/";
      }
      await addAuthZFile(
        cli,
        cssBaseUrl,
        account,
        authFetch,
        subDirs,
        targetFilename,
        publicRead,
        publicWrite,
        publicControl,
        debugLogging,
        authZType,
        false
      );
    }
  }
}

export async function addAuthZFile(
  cli: CliArgs,
  cssBaseUrl: string,
  account: string,
  authFetch: AnyFetchType,
  targetDirname: string, //dir of the file that needs AuthZ
  targetBaseFilename: string, //base name (without dir) of the file that needs AuthZ. For dirs, this is empty
  publicRead: boolean = true,
  publicWrite: boolean = false,
  publicControl: boolean = false,
  debugLogging: boolean = false,
  authZType: "ACP" | "WAC" = "ACP",
  isDir: boolean = false
) {
  const serverDomainName = new URL(cssBaseUrl).hostname;
  let newAuthZContent;
  let fullPathPodFilename;
  let contentType;

  console.assert(
    targetDirname.length === 0 ||
      targetDirname.charAt(targetDirname.length - 1) === "/"
  );
  console.assert((targetBaseFilename.length === 0) === isDir);

  if (authZType == "WAC") {
    newAuthZContent = makeAclContent(
      serverDomainName,
      account,
      authFetch,
      targetBaseFilename,
      publicRead,
      publicWrite,
      publicControl,
      isDir
    );
    contentType = CONTENT_TYPE_ACL;
    fullPathPodFilename = `${targetDirname}${targetBaseFilename}.acl`; // Note: works for both isDir values
  } else {
    newAuthZContent = makeAcrContent(
      serverDomainName,
      account,
      authFetch,
      targetBaseFilename,
      publicRead,
      publicWrite,
      publicControl,
      isDir
    );
    contentType = CONTENT_TYPE_ACR;
    fullPathPodFilename = `${targetDirname}${targetBaseFilename}.acr`; // Note: works for both isDir values
  }

  await uploadPodFile(
    cli,
    cssBaseUrl,
    account,
    newAuthZContent,
    fullPathPodFilename,
    authFetch,
    contentType,
    debugLogging
  );
}
