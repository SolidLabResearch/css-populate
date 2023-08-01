import fetch from "node-fetch";
import { ResponseError } from "./error.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { AnyFetchType } from "./generic-fetch.js";
import { CONTENT_TYPE_ACL, CONTENT_TYPE_ACR } from "./content-type.js";
import { makeAclContent } from "./wac-acl.js";
import { makeAcrContent } from "./acp-acr.js";
import { CliArgs } from "./css-populate-args.js";

function accountEmail(account: string): string {
  return `${account}@example.org`;
}

/**
 *
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
  const idpInfoUrl = `${cssBaseUrl}.account/`;
  let accountCreateEndpoint = `${cssBaseUrl}.account/account/`;
  const idpInfo = await fetch(idpInfoUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  cli.v3(`IdPInfo.ok`, idpInfo.ok);
  cli.v3(`IdPInfo.status`, idpInfo.status);

  let try1 = true;
  let try6 = true;
  let try7 = true;

  if (idpInfo.status == 404) {
    cli.v1(`   404 fetching IdP Info at ${idpInfoUrl}`);
    try7 = false;
  }
  if (idpInfo.ok) {
    /* We get something like this (CSS v7.0):
      {
     "controls" : {
        "account" : {
           "create" : "https://n064-28.wall2.ilabt.iminds.be/.account/account/"
        },
        "html" : ...,
        "main" : {
           "index" : "https://n064-28.wall2.ilabt.iminds.be/.account/",
           "logins" : "https://n064-28.wall2.ilabt.iminds.be/.account/login/"
        },
        "password" : {
           "forgot" : "https://n064-28.wall2.ilabt.iminds.be/.account/login/password/forgot/",
           "login" : "https://n064-28.wall2.ilabt.iminds.be/.account/login/password/",
           "reset" : "https://n064-28.wall2.ilabt.iminds.be/.account/login/password/reset/"
        }
     },
     "version" : "0.5"
  }
  */
    const body: any = await idpInfo.json();
    cli.v3(`IdP Info: ${JSON.stringify(body, null, 3)}`);
    if (body?.controls?.account?.create) {
      accountCreateEndpoint = body?.controls?.account?.create;
      cli.v2(`IdP Info confirms v7`);
      try1 = false;
      try6 = false;
      try7 = true;
    } else {
      cli.v2(`IdP Info unclear`);
    }
  }

  let wrongIdPPath = false;
  let res: Object | null = null;

  cli.v2(`   IdP variants to try: 1=${try1} 6=${try6} 7=${try7}`);

  if (try1) {
    [wrongIdPPath, res] = await createPodIdp1(
      cli,
      authFetchCache,
      cssBaseUrl,
      nameValue
    );
  }

  if (try6 && wrongIdPPath) {
    //assume that idp URL has moved (= new version of CSS specific idp)
    [wrongIdPPath, res] = await createPodIdp6(
      cli,
      authFetchCache,
      cssBaseUrl,
      nameValue
    );
  }

  if (try7 && wrongIdPPath) {
    //assume that idp URL has moved (= new version of CSS specific idp)
    [wrongIdPPath, res] = await createPodIdp7(
      cli,
      authFetchCache,
      cssBaseUrl,
      nameValue,
      accountCreateEndpoint
    );
  }

  if (!res) {
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

  cli.v2(`   POSTing to: ${cssBaseUrl}${idpPath}/register/`);

  // @ts-ignore
  let res = await fetch(`${cssBaseUrl}${idpPath}/register/`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify(settings),
  });

  cli.v3(`res.ok`, res.ok);
  cli.v3(`res.status`, res.status);

  if (res.status == 404) {
    cli.v1(`   404 registering user: incompatible IdP path`);

    return [true, {}];
  }

  cli.v3(`res.ok`, res.ok);
  cli.v3(`res.status`, res.status);

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

  cli.v2(`   POSTing to: ${cssBaseUrl}${idpPath}/register/`);

  // @ts-ignore
  let res = await fetch(`${cssBaseUrl}${idpPath}/register/`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify(settings),
  });

  cli.v3(`res.ok`, res.ok);
  cli.v3(`res.status`, res.status);

  if (res.status == 404) {
    cli.v1(`   404 registering user: incompatible IdP path`);

    return [true, {}];
  }

  cli.v3(`res.ok`, res.ok);
  cli.v3(`res.status`, res.status);

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
 * @param {string} accountCreateEndpoint account creation endpoint
 */
