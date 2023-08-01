import { CliArgs } from "./css-populate-args";
import { AnyFetchType } from "./generic-fetch";
import fetch from "node-fetch";
import { createUserTokenv6, createUserTokenv7, UserToken } from "./solid-auth";

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
