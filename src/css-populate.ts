#!/usr/bin/env node

import fs from "fs";
import readline from "readline";
import crypto from "crypto";
import fetch from "node-fetch";
import { Response, BodyInit } from "node-fetch";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  createDpopHeader,
  generateDpopKeyPair,
  buildAuthenticatedFetch,
} from "@inrupt/solid-client-authn-core";

const argv = yargs(hideBin(process.argv))
  .option("url", {
    alias: "u",
    type: "string",
    description: "Base URL of the CSS",
    demandOption: true,
  })
  .option("source", {
    alias: "s",
    type: "string",
    description: "Source of generated data",
    choices: ["dir", "generate"],
    demandOption: true,
  })
  .option("dir", {
    alias: "g",
    type: "string",
    description: "Dir with the generated data",
    demandOption: false,
    conflicts: ["count"],
  })
  .option("count", {
    alias: "c",
    type: "number",
    description: "Number of users/pods to generate",
    demandOption: false,
    conflicts: ["dir"],
  })
  .help()
  .check((argv, options) => {
    if (argv.source === "dir" && !argv.dir) {
      return "--source dir requires --dir";
    }
    if (argv.source === "generate" && !argv.count) {
      return "--source generate requires --count";
    }
    return true;
  })
  .parseSync();

const cssBaseUrl = argv.url.endsWith("/") ? argv.url : argv.url + "/";
const generatedDataBaseDir =
  argv.source === "dir"
    ? argv.dir?.endsWith("/")
      ? argv.dir
      : argv.dir + "/"
    : null;
const generateCount = argv.count || 1;

class ResponseError extends Error {
  constructor(response: Response, responseBody: string) {
    const shortResponseBody =
      responseBody.length > 150
        ? responseBody.substring(0, 150) + "..."
        : responseBody;
    const message = `Error, got HTTP ${response.status} ${response.statusText}: ${shortResponseBody}`;
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }
}

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
 * @param {string} nameValue The name used to create the pod (same value as you would give in the register form online)
 */
