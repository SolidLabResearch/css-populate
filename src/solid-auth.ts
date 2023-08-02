import {
  buildAuthenticatedFetch,
  createDpopHeader,
  generateDpopKeyPair,
} from "@inrupt/solid-client-authn-core";
import { ResponseError } from "./error.js";
import { KeyPair } from "@inrupt/solid-client-authn-core/src/authenticatedFetch/dpopUtils";
import { AnyFetchType } from "./generic-fetch.js";
import { CliArgs } from "./css-populate-args.js";
import fetch from "node-fetch";
import {
  AccountApiInfo,
  getAccountApiInfo,
  getAccountInfo,
} from "./css-accounts-api.js";

function accountEmail(account: string): string {
  return `${account}@example.org`;
}

export interface UserToken {
  id: string;
  secret: string;
}
export interface AccessToken {
  token: string;
  dpopKeyPair: KeyPair;
  expire: Date;
}
export async function createUserToken(
  cli: CliArgs,
  cssBaseUrl: string,
  account: string,
  password: string,
  fetcher: AnyFetchType = fetch
): Promise<UserToken> {
  cli.v2("Creating Token (client-credential)...");

  cli.v2("Checking Account API info...");
  const basicAccountApiInfo = await getAccountApiInfo(cli);
  if (basicAccountApiInfo && basicAccountApiInfo?.controls?.account?.create) {
    cli.v2(`Account API confirms v7`);

    return await createUserTokenv7(
      cli,
      cssBaseUrl,
      account,
      password,
      fetcher,
      basicAccountApiInfo
    );
  } else {
    cli.v2(`Account API is not v7`);
  }

  cli.v2(`Assuming account API v6`);
  return await createUserTokenv6(cssBaseUrl, account, password, fetcher);
}

