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
  getAccountApiInfo,
  getAccountInfo,
} from "./css-accounts-api.js";

function accountEmail(account: string): string {
  return `${account}@example.org`;
}

/**
 *
 * @param {string} cli the cli arguments
 * @param {string} authFetchCache The AuthFetchCache
 * @param {string} cssBaseUrl The base URL of the CSS server
 * @param {string} nameValue The name used to create the pod (same value as you would give in the register form online)
 */
export async function createPod(
  cli: CliArgs,
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  nameValue: string
): Promise<Object> {
  let try1, try6, try7;

  const accountApiInfo = await getAccountApiInfo(cli);
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
  let res: Object | null = null;

  cli.v2(`IdP variants to try: 1=${try1} 6=${try6} 7=${try7}`);

  if (try1 && mustCreatePod) {
    [mustCreatePod, res] = await createPodIdp1(
      cli,
      authFetchCache,
      cssBaseUrl,
      nameValue
    );
  }

  if (try6 && mustCreatePod) {
    //assume that idp URL has moved (= new version of CSS specific idp)
    [mustCreatePod, res] = await createPodIdp6(
      cli,
      authFetchCache,
      cssBaseUrl,
      nameValue
    );
  }

  if (try7 && mustCreatePod) {
    //assume that idp URL has moved (= new version of CSS specific idp)
    [mustCreatePod, res] = await createPodIdp7(
      cli,
      authFetchCache,
      cssBaseUrl,
      nameValue,
      accountApiInfo!
    );
  }

  if (mustCreatePod || !res) {
    console.error(`createPod: IdP problem: 404 for all IdP variants`);
    throw new Error(`createPod: IdP problem: 404 for all IdP variants`);
  }

  return res;
}

export async function createPodIdp1(
  cli: CliArgs,
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  nameValue: string
): Promise<[boolean, Object]> {
  cli.v1(`Will create pod "${nameValue}"...`);
  const settings = {
    podName: nameValue,
    email: accountEmail(nameValue),
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

    return [true, {}];
  }

  const body = await res.text();
  if (!res.ok) {
    if (body.includes("Account already exists")) {
      //ignore
      return [false, {}];
    }
    console.error(`${res.status} - Creating pod for ${nameValue} failed:`);
    console.error(body);
    throw new ResponseError(res, body);
  }

  const jsonResponse = JSON.parse(body);
  return [false, jsonResponse];
}

export async function createPodIdp6(
  cli: CliArgs,
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  nameValue: string
): Promise<[boolean, Object]> {
  cli.v1(`Will create pod "${nameValue}"...`);
  const settings = {
    podName: nameValue,
    email: accountEmail(nameValue),
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

    return [true, {}];
  }

  const body = await res.text();
  if (!res.ok) {
    if (body.includes("Account already exists")) {
      //ignore
      return [false, {}];
    }
    console.error(`${res.status} - Creating pod for ${nameValue} failed:`);
    console.error(body);
    throw new ResponseError(res, body);
  }

  const jsonResponse = JSON.parse(body);
  return [false, jsonResponse];
}

/**
 *
 * @param {string} cli CliArgs
 * @param {string} authFetchCache The AuthFetchCache
 * @param {string} cssBaseUrl The base URL of the CSS server
 * @param {string} nameValue The name used to create the pod (same value as you would give in the register form online)
 * @param {string} basicAccountApiInfo AccountApiInfo (not logged in)
 */