async function createPod(nameValue: string): Promise<Object> {
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

interface UserToken {
  id: string;
  secret: string;
}
async function createUserToken(
  account: string,
  password: string
): Promise<UserToken> {
  //see https://github.com/CommunitySolidServer/CommunitySolidServer/blob/main/documentation/markdown/usage/client-credentials.md
  const res = await fetch(`${cssBaseUrl}idp/credentials/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `token-css-populate-${account}`,
      email: accountEmail(account),
      password: password,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    // if (body.includes(`Could not create token for ${account}`)) {
    //     //ignore
    //     return {};
    // }
    console.error(`${res.status} - Creating token for ${account} failed:`);
    console.error(body);
    throw new ResponseError(res, body);
  }

  const { id, secret } = JSON.parse(body);
  return { id, secret };
}

async function getUserAuthFetch(
  account: string,
  token: UserToken
): Promise<typeof fetch> {
  //see https://github.com/CommunitySolidServer/CommunitySolidServer/blob/main/documentation/markdown/usage/client-credentials.md
  const { id, secret } = token;

  const dpopKey = await generateDpopKeyPair();
  const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;

  const url = `${cssBaseUrl}.oidc/token`; //ideally, fetch this from token_endpoint in .well-known/openid-configuration
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(authString).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      dpop: await createDpopHeader(url, "POST", dpopKey),
    },
    body: "grant_type=client_credentials&scope=webid",
  });

  const body = await res.text();
  if (!res.ok) {
    // if (body.includes(`Could not create access token for ${account}`)) {
    //     //ignore
    //     return {};
    // }
    console.error(
      `${res.status} - Creating access token for ${account} failed:`
    );
    console.error(body);
    throw new ResponseError(res, body);
  }

  const { access_token: accessToken, expires_in: expiresIn } = JSON.parse(body);
  // @ts-ignore   buildAuthenticatedFetch uses js fetch, but we use node-fetch
  const authFetch: typeof fetch = await buildAuthenticatedFetch(
    // @ts-ignore   buildAuthenticatedFetch uses js fetch, but we use node-fetch
    fetch,
    accessToken,
    { dpopKey }
  );
  // console.log(`Created Access Token using CSS token:`);
  // console.log(`account=${account}`);
  // console.log(`id=${id}`);
  // console.log(`secret=${secret}`);
  // console.log(`expiresIn=${expiresIn}`);
  // console.log(`accessToken=${accessToken}`);
  return authFetch;
}

async function uploadPodFile(
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

async function downloadPodFile(
  account: string,
  podFileRelative: string,
  authFetch: typeof fetch
) {
  console.log(
    `   Will download file from account ${account}, pod path "${podFileRelative}"`
  );

  const res = await authFetch(`${cssBaseUrl}${account}/${podFileRelative}`, {
    method: "GET",
    headers: { accept: filenameToContentType(podFileRelative) },
  });

  // console.log(`res.ok`, res.ok);
  // console.log(`res.status`, res.status);
  // console.log(`res.text`, body);
  if (!res.ok) {
    const body = await res.text();
    console.error(
      `${res.status} - Uploading to account ${account}, pod path "${podFileRelative}" failed:`
    );
    console.error(body);
    throw new ResponseError(res, body);
  }
  //console.log("Got pod file with Content-Type: "+res.headers.get('Content-Type'));
  return await res.text();
}

function parseTurtleLine(line: string): any {
  //quick and very dirty turtle parser, that only works for the files generated by ldbc_socialnet
  const parts = line.split(" ");
  if (parts.length === 4 && parts[3] === ".") {
    let c: any = parts[2];
    if (c.startsWith('"') && c.endsWith('"')) {
      c = c.substring(1, c.length - 1);
    } else if (
      c.startsWith('"') &&
      c.endsWith('"^^<http://www.w3.org/2001/XMLSchema#long>')
    ) {
      c = parseInt(c.substring(1, c.length - 42));
    }
    return [parts[0], parts[1], c];
  } else {
    return null;
  }
}

function generateContent(byteCount: number): ArrayBuffer {
  return crypto.randomBytes(byteCount).buffer; //fetch can handle ArrayBuffer
  // return crypto.randomBytes(byteCount).toString('base64');

  // const c = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  // const cl = c.length;
  // let res = '';
  // for (let i = 0; i < byteCount; i++ ) {
  //     res += c.charAt(Math.floor(Math.random()*cl));
  // }
  // return res;
}

function lastDotToSemi(input: string): string {
  //another dirty hack
  return input.replace(/.(\s*)$/, ";$1");
}

async function makeAclReadPublic(
  account: string,
  podFilePattern: string,
  authFetch: typeof fetch
) {
  const aclContent = await downloadPodFile(account, ".acl", authFetch);

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
    await uploadPodFile(account, newAclContent, ".acl", authFetch);
  } else {
    // console.log(".acl already OK.\n");
  }
}

async function main() {
  if (argv.source === "dir") {
    //Example person file:
    //  /users/wvdemeer/pod-generator/out-fragments/http/localhost_3000/www.ldbc.eu/ldbc_socialnet/1.0/data/pers*.nq
    const genDataDir =
      generatedDataBaseDir +
      "out-fragments/http/localhost_3000/www.ldbc.eu/ldbc_socialnet/1.0/data/";
    const files = fs.readdirSync(genDataDir);
    let curIndex = 0;
    for (const file of files) {
      if (file.startsWith("pers") && file.endsWith(".nq")) {
        const pers = file.substring(0, file.length - 3);
        const persIndex = curIndex++;
        console.log(`file=${file} pers=${pers} persIndex=${persIndex}`);

        let firstName = undefined,
          lastName = undefined,
          id = undefined;
        const rl = readline.createInterface({
          input: fs.createReadStream(genDataDir + file),
          crlfDelay: Infinity,
        });
        for await (const line of rl) {
          //examples:
          //<http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/data/pers00000000000000000065> <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/id> "65"^^<http://www.w3.org/2001/XMLSchema#long>
          //<http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/data/pers00000000000000000065> <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/firstName> "Marc" .
          //<http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/data/pers00000000000000000065> <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/lastName> "Ravalomanana" .
          const t = parseTurtleLine(line);
          if (t !== null && t[0].endsWith(`/${pers}>`)) {
            if (t[1].endsWith("/id>")) {
              id = t[2];
            }
            if (t[1].endsWith("/firstName>")) {
              firstName = t[2];
            }
            if (t[1].endsWith("/lastName>")) {
              lastName = t[2];
            }
            //console.log(`Line from file: ${line}`);
          }
        }
        console.log(`id=${id} firstName=${firstName} lastName=${lastName}`);
        if (!id || !firstName || !lastName) {
          continue;
        }

        const account = `user${persIndex}`;
        await createPod(account);

        const token = await createUserToken(account, "password");
        const authFetch = await getUserAuthFetch(account, token);
        await uploadPodFile(
          account,
          genDataDir + "person.nq",
          "person.nq",
          authFetch
        );
      }
    }
  }

  if (argv.source === "generate") {
    const files: Array<[string, ArrayBuffer]> = [];
    // for (const size in [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000]) {
    for (const size of [
      "10",
      "100",
      "1_000",
      "10_000",
      "100_000",
      "1_000_000",
      "10_000_000",
    ]) {
      const size_int = parseInt(size.replaceAll("_", ""));
      files.push([`${size}.rnd`, generateContent(size_int)]);
    }

    for (let i = 0; i < generateCount; i++) {
      const account = `user${i}`;
      await createPod(account);
      const token = await createUserToken(account, "password");
      const authFetch = await getUserAuthFetch(account, token);
      // await writePodFileCheat(account, "DUMMY DATA FOR "+account, localPodDir, 'dummy.txt');
      await uploadPodFile(
        account,
        "DUMMY DATA FOR " + account,
        "dummy.txt",
        authFetch
      );

      for (const [fileName, fileContent] of files) {
        await uploadPodFile(
          account,
          Buffer.from(fileContent),
          fileName,
          authFetch
        );
        await makeAclReadPublic(account, "*.rnd", authFetch);
      }
    }
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
