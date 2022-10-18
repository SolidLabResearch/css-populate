#!/usr/bin/env node

import fs from "fs";
import readline from "readline";
import yargs from 'yargs'
import crypto from 'crypto'
import {hideBin} from "yargs/helpers";
import fetch from 'node-fetch';

import { createDpopHeader, generateDpopKeyPair, buildAuthenticatedFetch } from '@inrupt/solid-client-authn-core';

const argv = yargs(hideBin(process.argv))
    .option('url', {
        alias: 'u',
        type: 'string',
        description: 'Base URL of the CSS',
        demandOption: true
    })
    .option('data', {
        alias: 'd',
        type: 'string',
        description: 'Data dir of the CSS',
        demandOption: false
    })
    // .option('generated', {
    //     alias: 'g',
    //     type: 'string',
    //     description: 'Dir with the generated data',
    //     demandOption: true
    // })
    .option('source', {
        alias: 's',
        type: 'string',
        description: 'Source of generated data',
        choices: ['dir', 'generate' ],
        demandOption: true
    })
    .option('dir', {
        alias: 'g',
        type: 'string',
        description: 'Dir with the generated data',
        demandOption: false,
        conflicts: ['count'],
    })
    .option('count', {
        alias: 'c',
        type: 'number',
        description: 'Number of users/pods to generate',
        demandOption: false,
        conflicts: ['dir'],
    })
    .help()
    .check((argv, options) => {
        if (argv.source === 'dir' && !argv.dir) {
            return "--source dir requires --dir";
        }
        if (argv.source === 'generate' && !argv.count) {
            return "--source generate requires --count";
        }
        return true;
    })
    .parseSync();


const cssBaseUrl = argv.url.endsWith('/') ? argv.url : argv.url+'/';
const cssDataDir = argv.source === 'dir' ? argv.data.endsWith('/') ? argv.data : argv.data+'/' : null;
// const generatedDataBaseDir = argv.generated.endsWith('/') ? argv.generated : argv.generated+'/';
const generatedDataBaseDir = argv.source === 'dir' ? argv.dir.endsWith('/') ? argv.dir : argv.dir+'/' : null;
const generateCount = argv.count;


function accountEmail(account) {
    return `${account}@example.org`;
}

/* Quick and dirty content type handling. Obviously needs to be done better. */
function filenameToContentType(filename) {
    if (filename.endsWith('.acl')) {
        //from https://www.w3.org/2008/01/rdf-media-types but unsure if correct for ".acl"
        // return "application/x-turtle";
        return "text/turtle";  // what CSS expects for .acl
    }
    if (filename.endsWith('.txt')) {
        return 'text/plain';
    }
    // if (filename.endsWith('.???')) {
    //
    // }
    return 'application/octet-stream';
}

/**
 *
 * @param {string} nameValue The name used to create the pod (same value as you would give in the register form online)
 */
async function createPod(nameValue) {
    console.log(`Will create pod "${nameValue}"...`);
    const settings =  {
        podName: nameValue,
        email: accountEmail(nameValue),
        password: 'password',
        confirmPassword: 'password',
        register: true,
        createPod: true,
        createWebId: true
    }

    console.log(`   POSTing to: ${cssBaseUrl}idp/register/`);
    //console.log('      settings', settings)

    const res = await fetch(`${cssBaseUrl}idp/register/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Accept': 'application/json' },
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
        throw new Error(res);
    }

    const jsonResponse = JSON.parse(body);
    return jsonResponse;
}

async function createUserToken(account, password) {
    //see https://github.com/CommunitySolidServer/CommunitySolidServer/blob/main/documentation/markdown/usage/client-credentials.md
    const res = await fetch(`${cssBaseUrl}idp/credentials/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            name: `token-css-populate-${account}`,
            email: accountEmail(account),
            password: password,
        }),
    });

    const body = await res.text();
    if (!res.ok) {
        if (body.includes(`Could not create token for ${account}`)) {
            //ignore
            return {};
        }
        console.error(`${res.status} - Creating token for ${account} failed:`);
        console.error(body);
        throw new Error(res);
    }

    const { id, secret } = JSON.parse(body);
    return { id, secret };
}

