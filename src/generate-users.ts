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

export async function generateAccountsAndPods(
  cli: CliArgs,
  cssBaseUrl: string,
  authFetchCache: AuthFetchCache,
  generateCount: number,
  createdUserArr: CreatedUserInfo[]
) {
  const accounts: string[] = [];
  for (let i = 0; i < generateCount; i++) {
    const account = `user${i}`;
    accounts.push(account);
  }
  await generateAccountsAndPodsFromList(
    cli,
    cssBaseUrl,
    authFetchCache,
    accounts,
    createdUserArr
  );
}

export async function generateAccountsAndPodsFromList(
  cli: CliArgs,
  cssBaseUrl: string,
  authFetchCache: AuthFetchCache,
  accounts: string[],
  createdUserArr: CreatedUserInfo[]
) {
  let i = 0;
  for (const account of accounts) {
    const createdUserInfo = await createPod(
      cli,
      cssBaseUrl,
      authFetchCache,
      account
    );
    if (createdUserInfo) createdUserArr.push(createdUserInfo);

    authFetchCache.registerAccountName(i, account);
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
    i += 1;
  }
}
