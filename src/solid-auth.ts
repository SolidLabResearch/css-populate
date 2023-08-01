import {
  buildAuthenticatedFetch,
  createDpopHeader,
  generateDpopKeyPair,
} from "@inrupt/solid-client-authn-core";
import { ResponseError } from "./error.js";
import { KeyPair } from "@inrupt/solid-client-authn-core/src/authenticatedFetch/dpopUtils";
import { AnyFetchType } from "./generic-fetch.js";
import { CliArgs } from "./css-populate-args";
import fetch from "node-fetch";
import { AccountApiInfo, getAccountApiInfo } from "./css-accounts-api.js";

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
  const accountApiUrl = `${cssBaseUrl}.account/`;
  const accountApiResp = await fetch(accountApiUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  cli.v3(
    `accountApiResp.ok`,
    accountApiResp.ok,
    `accountApiResp.status`,
    accountApiResp.status
  );

  if (accountApiResp.status === 404) {
    cli.v1(`404 fetching Account API at ${accountApiUrl}`);
  }
  if (accountApiResp.ok) {
    const body: any = await accountApiResp.json();
    cli.v3(`Account API: ${JSON.stringify(body, null, 3)}`);
    if (body?.controls?.account?.create) {
      cli.v2(`Account API confirms v7`);

      return await createUserTokenv7(
        cli,
        cssBaseUrl,
        account,
        password,
        fetcher,
        body?.controls
      );
    } else {
      cli.v2(`Account API unclear`);
    }
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
  let controls = accountApiInfo.controls;
  const clientCredentialsEndpoint = controls?.account?.clientCredentials;

  ////// Login (= get cookie) /////
  cli.v2("Logging in...");
  const loginEndpoint = controls?.password?.login;
  const loginObj = {
    email: accountEmail(account),
    password: "password",
  };

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
  controls = (await getAccountApiInfo(cli, cookieHeader))?.controls;

  cli.v2("Looking for WebID...");
  let accountInfoEndpoint = controls?.account?.account;
  console.assert(
    accountInfoEndpoint && accountInfoEndpoint.startsWith("http"),
    "Problem with account info URL",
    accountInfoEndpoint
  );
  const accountInfoResp = await fetch(accountInfoEndpoint, {
    method: "GET",
    headers: { Cookie: cookieHeader, Accept: "application/json" },
  });
  if (!accountInfoResp.ok) {
    console.error(`${accountInfoResp.status} - Failed to get account info:`);
    const body = await accountInfoResp.text();
    console.error(body);
    throw new ResponseError(accountInfoResp, body);
  }
  const accountInfoObj: any = await accountInfoResp.json();
  const webId = Object.keys(accountInfoObj.webIds)[0];
  cli.v2("WebID found", webId);

  cli.v2("Creating Token (client credential)...");
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
