import { ResponseError } from "./error.js";
import { AnyFetchType } from "./generic-fetch.js";

export async function downloadPodFile(
  cssBaseUrl: string,
  account: string,
  podFileRelative: string,
  authFetch: AnyFetchType,
  contentType: string
) {
  console.log(
    `   Will download file from account ${account}, pod path "${podFileRelative}"`
  );

  const res = await authFetch(`${cssBaseUrl}${account}/${podFileRelative}`, {
    method: "GET",
    headers: { accept: contentType },
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
