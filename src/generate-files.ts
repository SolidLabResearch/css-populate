import crypto from "crypto";
import { addAclFile, createPod, uploadPodFile } from "./css-upload.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { CONTENT_TYPE_BYTE } from "./content-type.js";

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
  cssBaseUrl: string,
  userCount: number
) {
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
    //   cssBaseUrl,
    //   account,
    //   "DUMMY DATA FOR " + account,
    //   "dummy.txt",
    //   authFetch
    // );

    for (const [fileName, fileContent] of files) {
      await uploadPodFile(
        cssBaseUrl,
        account,
        fileContent,
        fileName,
        authFetch,
        CONTENT_TYPE_BYTE,
        i < 2
      );
    }

    await addAclFile(
      cssBaseUrl,
      account,
      authFetch,
      "rnd",
      "*.rnd",
      true,
      false,
      i < 2
    );
  }
}

export async function generateFixedSizeFiles(
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  userCount: number,
  fileCount: number,
  fileSize: number
) {
  const fileContent = Buffer.from(generateContent(fileSize));

  for (let i = 0; i < userCount; i++) {
    const startTime = new Date().getTime();
    const account = `user${i}`;
    const authFetch = await authFetchCache.getAuthFetcher(i);

    for (let j = 0; j < fileCount; j++) {
      const fileName = `fixed_${j}`;
      await uploadPodFile(
        cssBaseUrl,
        account,
        fileContent,
        fileName,
        authFetch,
        CONTENT_TYPE_BYTE,
        i < 2
      );
    }

    await addAclFile(
      cssBaseUrl,
      account,
      authFetch,
      "fixed",
      "fixed_*",
      true,
      true,
      i < 2
    );

    const stopTime = new Date().getTime();
    if (i < 2) {
      console.log(
        `Uploading fixed files of size ${fileSize}byte for user ${i} took ${
          (stopTime - startTime) / 1000.0
        }s`
      );
    }
  }
}
