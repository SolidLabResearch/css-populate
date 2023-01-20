import fetch from "node-fetch";
import { ResponseError } from "./error.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { AnyFetchType } from "./generic-fetch.js";
import { CONTENT_TYPE_ACL } from "./content-type.js";

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
  authFetchCache: AuthFetchCache,
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
  fileContent: string | Buffer,
  podFileRelative: string,
  authFetch: AnyFetchType,
  contentType: string
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

export async function addAclFile(
  cssBaseUrl: string,
  account: string,
  authFetch: AnyFetchType,
  aclFileBaseName: string,
  targetFilePattern: string,
  publicRead: boolean = true,
  publicWrite: boolean = false
) {
  const serverDomainName = new URL(cssBaseUrl).hostname;
  const newAclContent = `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

${
  publicRead
    ? `<#public>
  a acl:Authorization;
  acl:accessTo <./${targetFilePattern}>;
  acl:agentClass foaf:Agent;
  acl:mode acl:Read${publicWrite ? ", acl:Write, acl:Control" : ""}.`
    : ""
}
<#owner>
    a acl:Authorization;
    acl:accessTo <./${targetFilePattern}>;
    acl:agent <https://${serverDomainName}/${account}/profile/card#me>;
    acl:mode acl:Read, acl:Write, acl:Control.
  `;

  await uploadPodFile(
    cssBaseUrl,
    account,
    newAclContent,
    `${aclFileBaseName}.acl`,
    authFetch,
    CONTENT_TYPE_ACL
  );
}
