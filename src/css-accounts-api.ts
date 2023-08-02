import { CliArgs } from "./css-populate-args.js";
import fetch from "node-fetch";
import { ResponseError } from "./error.js";

//see
// https://github.com/CommunitySolidServer/CommunitySolidServer/blob/b02c8dcac1ca20eb61af62a648e0fc68cecc7dd2/documentation/markdown/usage/account/json-api.md
// https://github.com/CommunitySolidServer/CommunitySolidServer/blob/feat/accounts/documentation/markdown/usage/account/json-api.md

export interface AccountApiInfo {
  controls: {
    password?: {
      create?: string;
      forgot?: string;
      login?: string;
      reset?: string;
    };
    account: {
      create: string;
      clientCredentials?: string;
      pod?: string;
      webId?: string;
      logout?: string;
      account?: string;
    };
    main?: {
      index?: string;
      logins?: string;
    };
    html?: Object; //we don't care about this one
  };
  version: string; //"0.5"
}

export interface AccountInfo {
  logins: {
    password: {
      [email: string]: string;
      //"test@example.com": "http://localhost:3000/.account/account/c63c9e6f-48f8-40d0-8fec-238da893a7f2/login/password/test%40example.com/";
    };
  };
  pods: {
    [url: string]: string;
    // "http://localhost:3000/test/": "http://localhost:3000/.account/account/c63c9e6f-48f8-40d0-8fec-238da893a7f2/pod/7def7830df1161e422537db594ad2b7412ffb735e0e2320cf3e90db19cd969f9/";
  };
  webIds: {
    [webid: string]: string;
    // "http://localhost:3000/test/profile/card#me": "http://localhost:3000/.account/account/c63c9e6f-48f8-40d0-8fec-238da893a7f2/webid/5c1b70d3ffaa840394dda86889ed1569cf897ef3d6041fb4c9513f82144cbb7f/";
  };
  clientCredentials: {
    [name: string]: string;
    // "token_562cdeb5-d4b2-4905-9e62-8969ac10daaa": "http://localhost:3000/.account/account/c63c9e6f-48f8-40d0-8fec-238da893a7f2/client-credentials/token_562cdeb5-d4b2-4905-9e62-8969ac10daaa/";
  };
  settings: any;
}

export async function getAccountApiInfo(
  cli: CliArgs,
  cookieHeader?: string
): Promise<AccountApiInfo | null> {
  const accountApiUrl = `${cli.cssBaseUrl}.account/`;
  const headers: any = { Accept: "application/json" };
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  const accountApiResp = await fetch(accountApiUrl, {
    method: "GET",
    headers,
  });

  cli.v3(
    `accountApiResp.ok`,
    accountApiResp.ok,
    `accountApiResp.status`,
    accountApiResp.status
  );

  if (accountApiResp.status == 404) {
    cli.v1(`404 fetching Account API at ${accountApiUrl}`);
    return null;
  }
  if (accountApiResp.ok) {
    const accountApiBody: AccountApiInfo = <AccountApiInfo>(
      await accountApiResp.json()
    );
    cli.v3(`Account API: ${JSON.stringify(accountApiBody, null, 3)}`);
    return accountApiBody;
  }
  return null;
}

export async function getAccountInfo(
  cli: CliArgs,
  cookieHeader: string,
  fullAccountApiInfo: AccountApiInfo
): Promise<AccountInfo> {
  const accountInfoUrl = fullAccountApiInfo.controls?.account?.account;
  if (!accountInfoUrl) {
    throw new Error(
      `accountApiInfo.controls.account.account should not be empty`
    );
  }
  console.assert(
    accountInfoUrl && accountInfoUrl.startsWith("http"),
    "Problem with account info URL",
    accountInfoUrl
  );

  cli.v2(`Fetching account info`);
  const accountInfoResp = await fetch(accountInfoUrl, {
    method: "GET",
    headers: { Accept: "application/json", Cookie: cookieHeader },
  });

  cli.v3(
    `accountInfoResp.ok`,
    accountInfoResp.ok,
    `accountInfoResp.status`,
    accountInfoResp.status
  );

  if (!accountInfoResp.ok) {
    console.error(`${accountInfoResp.status} - Fetching account info failed:`);
    const body = await accountInfoResp.text();
    console.error(body);
    throw new ResponseError(accountInfoResp, body);
  }
  const accountInfoBody: AccountInfo = <AccountInfo>(
    await accountInfoResp.json()
  );
  cli.v3(`Account Info: ${JSON.stringify(accountInfoBody, null, 3)}`);
  return accountInfoBody;
}