async function getUserAuthFetch(account, token) {
    //see https://github.com/CommunitySolidServer/CommunitySolidServer/blob/main/documentation/markdown/usage/client-credentials.md
    const { id, secret } = token;

    const dpopKey = await generateDpopKeyPair();
    const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;

    const url = `${cssBaseUrl}.oidc/token`; //ideally, fetch this from token_endpoint in .well-known/openid-configuration
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
            dpop: await createDpopHeader(url, 'POST', dpopKey),
        },
        body: 'grant_type=client_credentials&scope=webid',
    });

    const body = await res.text();
    if (!res.ok) {
        if (body.includes(`Could not create access token for ${account}`)) {
            //ignore
            return {};
        }
        console.error(`${res.status} - Creating access token for ${account} failed:`);
        console.error(body);
        throw new Error(res);
    }

    const { access_token: accessToken, expires_in: expiresIn } = JSON.parse(body);
    const authFetch = await buildAuthenticatedFetch(fetch, accessToken, { dpopKey });
    // console.log(`Created Access Token using CSS token:`);
    // console.log(`account=${account}`);
    // console.log(`id=${id}`);
    // console.log(`secret=${secret}`);
    // console.log(`expiresIn=${expiresIn}`);
    // console.log(`accessToken=${accessToken}`);
    return authFetch;
}

async function uploadPodFile(account, fileContent, podFileRelative, authFetch) {
    console.log(`   Will upload file to account ${account}, pod path "${podFileRelative}"`);

    const res = await authFetch(`${cssBaseUrl}${account}/${podFileRelative}`, {
        method: 'PUT',
        headers: { 'content-type': filenameToContentType(podFileRelative) },
        body: fileContent,
    });

    // console.log(`res.ok`, res.ok);
    // console.log(`res.status`, res.status);
    const body = await res.text();
    // console.log(`res.text`, body);
    if (!res.ok) {
        console.error(`${res.status} - Uploading to account ${account}, pod path "${podFileRelative}" failed:`);
        console.error(body);
        throw new Error(res);
    }
}

async function downloadPodFile(account, podFileRelative, authFetch) {
    console.log(`   Will download file from account ${account}, pod path "${podFileRelative}"`);

    const res = await authFetch(`${cssBaseUrl}${account}/${podFileRelative}`, {
        method: 'GET',
        headers: { 'accept': filenameToContentType(podFileRelative) },
    });

    // console.log(`res.ok`, res.ok);
    // console.log(`res.status`, res.status);
    // console.log(`res.text`, body);
    if (!res.ok) {
        const body = await res.text();
        console.error(`${res.status} - Uploading to account ${account}, pod path "${podFileRelative}" failed:`);
        console.error(body);
        throw new Error(res);
    }
    //console.log("Got pod file with Content-Type: "+res.headers.get('Content-Type'));
    return await res.text();
}

function parseTurtleLine(line) {
    //quick and very dirty turtle parser, that only works for the files generated by ldbc_socialnet
    const parts = line.split(" ");
    if (parts.length === 4 && parts[3] === '.') {
        let c = parts[2];
        if (c.startsWith('"') && c.endsWith('"')) {
            c = c.substring(1, c.length-1);
        } else if (c.startsWith('"') && c.endsWith('"^^<http://www.w3.org/2001/XMLSchema#long>')) {
            c = parseInt(c.substring(1, c.length-42));
        }
        return [parts[0], parts[1], c];
    } else {
        return null;
    }
}

