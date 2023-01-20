import { ResponseError } from "./error.js";
import { AnyFetchType } from "./generic-fetch.js";

/* Quick and dirty content type handling. Obviously needs to be done better. */
function filenameToContentType(filename: string): string {
  if (filename.endsWith(".acl")) {
    //from https://www.w3.org/2008/01/rdf-media-types but unsure if correct for ".acl"
    // return "application/x-turtle";
    return "text/turtle"; // what CSS expects for .acl
  }
  if (filename.endsWith(".txt")) {
    return "text/plain";
  }
  // if (filename.endsWith('.???')) {
  //
  // }
  return "application/octet-stream";
}

export async function downloadPodFile(
  cssBaseUrl: string,
  account: string,
  podFileRelative: string,
  authFetch: AnyFetchType
) {
  console.log(
    `   Will download file from account ${account}, pod path "${podFileRelative}"`
  );

  const res = await authFetch(`${cssBaseUrl}${account}/${podFileRelative}`, {
    method: "GET",
    headers: { accept: filenameToContentType(podFileRelative) },
  });

  // console.log(`res.ok`, res.ok);
  // console.log(`res.status`, res.status);
  // console.log(`res.text`, body);
  if (!res.ok) {
    const body = await res.text();
    console.error(
      `${res.status} - Uploading to account ${account}, pod path "${podFileRelative}" failed:`
    );
    console.error(body);
    throw new ResponseError(res, body);
  }
  //console.log("Got pod file with Content-Type: "+res.headers.get('Content-Type'));
  return await res.text();
}
