import nodeFetch from "node-fetch";
import { Response as NodeFetchResponse } from "node-fetch";

export type AnyFetchType = typeof fetch | typeof nodeFetch;
export type AnyFetchResponseType = Response | NodeFetchResponse;

const nodeMajorVersion = parseInt(
  process.version.substring(1, process.version.indexOf("."))
);

//only in nodejs 18!
export const es6fetch = nodeMajorVersion >= 18 ? fetch : nodeFetch;
