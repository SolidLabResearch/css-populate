import crypto from "crypto";
import {
  addAuthZFile,
  addAuthZFiles,
  createPod,
  uploadPodFile,
} from "./css-upload.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { CONTENT_TYPE_BYTE } from "./content-type.js";
import {
  convertRdf,
  RDFContentTypeMap,
  RDFExtMap,
  RDFTypeValues,
} from "./rdf-helpers.js";
import { CliArgs } from "./css-populate-args.js";

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

export async function generateVariableSizeFiles(
  authFetchCache: AuthFetchCache,
  cli: CliArgs,
  cssBaseUrl: string,
  userCount: number,
  addAclFiles: boolean = false,
  addAcrFiles: boolean = false,
  addAcFilePerResource: boolean = true,
  addAcFilePerDir: boolean = true,
  dirDepth: number = 0
) {
  let subDirs = ``;
  for (let i = 0; i < dirDepth; i++) {
    subDirs += "data/";
  }

  const files: Array<[string, Buffer]> = [];
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
    files.push([`${size}.rnd`, Buffer.from(generateContent(size_int))]);
  }

  for (let i = 0; i < userCount; i++) {
    const account = `user${i}`;
    const authFetch = await authFetchCache.getAuthFetcher(i);
    // await uploadPodFile(
    //   cli,
    //   account,
    //   "DUMMY DATA FOR " + account,
    //   "dummy.txt",
    //   authFetch
    // );

    for (const [fileName, fileContent] of files) {
      await uploadPodFile(
        cli,
        cssBaseUrl,
        account,
        fileContent,
        `${subDirs}${fileName}`,
        authFetch,
        CONTENT_TYPE_BYTE,
        i < 2
      );

      await addAuthZFiles(
        cli,
        cssBaseUrl,
        account,
        authFetch,
        fileName,
        true,
        false,
        false,
        i < 2,
        addAclFiles,
        addAcrFiles,
        addAcFilePerResource,
        addAcFilePerDir,
        dirDepth
      );
    }
  }
}

export async function generateFixedSizeFiles(
  authFetchCache: AuthFetchCache,
  cli: CliArgs,
  cssBaseUrl: string,
  userCount: number,
  fileCount: number,
  fileSize: number,
  addAclFiles: boolean = false,
  addAcrFiles: boolean = false,
  addAcFilePerResource: boolean = true,
  addAcFilePerDir: boolean = true,
  dirDepth: number = 0
) {
  let subDirs = ``;
  for (let i = 0; i < dirDepth; i++) {
    subDirs += "data/";
  }

  const fileContent = Buffer.from(generateContent(fileSize));

  for (let i = 0; i < userCount; i++) {
    const startTime = new Date().getTime();
    const account = `user${i}`;
    const authFetch = await authFetchCache.getAuthFetcher(i);

    for (let j = 0; j < fileCount; j++) {
      const fileName = `fixed_${j}`;
      await uploadPodFile(
        cli,
        cssBaseUrl,
        account,
        fileContent,
        `${subDirs}${fileName}`,
        authFetch,
        CONTENT_TYPE_BYTE,
        i < 2
      );

      await addAuthZFiles(
        cli,
        cssBaseUrl,
        account,
        authFetch,
        fileName,
        true,
        true,
        false,
        i < 2,
        addAclFiles,
        addAcrFiles,
        addAcFilePerResource,
        addAcFilePerDir,
        dirDepth
      );
    }
    const stopTime1 = new Date().getTime();

    const stopTime2 = new Date().getTime();
    if (i < 100) {
      var duration1_s = (stopTime1 - startTime) / 1000.0;
      var duration2_s = (stopTime2 - stopTime1) / 1000.0;
      console.log(
        `Uploading ${fileCount} fixed files of size ${fileSize}byte for user ${i} took ${duration1_s}s` +
          ` (+ ${duration2_s}s for 1 acl file)`
      );
    }
  }
}

export async function generateRdfFiles(
  inputBaseRdfFile: string,
  authFetchCache: AuthFetchCache,
  cli: CliArgs,
  cssBaseUrl: string,
  userCount: number,
  addAclFiles: boolean = false,
  addAcrFiles: boolean = false,
  addAcFilePerResource: boolean = true,
  addAcFilePerDir: boolean = true,
  dirDepth: number = 0
) {
  let subDirs = ``;
  for (let i = 0; i < dirDepth; i++) {
    subDirs += "data/";
  }

  const fileInfos: { fileName: string; buffer: Buffer; contentType: string }[] =
    [];
  for (const rt of RDFTypeValues) {
    if (rt === "RDF_XML") {
      //not supported
      continue;
    }
    const fileName = `rdf_example_${rt}.${RDFExtMap[rt]}`;
    const contentType = RDFContentTypeMap[rt];
    let buffer;
    try {
      buffer = await convertRdf(inputBaseRdfFile, rt);
      console.log(`converted input RDF to ${rt}: ${buffer.byteLength} bytes`);
    } catch (e) {
      console.error(`error converting RDF to ${rt}`, e);
      throw e;
    }
    fileInfos.push({ fileName, buffer, contentType });
  }

  for (let i = 0; i < userCount; i++) {
    const account = `user${i}`;
    const authFetch = await authFetchCache.getAuthFetcher(i);

    for (const fileInfo of fileInfos) {
      await uploadPodFile(
        cli,
        cssBaseUrl,
        account,
        fileInfo.buffer,
        `${subDirs}${fileInfo.fileName}`,
        authFetch,
        fileInfo.contentType,
        i < 2
      );

      await addAuthZFiles(
        cli,
        cssBaseUrl,
        account,
        authFetch,
        fileInfo.fileName,
        true,
        false,
        false,
        i < 2,
        addAclFiles,
        addAcrFiles,
        addAcFilePerResource,
        addAcFilePerDir,
        dirDepth
      );
    }
  }
}
