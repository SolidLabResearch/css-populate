import {
  AccessToken,
  createUserToken,
  getUserAuthFetch,
  stillUsableAccessToken,
  UserToken,
} from "./solid-auth.js";
import { AnyFetchType, es6fetch } from "./generic-fetch.js";
import { CliArgs } from "./css-populate-args.js";

export class AuthFetchCache {
  cli: CliArgs;
  cssBaseUrl: string;
  authenticateCache: "none" | "token" | "all" = "none";
  authenticate: boolean = false;

  accountMapByName: { [account: string]: number } = {};
  accountMapByIndex: { [index: number]: string } = {};

  cssTokensByUser: Array<UserToken | null> = [];
  authAccessTokenByUser: Array<AccessToken | null> = [];
  authFetchersByUser: Array<AnyFetchType | null> = [];

  useCount: number = 0;
  tokenFetchCount: number = 0;
  authFetchCount: number = 0;

  fetcher: AnyFetchType;

  constructor(
    cli: CliArgs,
    cssBaseUrl: string, //there might be multiple css servers, this cache is for one specific server
    authenticate: boolean,
    authenticateCache: "none" | "token" | "all",
    fetcher: AnyFetchType = es6fetch
  ) {
    this.cli = cli;
    this.cssBaseUrl = cssBaseUrl;
    this.authenticate = authenticate;
    this.authenticateCache = authenticateCache;
    this.fetcher = fetcher;
  }

  expireAccessToken(userId: number) {
    //remove access token if it is about to expire
    const at = this.authAccessTokenByUser[userId];
    if (at && !stillUsableAccessToken(at, 60)) {
      this.authAccessTokenByUser[userId] = null;
      this.authFetchersByUser[userId] = null;
    }
  }

  registerAccountName(index: number, name: string) {
    this.accountMapByIndex[index] = name;
    this.accountMapByName[name] = index;
  }

  getAccountIndex(name: string): number {
    const res = this.accountMapByName[name];
    if (res === undefined || res === null) {
      console.log(
        `Known accounts: ${JSON.stringify(Object.keys(this.accountMapByName))}`
      );
      throw Error(`Unknown account '${name}'`);
    }
    return res;
  }

  getAccountName(index: number): string {
    const res = this.accountMapByIndex[index];
    if (!res)
      throw Error(
        `Unknown account with index ${index} (len=${this.accountMapByName.length})`
      );
    return res;
  }

  async getAuthFetcherByName(name: string): Promise<AnyFetchType> {
    return this.getAuthFetcherInternal(this.getAccountIndex(name), name);
  }

  async getAuthFetcher(userId: number): Promise<AnyFetchType> {
    return this.getAuthFetcherInternal(userId, this.getAccountName(userId));
  }

  async getAuthFetcherInternal(
    userId: number,
    account: string
  ): Promise<AnyFetchType> {
    this.useCount++;
    if (!this.authenticate) {
      return this.fetcher;
    }
    this.expireAccessToken(userId);
    let userToken = null;
    let accessToken = null;
    let theFetch = null;
    if (this.authenticateCache !== "none") {
      if (this.cssTokensByUser[userId]) {
        userToken = this.cssTokensByUser[userId];
      }
      if (this.authenticateCache === "all") {
        if (this.authAccessTokenByUser[userId]) {
          accessToken = this.authAccessTokenByUser[userId];
        }
        if (this.authFetchersByUser[userId]) {
          theFetch = this.authFetchersByUser[userId];
        }
      }
    }

    if (!userToken) {
      userToken = await createUserToken(
        this.cli,
        this.cssBaseUrl,
        account,
        "password",
        this.fetcher
      );
      this.tokenFetchCount++;
    }
    if (!theFetch) {
      [theFetch, accessToken] = await getUserAuthFetch(
        this.cli,
        this.cssBaseUrl,
        account,
        userToken,
        this.fetcher,
        accessToken
      );
      this.authFetchCount++;
    }

    if (this.authenticateCache !== "none" && !this.cssTokensByUser[userId]) {
      this.cssTokensByUser[userId] = userToken;
    }
    if (
      this.authenticateCache === "all" &&
      !this.authAccessTokenByUser[userId]
    ) {
      this.authAccessTokenByUser[userId] = accessToken;
    }
    if (this.authenticateCache === "all" && !this.authFetchersByUser[userId]) {
      this.authFetchersByUser[userId] = theFetch;
    }

    return theFetch;
  }
}
