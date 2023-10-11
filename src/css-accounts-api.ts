import { CliArgs } from "./css-populate-args.js";
import fetch from "node-fetch";
import { ResponseError } from "./error.js";
import { ProvidedAccountInfo } from "./generate-users.js";

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
    main: {
      index: string;
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

export interface UserToken {
  id: string;
  secret: string;
}

export async function getAccountApiInfo(
  cli: CliArgs,
  accountApiUrl: string,
  cookieHeader?: string
): Promise<AccountApiInfo | null> {
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
  const accountInfoUrl = fullAccountApiInfo.controls?.main?.index;
  // const accountInfoUrl = fullAccountApiInfo.controls?.account?.account;
  // if (!accountInfoUrl) {
  //   throw new Error(
  //     `accountApiInfo.controls.account.account should not be empty. Got: ${JSON.stringify(
  //       fullAccountApiInfo,
  //       null,
  //       3
  //     )}`
  //   );
  // }
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

export async function accountLogin(
  cli: CliArgs,
  accountApiInfo: AccountApiInfo,
  email: string,
  password: string = "password"
): Promise<string> {
  cli.v2("Logging in...");
  const loginEndpoint = accountApiInfo.controls?.password?.login;
  if (!loginEndpoint) {
    throw new Error(
      `accountApiInfo.controls?.password?.login should not be empty`
    );
  }
  const loginObj = {
    email,
    password,
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
  if (!loginResp.ok) {
    console.error(`${loginResp.status} - failed to login:`);
    const body = await loginResp.text();
    console.error(body);
    throw new ResponseError(loginResp, body);
  }
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
  return cookieHeader;
}

export async function createClientCredential(
  cli: CliArgs,
  cookieHeader: string,
  webId: string,
  account: string,
  fullAccountApiInfo: AccountApiInfo
): Promise<UserToken> {
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
    res = await fetch(clientCredentialsEndpoint, {
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
  } finally {
    clearTimeout(timeoutId);
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

export async function createEmptyAccount(
  cli: CliArgs,
  accountInfo: ProvidedAccountInfo,
  basicAccountApiInfo: AccountApiInfo
): Promise<string | null> {
  const accountCreateEndpoint = basicAccountApiInfo?.controls?.account?.create;

  cli.v2(`Creating Account...`);
  cli.v2(`POSTing to: ${accountCreateEndpoint}`);
  let resp = await fetch(accountCreateEndpoint, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: null,
  });

  if (resp.status == 404) {
    cli.v1(`404 registering user: incompatible IdP path`);
    return null;
  }
  if (!resp.ok) {
    console.error(
      `${resp.status} - Creating account for ${accountInfo.username} failed:`
    );
    const body = await resp.text();
    console.error(body);
    throw new ResponseError(resp, body);
  }

  //reply contains:
  //   - cookie(s) (auth)
  //   - resource field with account url

  const createAccountBody: any = await resp.json();
  // const accountUrl: string | undefined = createAccountBody?.resource;
  const cookies = [];
  for (const [k, v] of resp.headers.entries()) {
    if (k.toLowerCase() === "set-cookie") {
      cookies.push(v);
    }
  }
  const cookieHeader = cookies
    .map((c) =>
      c.substring(0, c.indexOf(";") == -1 ? undefined : c.indexOf(";"))
    )
    .reduce((a, b) => a + "; " + b);

  // if (!accountUrl || !accountUrl.startsWith("http")) {
  //   console.error(
  //     `Creating account for ${
  //       accountInfo.username
  //     } failed: no resource in response: ${JSON.stringify(
  //       createAccountBody,
  //       null,
  //       3
  //     )}`
  //   );
  //   throw new ResponseError(resp, createAccountBody);
  // }
  if (!cookies) {
    console.error(
      `Creating account for ${
        accountInfo.username
      } failed: no cookies in response. headers: ${JSON.stringify(
        resp.headers,
        null,
        3
      )}`
    );
    throw new ResponseError(resp, createAccountBody);
  }
  return cookieHeader;
}

export async function createPassword(
  cli: CliArgs,
  cookieHeader: string,
  account: string,
  email: string,
  password: string,
  fullAccountApiInfo: AccountApiInfo
): Promise<boolean> {
  cli.v2(`Creating password...`);

  const passCreateEndpoint = fullAccountApiInfo?.controls?.password?.create;
  cli.v2(`Account API gave passCreateEndpoint: ${passCreateEndpoint}`);
  if (!passCreateEndpoint) {
    throw new Error(
      `fullAccountApiInfo?.controls?.password?.create should not be empty`
    );
  }

  const createPassObj = {
    email,
    password,
  };

  cli.v2(`POSTing to: ${passCreateEndpoint}`);
  const passCreateResp = await fetch(passCreateEndpoint, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(createPassObj),
  });
  cli.v3(
    `passCreateResp.ok`,
    passCreateResp.ok,
    `passCreateResp.status`,
    passCreateResp.status
  );

  if (!passCreateResp.ok) {
    const body = await passCreateResp.text();
    // if (body.includes("There already is a login for this e-mail address.")) {
    if (body.includes("already is a login for")) {
      cli.v1(
        `${passCreateResp.status} - User ${account} already exists, will ignore. Msg:`,
        body
      );
      //ignore
      return false;
    }
    console.error(
      `${passCreateResp.status} - Creating password for ${account} failed:`
    );
    console.error(body);
    throw new ResponseError(passCreateResp, body);
  }

  return true;
}

export async function createAccountPod(
  cli: CliArgs,
  cookieHeader: string,
  podName: string,
  fullAccountApiInfo: AccountApiInfo
): Promise<boolean> {
  cli.v2(`Creating Pod + WebID...`);

  const podCreateEndpoint = fullAccountApiInfo?.controls?.account?.pod;
  cli.v2(`Account API gave podCreateEndpoint: ${podCreateEndpoint}`);
  if (!podCreateEndpoint) {
    throw new Error(
      `fullAccountApiInfo.controls.account.pod should not be empty`
    );
  }

  const podCreateObj = {
    name: podName,

    //  "If no WebID value is provided, a WebID will be generated in the pod and immediately linked to the
    //  account as described in controls.account.webID. This WebID will then be the WebID that has initial access."

    // settings: {  webId: 'custom'},
  };

  cli.v2(`POSTing to: ${podCreateEndpoint}`);
  const podCreateResp = await fetch(podCreateEndpoint, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(podCreateObj),
  });
  cli.v3(
    `podCreateResp.ok`,
    podCreateResp.ok,
    `podCreateResp.status`,
    podCreateResp.status
  );

  if (!podCreateResp.ok) {
    console.error(
      `${podCreateResp.status} - Creating Pod & WebID for ${podName} failed:`
    );
    const body = await podCreateResp.text();
    console.error(body);
    throw new ResponseError(podCreateResp, body);
  }
  return true;
}
