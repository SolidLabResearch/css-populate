import fetch from "node-fetch";
import { Response, BodyInit } from "node-fetch";
import {
  buildAuthenticatedFetch,
  createDpopHeader,
  generateDpopKeyPair,
} from "@inrupt/solid-client-authn-core";
import { ResponseError } from "./error.js";
import { downloadPodFile } from "./css-download.js";

function accountEmail(account: string): string {
  return `${account}@example.org`;
}

/* Quick and dirty content type handling. Obviously needs to be done better. */
function filenameToContentType(filename: string): string {
  if (filename.endsWith(".acl")) {
    //from https://www.w3.org/2008/01/rdf-media-types but unsure if correct for ".acl"
    // return "application/x-turtle";
    return "text/turtle"; // what CSS expects for .acl
  }
  if (filename.endsWith(".txt")) {
    return "text/plain";
  }
  // if (filename.endsWith('.???')) {
  //
  // }
  return "application/octet-stream";
}

/**
 *
 * @param {string} cssBaseUrl The base URL of the CSS server
 * @param {string} nameValue The name used to create the pod (same value as you would give in the register form online)
 */
export async function createPod(
  cssBaseUrl: string,
  nameValue: string
): Promise<Object> {
  console.log(`Will create pod "${nameValue}"...`);
  const settings = {
    podName: nameValue,
    email: accountEmail(nameValue),
    password: "password",
    confirmPassword: "password",
    register: true,
    createPod: true,
    createWebId: true,
  };

  console.log(`   POSTing to: ${cssBaseUrl}idp/register/`);
  //console.log('      settings', settings)

  // @ts-ignore
  const res = await fetch(`${cssBaseUrl}idp/register/`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify(settings),
  });

  // console.log(`res.ok`, res.ok);
  // console.log(`res.status`, res.status);

  const body = await res.text();
  if (!res.ok) {
    if (body.includes("Account already exists")) {
      //ignore
      return {};
    }
    console.error(`${res.status} - Creating pod for ${nameValue} failed:`);
    console.error(body);
    throw new ResponseError(res, body);
  }

  const jsonResponse = JSON.parse(body);
  return jsonResponse;
}

export async function uploadPodFile(
  cssBaseUrl: string,
  account: string,
  fileContent: BodyInit,
  podFileRelative: string,
  authFetch: typeof fetch
) {
  let retry = true;
  let retryCount = 0;
  while (retry) {
    retry = false;
    console.log(
      `   Will upload file to account ${account}, pod path "${podFileRelative}"`
    );

    const res = await authFetch(`${cssBaseUrl}${account}/${podFileRelative}`, {
      method: "PUT",
      headers: { "content-type": filenameToContentType(podFileRelative) },
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

export async function makeAclReadPublic(
  cssBaseUrl: string,
  account: string,
  podFilePattern: string,
  authFetch: typeof fetch
) {
  const aclContent = await downloadPodFile(
    cssBaseUrl,
    account,
    ".acl",
    authFetch
  );

  //Quick and dirty acl edit
  let newAclContent = "";
  let seenPublic = false;
  let needsUpdate = true;
  for (const line of aclContent.split(/\n/)) {
    if (line.trim() === "<#public>") {
      seenPublic = true;
    }
    if (seenPublic && line.includes(`acl:accessTo <./${podFilePattern}>`)) {
      needsUpdate = false;
      break;
    }
    if (seenPublic && line.includes(`acl:default <./>`)) {
      needsUpdate = false;
      break;
    }
    if (seenPublic && line.trim() === "") {
      newAclContent = lastDotToSemi(newAclContent);
      //doesn't work. So I don't see to understand this.
      // newAclContent += `    acl:accessTo <./${podFilePattern}>;\n`;
      // newAclContent += '    acl:mode acl:Read.\n';
      //this works, but gives access to everything. Which is fine I guess.
      newAclContent += `    acl:default <./>.\n`;
      seenPublic = false;
    }
    newAclContent += line + "\n";
  }

  if (needsUpdate) {
    // console.log("Replacing .acl with:\n" + newAclContent + "\n");
    await uploadPodFile(cssBaseUrl, account, newAclContent, ".acl", authFetch);
  } else {
    // console.log(".acl already OK.\n");
  }
}
