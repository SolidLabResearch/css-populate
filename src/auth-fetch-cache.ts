import {
  AccessToken,
  createUserToken,
  getUserAuthFetch,
  stillUsableAccessToken,
  UserToken,
} from "./solid-auth.js";
import { AnyFetchType, es6fetch } from "./generic-fetch.js";
import { CliArgs } from "./css-populate-args.js";
import { ProvidedAccountInfo } from "./generate-users.js";

export class AuthFetchCache {
  cli: CliArgs;
  cssBaseUrl: string;
  authenticateCache: "none" | "token" | "all" = "none";
  authenticate: boolean = false;

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

  //TODO see if we can always use ProvidedAccountInfo
  async getAuthFetcher(
    accountInfo: ProvidedAccountInfo
  ): Promise<AnyFetchType> {
    return this.getAuthFetcherInternal(accountInfo.index, accountInfo.username);
  }

  async getAuthFetcherInternal(
    accountIndex: number,
    username: string
  ): Promise<AnyFetchType> {
    this.useCount++;
    if (!this.authenticate) {
      return this.fetcher;
    }
    this.expireAccessToken(accountIndex);
    let userToken = null;
    let accessToken = null;
    let theFetch = null;
    if (this.authenticateCache !== "none") {
      if (this.cssTokensByUser[accountIndex]) {
        userToken = this.cssTokensByUser[accountIndex];
      }
      if (this.authenticateCache === "all") {
        if (this.authAccessTokenByUser[accountIndex]) {
          accessToken = this.authAccessTokenByUser[accountIndex];
        }
        if (this.authFetchersByUser[accountIndex]) {
          theFetch = this.authFetchersByUser[accountIndex];
        }
      }
    }

    if (!userToken) {
      userToken = await createUserToken(
        this.cli,
        this.cssBaseUrl,
        username,
        "password",
        this.fetcher
      );
      this.tokenFetchCount++;
    }
    if (!theFetch) {
      [theFetch, accessToken] = await getUserAuthFetch(
        this.cli,
        this.cssBaseUrl,
        username,
        userToken,
        this.fetcher,
        accessToken
      );
      this.authFetchCount++;
    }

    if (
      this.authenticateCache !== "none" &&
      !this.cssTokensByUser[accountIndex]
    ) {
      this.cssTokensByUser[accountIndex] = userToken;
    }
    if (
      this.authenticateCache === "all" &&
      !this.authAccessTokenByUser[accountIndex]
    ) {
      this.authAccessTokenByUser[accountIndex] = accessToken;
    }
    if (
      this.authenticateCache === "all" &&
      !this.authFetchersByUser[accountIndex]
    ) {
      this.authFetchersByUser[accountIndex] = theFetch;
    }

    return theFetch;
  }
}
