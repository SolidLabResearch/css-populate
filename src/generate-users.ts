import { createPod, uploadPodFile } from "./css-upload.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { CONTENT_TYPE_TXT } from "./content-type.js";
import { CliArgs } from "./css-populate-args.js";

export async function generatePodsAndUsers(
  cli: CliArgs,
  cssBaseUrl: string,
  authFetchCache: AuthFetchCache,
  generateCount: number
) {
  for (let i = 0; i < generateCount; i++) {
    const account = `user${i}`;
    await createPod(cli, cssBaseUrl, authFetchCache, account);
    const authFetch = await authFetchCache.getAuthFetcher(i);
    // await writePodFileCheat(account, "DUMMY DATA FOR "+account, localPodDir, 'dummy.txt');
    await uploadPodFile(
      cli,
      cssBaseUrl,
      account,
      "DUMMY DATA FOR " + account,
      "dummy.txt",
      authFetch,
      CONTENT_TYPE_TXT,
      i < 2
    );
  }
}
