#!/usr/bin/env node

import fs from "fs";
import readline from "readline";
import yargs from 'yargs'
import {hideBin} from "yargs/helpers";
import fetch from 'node-fetch';

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
            return "--source dir requires --data";
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

/**
 *
 * @param {string} nameValue The name used to create the pod (same value as you would give in the register form online)
 */
async function createPod(nameValue) {
    console.log(`Will create pod ${nameValue}...`);
    const settings =  {
        podName: nameValue,
        email: `${nameValue}@example.org`,
        password: 'password',
        confirmPassword: 'password',
        register: true,
        createPod: true,
        createWebId: true
    }

    //console.log('SETTINGS', settings)

    console.log(`Connecting to ${cssBaseUrl}idp/register/...`);

    const res = await fetch(`${cssBaseUrl}idp/register/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(settings),
    });

    // console.log(`res.ok`, res.ok);
    // console.log(`res.status`, res.status);

    // See server response or error text

    console.log(`res.text`, await res.text());
    if (!res.ok) {
        console.error(`${res.status} - Creating pod for ${nameValue} failed:`);
        console.error(await res.text());
        throw new Error(res);
    }

    let jsonResponse = await res.json();
    // console.log(`jsonResponse`, jsonResponse);

    // if (jsonResponse.name && jsonResponse.name.includes('Error')) {
    //     console.error(`${jsonResponse.name} - Creating pod for ${nameValue} failed: ${jsonResponse.message}`);
    // }
    // else {
        // console.log(`Pod for ${nameValue} created successfully`);
    // }
}

function copyPodFile(account, localFilePath, localPodDir, podFileRelative) {
    const podFilePath = `${localPodDir}/${podFileRelative}`;
    fs.copyFileSync(localFilePath, podFilePath);
    console.log(`   cp ${genDataDir + file} ${podFilePath}`);

    const podFileAcl = `${podFilePath}.acl`;
    fs.writeFileSync(podFileAcl, `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

<#public>
    a acl:Authorization;
    acl:accessTo <./${podFileRelative}>;
    acl:agentClass foaf:Agent;
    acl:mode acl:Read.

<#owner>
    a acl:Authorization;
    acl:accessTo <./${podFileRelative}>;
    acl:agent <http://css:3000/${account}/profile/card#me>;
    acl:mode acl:Read, acl:Write, acl:Control.
`);
    console.log(`   created ${podFileAcl}`);
}

function writePodFile(account, fileContent, localPodDir, podFileRelative) {
    console.log(`   Will write to account ${account}, pod file ${podFileRelative}...`);

    const podFilePath = `${localPodDir}/${podFileRelative}`;
    fs.writeFileSync(localFilePath, fileContent);
    console.log(`   created ${podFilePath}`);

    const podFileAcl = `${podFilePath}.acl`;
    fs.writeFileSync(podFileAcl, `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

<#public>
    a acl:Authorization;
    acl:accessTo <./${podFileRelative}>;
    acl:agentClass foaf:Agent;
    acl:mode acl:Read.

<#owner>
    a acl:Authorization;
    acl:accessTo <./${podFileRelative}>;
    acl:agent <http://css:3000/${account}/profile/card#me>;
    acl:mode acl:Read, acl:Write, acl:Control.
`);
    console.log(`   created ${podFileAcl}`);
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

                copyPodFile(account, genDataDir + 'person.nq', localPodDir, 'person.nq');
            }
        }
    }

    if (argv.source === 'generate') {
        for (let i = 0; i < generateCount; i++) {
            const account = `user${i}`;
            await createPod(account);
            const localPodDir = `${cssDataDir}${account}`;
            writePodFile(account, "DUMMY DATA FOR "+account, localPodDir, 'dummy.txt');
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