function generateContent(byteCount) {
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

function lastDotToSemi(input) {
    //another dirty hack
    return input.replace(/.(\s*)$/, ';$1');
}

async function makeAclReadPublic(account, podFilePattern, authFetch) {
    const aclContent = await downloadPodFile(account, '.acl', authFetch)

    //Quick and dirty acl edit
    let newAclContent = "";
    let seenPublic = false;
    let needsUpdate = true;
    for (const line of aclContent.split(/\n/)) {
        if (line.trim() === '<#public>') {
            seenPublic = true;
        }
        if (seenPublic && line.includes(`acl:accessTo <./${podFilePattern}>`)) {
            needsUpdate = false;
            break;
        }
        if (seenPublic && line.trim() === '') {
            newAclContent = lastDotToSemi(newAclContent);
            newAclContent += `    acl:accessTo <./${podFilePattern}>;\n`;
            newAclContent += '    acl:mode acl:Read.\n';
            seenPublic = false;
        }
        newAclContent += line + '\n';
    }

    if (needsUpdate) {
        // console.log("Replacing .acl with:\n" + newAclContent + "\n");
        await uploadPodFile(account, newAclContent, '.acl', authFetch)
    } else {
        // console.log(".acl already OK.\n");
    }
}

//Example person file:
//  /users/wvdemeer/pod-generator/out-fragments/http/localhost_3000/www.ldbc.eu/ldbc_socialnet/1.0/data/pers*.nq
async function main() {
    if (argv.source === 'dir') {
        const genDataDir = generatedDataBaseDir + "out-fragments/http/localhost_3000/www.ldbc.eu/ldbc_socialnet/1.0/data/"
        const files = fs.readdirSync(genDataDir);
        let curIndex = 0;
        for (const file of files) {
            if (file.startsWith("pers") && file.endsWith(".nq")) {
                const pers = file.substring(0, file.length - 3);
                const persIndex = curIndex++;
                console.log(`file=${file} pers=${pers} persIndex=${persIndex}`);

                let firstName = undefined, lastName = undefined, id = undefined;
                const rl = readline.createInterface({
                    input: fs.createReadStream(genDataDir + file),
                    crlfDelay: Infinity
                });
                for await (const line of rl) {
                    //examples:
                    //<http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/data/pers00000000000000000065> <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/id> "65"^^<http://www.w3.org/2001/XMLSchema#long>
                    //<http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/data/pers00000000000000000065> <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/firstName> "Marc" .
                    //<http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/data/pers00000000000000000065> <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/lastName> "Ravalomanana" .
                    const t = parseTurtleLine(line);
                    if (t !== null && t[0].endsWith(`/${pers}>`)) {
                        if (t[1].endsWith('/id>')) {
                            id = t[2];
                        }
                        if (t[1].endsWith('/firstName>')) {
                            firstName = t[2];
                        }
                        if (t[1].endsWith('/lastName>')) {
                            lastName = t[2];
                        }
                        //console.log(`Line from file: ${line}`);
                    }

                }
                console.log(`id=${id} firstName=${firstName} lastName=${lastName}`);
                if (!id || !firstName || !lastName) {
                    continue;
                }

                //const fileBaseName = path.basename(file);
                // const account = `${firstName}${id}`.replace(/[^A-Za-z0-9]/, '');
                const account = `user${persIndex}`;
                await createPod(account)
                const localPodDir = `${cssDataDir}${account}`;
                // if (fs.existsSync(localPodDir)) {
                //     console.log(`Created pod for ${account}`);
                // } else {
                //     console.log(`Failed to create pod for ${account}: dir ${localPodDir} does not exist!`);
                //     // continue;
                //     return;
                // }

                const token = await createUserToken(account, 'password');
                const authFetch = await getUserAuthFetch(account, token);
                await uploadPodFile(account, genDataDir + 'person.nq', 'person.nq', authFetch);
            }
        }
    }

    const files = [];
    // for (const size in [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000]) {
    for (const size of ['10', '100', '1_000', '10_000', '100_000', '1_000_000', '10_000_000']) {
        const size_int = parseInt(size.replaceAll('_', ''));
        files.push([`${size}.rnd`, generateContent(size_int)]);
    }

    if (argv.source === 'generate') {
        for (let i = 0; i < generateCount; i++) {
            const account = `user${i}`;
            await createPod(account);
            const token = await createUserToken(account, 'password');
            const authFetch = await getUserAuthFetch(account, token);
            const localPodDir = `${cssDataDir}${account}`;
            // await writePodFileCheat(account, "DUMMY DATA FOR "+account, localPodDir, 'dummy.txt');
            await uploadPodFile(account, "DUMMY DATA FOR "+account, 'dummy.txt', authFetch);

            for (const [fileName, fileContent] of files) {
                await uploadPodFile(account, fileContent, fileName, authFetch);
                await makeAclReadPublic(account, '*.rnd', authFetch);
            }
        }
    }
}

//require.main === module only works for CommonJS, not for ES modules in Node.js
//(though on my test system with node v15.14.0 it works, and on another system with node v17.5.0 it doesn't)
//so we will simply not check. That means you don't want to import this module by mistake.
// if (require.main === module) {
try {
    await main(process.argv[2], process.argv[3]);
    process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
// }