export async function createPodIdp7(
  cli: CliArgs,
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  nameValue: string,
  accountCreateEndpoint: string
): Promise<[boolean, Object]> {
  cli.v1(`Will create pod "${nameValue}"...`);

  //see https://github.com/CommunitySolidServer/CommunitySolidServer/blob/b02c8dcac1ca20eb61af62a648e0fc68cecc7dd2/documentation/markdown/usage/account/json-api.md

  cli.v2(`   POSTing to: ${accountCreateEndpoint}`);
  let res = await fetch(accountCreateEndpoint, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: null,
  });

  if (res.status == 404) {
    cli.v1(`   404 registering user: incompatible IdP path`);
    return [true, {}];
  }
  if (!res.ok) {
    console.error(`${res.status} - Creating pod for ${nameValue} failed:`);
    const body = await res.text();
    console.error(body);
    throw new ResponseError(res, body);
  }

  //reply will create:
  //   - cookie(s) (auth)
  //   - resource field with account url

  const createAccountBody: any = await res.json();
  const accountUrl: string | undefined = createAccountBody?.resource;
  const cookies = [];
  for (const [k, v] of res.headers.entries()) {
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
    throw new ResponseError(res, createAccountBody);
  }
  if (!cookies) {
    console.error(
      `Creating pod for ${nameValue} failed: no cookies in response. headers: ${JSON.stringify(
        res.headers
      )}`
    );
    throw new ResponseError(res, createAccountBody);
  }

  //We have an account now!

  //TODO get idpInfo again.
  //     use controls.password.create with email and password field to create pass
  //     somehow create webid

  const idpInfoUrl = `${cssBaseUrl}.account/`;
  const idpInfo = await fetch(idpInfoUrl, {
    method: "GET",
    headers: { Cookie: cookieHeader, Accept: "application/json" },
  });

  cli.v3(`IdPInfo.ok`, idpInfo.ok);
  cli.v3(`IdPInfo.status`, idpInfo.status);

  if (idpInfo.status == 404) {
    cli.v1(`   404 fetching IdP Info at ${idpInfoUrl}`);
    return [true, {}];
  }
  if (idpInfo.ok) {
    /* We are logged in, so we get something like this:  TODO update example with logged in info
      {
     "controls" : {
        "account" : {
           "create" : "https://n064-28.wall2.ilabt.iminds.be/.account/account/"
        },
        "html" : ...
        "main" : {
           "index" : "https://n064-28.wall2.ilabt.iminds.be/.account/",
           "logins" : "https://n064-28.wall2.ilabt.iminds.be/.account/login/"
        },
        "password" : {
           "forgot" : "https://n064-28.wall2.ilabt.iminds.be/.account/login/password/forgot/",
           "login" : "https://n064-28.wall2.ilabt.iminds.be/.account/login/password/",
           "reset" : "https://n064-28.wall2.ilabt.iminds.be/.account/login/password/reset/"
        }
     },
     "version" : "0.5"
  }
  */
    const body: any = await idpInfo.json();
    cli.v3(`IdP Info: ${JSON.stringify(body, null, 3)}`);
    if (body?.controls?.password?.create) {
      passwordCreateEndpoint = body?.controls?.account?.create;
      cli.v2(`IdP Info confirms v7`);
    } else {
      cli.v1(`IdP Info is missing expected fields`);
      return [true, {}];
    }
  }

  //
  // const settings = {
  //   podName: nameValue,
  //   email: accountEmail(nameValue),
  //   password: "password",
  //   confirmPassword: "password",
  //   register: true,
  //   createPod: true,
  //   createWebId: true,
  // };
  //
  // let idpPath = `.account`;

  // // @ts-ignore
  // res = await fetch(`${cssBaseUrl}${idpPath}/register/`, {
  //   method: "POST",
  //   headers: {
  //     "content-type": "application/json",
  //     Accept: "application/json",
  //     Cookie: cookieHeader,
  //   },
  //   body: JSON.stringify(settings),
  // });
  //
  // cli.v3(`res.ok`, res.ok);
  // cli.v3(`res.status`, res.status);
  //
  // if (res.status == 404) {
  //   cli.v1(`   404 registering user, will try again with alternative path`);
  //
  //   return [true, {}];
  // }
  //
  // cli.v3(`res.ok`, res.ok);
  // cli.v3(`res.status`, res.status);
  //
  // const body = await res.text();
  // if (!res.ok) {
  //   if (body.includes("Account already exists")) {
  //     //ignore
  //     return [false, {}];
  //   }
  //   console.error(`${res.status} - Creating pod for ${nameValue} failed:`);
  //   console.error(body);
  //   throw new ResponseError(res, body);
  // }
  //
  // const jsonResponse = JSON.parse(body);
  return [false, jsonResponse];
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
        `   Will upload file to account ${account}, pod path "${podFileRelative}"`
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