export async function createUserTokenv6(
  cssBaseUrl: string,
  account: string,
  password: string,
  fetcher: AnyFetchType = fetch
): Promise<UserToken> {
  //see https://github.com/CommunitySolidServer/CommunitySolidServer/blob/main/documentation/markdown/usage/client-credentials.md
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const startTime = new Date().getTime();
  let res = null;
  let body = null;
  try {
    res = await fetcher(`${cssBaseUrl}idp/credentials/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `token-css-populate-${account}`,
        email: accountEmail(account),
        password: password,
      }),
      signal: controller.signal,
    });

    body = await res.text();
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error(`Fetching user token took too long: aborted`);
    }
    throw error;
  }
  if (!res || !res.ok) {
    console.error(
      `${res.status} - Creating token for ${account} failed:`,
      body
    );
    throw new ResponseError(res, body);
  }

  const { id, secret } = JSON.parse(body);
  return { id, secret };
}

export async function createUserTokenv7(
  cli: CliArgs,
  cssBaseUrl: string,
  account: string,
  password: string,
  fetcher: AnyFetchType = fetch,
  accountApiInfo: AccountApiInfo
): Promise<UserToken> {
  ////// Login (= get cookie) /////
  cli.v2("Logging in...");
  const loginEndpoint = accountApiInfo.controls?.password?.login;
  const loginObj = {
    email: accountEmail(account),
    password: "password",
  };
  if (!loginEndpoint) {
    throw new Error(
      `accountApiInfo.controls?.password?.login should not be empty`
    );
  }

  cli.v2(`POSTing to: ${loginEndpoint}`);
  const loginResp = await fetch(loginEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(loginObj),
  });
  cli.v3(`loginResp.ok`, loginResp.ok, `loginResp.status`, loginResp.status);
  const cookies = [];
  for (const [k, v] of loginResp.headers.entries()) {
    if (k.toLowerCase() === "set-cookie") {
      cookies.push(v);
    }
  }
  const cookieHeader = cookies
    .map((c) =>
      c.substring(0, c.indexOf(";") == -1 ? undefined : c.indexOf(";"))
    )
    .reduce((a, b) => a + "; " + b);
  cli.v3("Got cookie", cookieHeader);

  ////// Get WebID from account info /////
  const fullAccountApiInfo = await getAccountApiInfo(cli, cookieHeader);
  if (!fullAccountApiInfo) {
    throw new Error(`Failed to fetch logged in account API info`);
  }

  cli.v2("Looking for WebID...");
  const accountInfo = await getAccountInfo(
    cli,
    cookieHeader,
    fullAccountApiInfo
  );
  const webId = Object.keys(accountInfo.webIds)[0];
  cli.v2("WebID found", webId);

  cli.v2("Creating Token (client credential)...");
  const clientCredentialsEndpoint =
    fullAccountApiInfo.controls?.account?.clientCredentials;
  if (!clientCredentialsEndpoint) {
    throw new Error(
      `fullAccountApiInfo.controls.account.clientCredentials should not be empty`
    );
  }
  //see https://github.com/CommunitySolidServer/CommunitySolidServer/blob/main/documentation/markdown/usage/client-credentials.md
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const startTime = new Date().getTime();
  let res = null;
  let body = null;
  try {
    res = await fetcher(clientCredentialsEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Accept: "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        webId: webId,
      }),
      signal: controller.signal,
    });

    body = await res.text();
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error(`Fetching user token took too long: aborted`);
    }
    throw error;
  }
  if (!res || !res.ok) {
    console.error(
      `${res.status} - Creating token for ${account} failed:`,
      body
    );
    throw new ResponseError(res, body);
  }

  const { id, secret } = JSON.parse(body);
  return { id, secret };
}

export function stillUsableAccessToken(
  accessToken: AccessToken,
  deadline_s: number = 5 * 60
): boolean {
  if (!accessToken.token || !accessToken.expire) {
    return false;
  }
  const now = new Date().getTime();
  const expire = accessToken.expire.getTime();
  //accessToken.expire should be 5 minutes in the future at least
  return expire > now && expire - now > deadline_s * 1000;
}

export async function getUserAuthFetch(
  cssBaseUrl: string,
  account: string,
  token: UserToken,
  fetcher: AnyFetchType = fetch,
  accessToken: AccessToken | null = null
): Promise<[AnyFetchType, AccessToken]> {
  //see https://github.com/CommunitySolidServer/CommunitySolidServer/blob/main/documentation/markdown/usage/client-credentials.md
  const { id, secret } = token;

  let accessTokenDurationStart = null;
  try {
    if (accessToken === null || !stillUsableAccessToken(accessToken)) {
      const generateDpopKeyPairDurationStart = new Date().getTime();
      const dpopKeyPair = await generateDpopKeyPair();
      const authString = `${encodeURIComponent(id)}:${encodeURIComponent(
        secret
      )}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const url = `${cssBaseUrl}.oidc/token`; //ideally, fetch this from token_endpoint in .well-known/openid-configuration

      accessTokenDurationStart = new Date().getTime();
      const res = await fetcher(url, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(authString).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
          dpop: await createDpopHeader(url, "POST", dpopKeyPair),
        },
        body: "grant_type=client_credentials&scope=webid",
        signal: controller.signal,
      });

      const body = await res.text();

      if (!res.ok) {
        console.error(
          `${res.status} - Creating access token for ${account} failed:`
        );
        console.error(body);
        throw new ResponseError(res, body);
      }

      const { access_token: accessTokenStr, expires_in: expiresIn } =
        JSON.parse(body);
      const expire = new Date(
        new Date().getTime() + parseInt(expiresIn) * 1000
      );
      accessToken = {
        token: accessTokenStr,
        expire: expire,
        dpopKeyPair: dpopKeyPair,
      };
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error(`Fetching access token took too long: aborted`);
    }
    throw error;
  }

  const authFetch: AnyFetchType = await buildAuthenticatedFetch(
    // @ts-ignore
    fetcher,
    accessToken.token,
    { dpopKey: accessToken.dpopKeyPair }
  );

  return [authFetch, accessToken];
}
