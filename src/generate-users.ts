import crypto from "crypto";
import { createPod, makeAclReadPublic, uploadPodFile } from "./css-upload.js";
import { downloadPodFile } from "./css-download.js";
import { createUserToken, getUserAuthFetch } from "./solid-auth.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";

export async function generateUsers(
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  generateCount: number
) {
  for (let i = 0; i < generateCount; i++) {
    const account = `user${i}`;
    await createPod(authFetchCache, cssBaseUrl, account);
    const authFetch = await authFetchCache.getAuthFetcher(i);
    // await writePodFileCheat(account, "DUMMY DATA FOR "+account, localPodDir, 'dummy.txt');
    await uploadPodFile(
      cssBaseUrl,
      account,
      "DUMMY DATA FOR " + account,
      "dummy.txt",
      authFetch
    );
  }
}
