import { createPod, uploadPodFile } from "./css-upload.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { CONTENT_TYPE_TXT } from "./content-type.js";
import { CliArgs } from "./css-populate-args.js";

export interface CreatedUserInfo {
  IdPType: "CSS"; /// <=v6 or >v7 doesn't matter
  serverBaseURL: string;
  webID: string;
  podRoot: string;
  username: string;
  password: string;
}

export async function generatePodsAndUsers(
  cli: CliArgs,
  cssBaseUrl: string,
  authFetchCache: AuthFetchCache,
  generateCount: number,
  createdUserArr: CreatedUserInfo[]
) {
  for (let i = 0; i < generateCount; i++) {
    const account = `user${i}`;
    const createdUserInfo = await createPod(
      cli,
      cssBaseUrl,
      authFetchCache,
      account
    );
    if (createdUserInfo) createdUserArr.push(createdUserInfo);

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