export async function createPodIdp7(
  cli: CliArgs,
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  nameValue: string,
  basicAccountApiInfo: AccountApiInfo
): Promise<[boolean, Object]> {
  const accountCreateEndpoint = basicAccountApiInfo?.controls?.account?.create;
  cli.v1(`Will create pod "${nameValue}"...`);

  //see https://github.com/CommunitySolidServer/CommunitySolidServer/blob/b02c8dcac1ca20eb61af62a648e0fc68cecc7dd2/documentation/markdown/usage/account/json-api.md

  cli.v2(`Creating Account...`);
  cli.v2(`POSTing to: ${accountCreateEndpoint}`);
  let resp = await fetch(accountCreateEndpoint, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: null,
  });

  if (resp.status == 404) {
    cli.v1(`404 registering user: incompatible IdP path`);
    return [true, {}];
  }
  if (!resp.ok) {
    console.error(`${resp.status} - Creating pod for ${nameValue} failed:`);
    const body = await resp.text();
    console.error(body);
    throw new ResponseError(resp, body);
  }

  //reply will create:
  //   - cookie(s) (auth)
  //   - resource field with account url

  const createAccountBody: any = await resp.json();
  const accountUrl: string | undefined = createAccountBody?.resource;
  const cookies = [];
  for (const [k, v] of resp.headers.entries()) {
    if (k.toLowerCase() === "set-cookie") {
      cookies.push(v);
    }
  }
  const cookieHeader = cookies
    .map((c) =>
      c.substring(0, c.indexOf(";") == -1 ? undefined : c.indexOf(";"))
    )
    .reduce((a, b) => a + "; " + b);

  if (!accountUrl || !accountUrl.startsWith("http")) {
    console.error(
      `Creating pod for ${nameValue} failed: no resource in response: ${JSON.stringify(
        createAccountBody
      )}`
    );
    throw new ResponseError(resp, createAccountBody);
  }
  if (!cookies) {
    console.error(
      `Creating pod for ${nameValue} failed: no cookies in response. headers: ${JSON.stringify(
        resp.headers
      )}`
    );
    throw new ResponseError(resp, createAccountBody);
  }

  //We have an account now!

  cli.v2(`Fetching account endpoints...`);
  const fullAccountApiInfo = await getAccountApiInfo(cli, cookieHeader);
  if (!fullAccountApiInfo) {
    return [true, {}];
  }
  if (!fullAccountApiInfo.controls?.password?.create) {
    cli.v1(`Account API is missing expected fields`);
    return [true, {}];
  }

  /// Create a password for the account ////
  cli.v2(`Creating password...`);

  const passCreateEndpoint = fullAccountApiInfo?.controls?.password?.create;
  cli.v2(`Account API gave passCreateEndpoint: ${passCreateEndpoint}`);

  const createPassObj = {
    email: accountEmail(nameValue),
    password: "password",
  };

  cli.v2(`POSTing to: ${passCreateEndpoint}`);
  resp = await fetch(passCreateEndpoint, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(createPassObj),
  });
  cli.v3(`resp.ok`, resp.ok, `resp.status`, resp.status);

  if (!resp.ok) {
    const body = await resp.text();
    // if (body.includes("There already is a login for this e-mail address.")) {
    if (body.includes("already is a login for")) {
      cli.v1(
        `${resp.status} - User ${nameValue} already exists, will ignore. Msg:`,
        body
      );
      //ignore
      return [false, {}];
    }
    console.error(
      `${resp.status} - Creating password for ${nameValue} failed:`
    );
    console.error(body);
    throw new ResponseError(resp, body);
  }

  /// Create a pod and link the WebID in it ////
  cli.v2(`Creating Pod + WebID...`);

  const podCreateEndpoint = fullAccountApiInfo?.controls?.account?.pod;
  cli.v2(`Account API gave podCreateEndpoint: ${podCreateEndpoint}`);
  if (!podCreateEndpoint) {
    throw new Error(
      `fullAccountApiInfo.controls.account.pod should not be empty`
    );
  }

  const podCreateObj = {
    name: nameValue,

    //  "If no WebID value is provided, a WebID will be generated in the pod and immediately linked to the
    //  account as described in controls.account.webID. This WebID will then be the WebID that has initial access."

    // settings: {  webId: 'custom'},
  };

  cli.v2(`POSTing to: ${podCreateEndpoint}`);
  resp = await fetch(podCreateEndpoint, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(podCreateObj),
  });
  cli.v3(`resp.ok`, resp.ok, `resp.status`, resp.status);

  if (!resp.ok) {
    console.error(
      `${resp.status} - Creating Pod & WebID for ${nameValue} failed:`
    );
    const body = await resp.text();
    console.error(body);
    throw new ResponseError(resp, body);
  }

  return [false, await getAccountInfo(cli, cookieHeader, fullAccountApiInfo)];
}

export async function uploadPodFile(
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
      console.log(
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
    cssBaseUrl,
    account,
    newAuthZContent,
    fullPathPodFilename,
    authFetch,
    contentType,
    debugLogging
  );
}
