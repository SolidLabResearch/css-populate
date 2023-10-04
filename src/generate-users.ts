import { createAccount, uploadPodFile } from "./css-upload.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { CONTENT_TYPE_TXT } from "./content-type.js";
import { CliArgs } from "./css-populate-args.js";

export function accountEmail(account: string): string {
  return `${account}@example.org`;
}

export interface ProvidedAccountInfo {
  index: number;
  username: string;
  password: string;
  podName: string; //defaults to username
  email: string; //default based on username
  // webID?: string;  //not (yet?) relevant
}

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
  providedAccountInfo: ProvidedAccountInfo[],
  createdUserArr: CreatedUserInfo[]
) {
  await generateAccountsAndPodsFromList(
    cli,
    cssBaseUrl,
    authFetchCache,
    providedAccountInfo,
    createdUserArr
  );
}

export async function generateAccountsAndPodsFromList(
  cli: CliArgs,
  cssBaseUrl: string,
  authFetchCache: AuthFetchCache,
  providedAccountInfo: ProvidedAccountInfo[],
  createdUserArr: CreatedUserInfo[]
) {
  let i = 0;
  for (const accountInfo of providedAccountInfo) {
    const createdUserInfo = await createAccount(
      cli,
      cssBaseUrl,
      authFetchCache,
      accountInfo
    );
    if (createdUserInfo) createdUserArr.push(createdUserInfo);

    authFetchCache.registerAccountName(i, accountInfo.username);
    const authFetch = await authFetchCache.getAuthFetcher(i);
    // await writePodFileCheat(account, "DUMMY DATA FOR "+account, localPodDir, 'dummy.txt');
    await uploadPodFile(
      cli,
      cssBaseUrl,
      accountInfo,
      "DUMMY DATA FOR " + accountInfo.username,
      "dummy.txt",
      authFetch,
      CONTENT_TYPE_TXT,
      i < 2
    );
    i += 1;
  }
}
