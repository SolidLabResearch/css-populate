import crypto from "crypto";
import {
  createPod,
  createUserToken,
  getUserAuthFetch,
  makeAclReadPublic,
  uploadPodFile,
} from "./css-fetch.js";

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

export async function generatePodsAndFiles(
  cssBaseUrl: string,
  generateCount: number
) {
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
    await createPod(cssBaseUrl, account);
    const token = await createUserToken(cssBaseUrl, account, "password");
    const authFetch = await getUserAuthFetch(cssBaseUrl, account, token);
    // await writePodFileCheat(account, "DUMMY DATA FOR "+account, localPodDir, 'dummy.txt');
    await uploadPodFile(
      cssBaseUrl,
      account,
      "DUMMY DATA FOR " + account,
      "dummy.txt",
      authFetch
    );

    for (const [fileName, fileContent] of files) {
      await uploadPodFile(
        cssBaseUrl,
        account,
        Buffer.from(fileContent),
        fileName,
        authFetch
      );
      await makeAclReadPublic(cssBaseUrl, account, "*.rnd", authFetch);
    }
  }
}
