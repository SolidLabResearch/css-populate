import crypto from "crypto";
import { addAclFile, createPod, uploadPodFile } from "./css-upload.js";
import { AuthFetchCache } from "./auth-fetch-cache.js";
import { CONTENT_TYPE_BYTE } from "./content-type.js";
import N3, { StreamWriter } from "n3";
import fs from "fs";
import { PassThrough, Stream, Writable } from "stream";
import * as util from "util";
// import * as StreamPromises from "stream/promises";
import { pipeline } from "node:stream/promises";
import { JsonLdSerializer } from "jsonld-streaming-serializer";

function generateContent(byteCount: number): ArrayBuffer {
  return crypto.randomBytes(byteCount).buffer; //fetch can handle ArrayBuffer
  // return crypto.randomBytes(byteCount).toString('base64');

  // const c = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  // const cl = c.length;
  // let res = '';
  // for (let i = 0; i < byteCount; i++ ) {
  //     res += c.charAt(Math.floor(Math.random()*cl));
  // }
  // return res;
}

export async function generateVariableSizeFiles(
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  userCount: number,
  addAclFiles: boolean = false
) {
  const files: Array<[string, Buffer]> = [];
  // for (const size in [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000]) {
  for (const size of [
    "10",
    "100",
    "1_000",
    "10_000",
    "100_000",
    "1_000_000",
    "10_000_000",
  ]) {
    const size_int = parseInt(size.replaceAll("_", ""));
    files.push([`${size}.rnd`, Buffer.from(generateContent(size_int))]);
  }

  for (let i = 0; i < userCount; i++) {
    const account = `user${i}`;
    const authFetch = await authFetchCache.getAuthFetcher(i);
    // await uploadPodFile(
    //   cssBaseUrl,
    //   account,
    //   "DUMMY DATA FOR " + account,
    //   "dummy.txt",
    //   authFetch
    // );

    for (const [fileName, fileContent] of files) {
      await uploadPodFile(
        cssBaseUrl,
        account,
        fileContent,
        fileName,
        authFetch,
        CONTENT_TYPE_BYTE,
        i < 2
      );

      if (addAclFiles) {
        await addAclFile(
          cssBaseUrl,
          account,
          authFetch,
          fileName,
          true,
          false,
          false,
          i < 2
        );
      }
    }
  }
}

export async function generateFixedSizeFiles(
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  userCount: number,
  fileCount: number,
  fileSize: number,
  addAclFiles: boolean = false
) {
  const fileContent = Buffer.from(generateContent(fileSize));

  for (let i = 0; i < userCount; i++) {
    const startTime = new Date().getTime();
    const account = `user${i}`;
    const authFetch = await authFetchCache.getAuthFetcher(i);

    for (let j = 0; j < fileCount; j++) {
      const fileName = `fixed_${j}`;
      await uploadPodFile(
        cssBaseUrl,
        account,
        fileContent,
        fileName,
        authFetch,
        CONTENT_TYPE_BYTE,
        i < 2
      );

      if (addAclFiles) {
        await addAclFile(
          cssBaseUrl,
          account,
          authFetch,
          fileName,
          true,
          true,
          false,
          i < 2
        );
      }
    }
    const stopTime1 = new Date().getTime();

    const stopTime2 = new Date().getTime();
    if (i < 100) {
      var duration1_s = (stopTime1 - startTime) / 1000.0;
      var duration2_s = (stopTime2 - stopTime1) / 1000.0;
      console.log(
        `Uploading ${fileCount} fixed files of size ${fileSize}byte for user ${i} took ${duration1_s}s` +
          ` (+ ${duration2_s}s for 1 acl file)`
      );
    }
  }
}

const RDFTypeValues = [
  "TURTLE",
  "N_TRIPLES",
  "RDF_XML",
  "JSON_LD",
  "N3",
  "N_QUADS",
] as const;
type RDFType = typeof RDFTypeValues[number];
const RDFContentTypeMap: { [Property in RDFType]: string } = {
  TURTLE: "text/turtle",
  N_TRIPLES: "application/n-triples",
  RDF_XML: "application/rdf+xml",
  JSON_LD: "application/ld+json",
  N3: "text/n3;charset=utf-8",
  N_QUADS: "application/n-quads",
};
const RDFFormatMap: { [Property in RDFType]: string } = {
  TURTLE: "Turtle",
  N_TRIPLES: "N-Triples",
  RDF_XML: "RDF/XML",
  JSON_LD: "JSON-LD",
  N3: "Notation3",
  N_QUADS: "N-Quads",
};
const RDFExtMap: { [Property in RDFType]: string } = {
  TURTLE: "ttl", //or .turtle
  N_TRIPLES: "nt", //or .ntriples
  N_QUADS: "nq", //or .nquads
  RDF_XML: "rdf", //or .rdfxml or .owl
  JSON_LD: "jsonld", // or .json
  N3: "n3",
};

async function convertRdf(
  inFilename: string,
  outType: RDFType
): Promise<Buffer> {
  const inputStream = fs.createReadStream(inFilename);
  const parserStream = new N3.StreamParser();
  inputStream.pipe(parserStream);

  let serializerStream;
  switch (outType) {
    case "TURTLE":
    case "N_TRIPLES":
    case "N3":
    case "N_QUADS": {
      serializerStream = new N3.StreamWriter({ format: RDFFormatMap[outType] });
      break;
    }
    case "RDF_XML": {
      throw new Error(`RDF/XML not yet supported`);
    }
    case "JSON_LD": {
      serializerStream = new JsonLdSerializer();
      break;
    }
    default:
      throw new Error(`unhandled RDFType ${outType}`);
  }
  parserStream.pipe(serializerStream);

  const buffers: any[] = [];
  const writableStream = new Writable({
    write(chunk, encoding, callback) {
      buffers.push(chunk);
      callback();
    },
    final(callback: (error?: Error | null) => void) {
      callback();
    },
  });
  await pipeline(serializerStream, writableStream);
  return Buffer.concat(buffers);

  // outStream.pipe(writableStream);
  //
  // const bufs = new Promise<Buffer>(function (resolve, reject) {
  //   writableStream.on("close", () => {
  //     resolve(Buffer.concat(buffers));
  //   });
  //   writableStream.on("error", (e) => {
  //     reject(e);
  //   });
  // });
  // return await bufs;
}

export async function generateRdfFiles(
  inputBaseRdfFile: string,
  authFetchCache: AuthFetchCache,
  cssBaseUrl: string,
  userCount: number,
  addAclFiles: boolean = false
) {
  const fileInfos: { fileName: string; buffer: Buffer; contentType: string }[] =
    [];
  for (const rt of RDFTypeValues) {
    if (rt === "RDF_XML") {
      //not supported
      continue;
    }
    const fileName = `rdf_example_${rt}.${RDFExtMap[rt]}`;
    const contentType = RDFContentTypeMap[rt];
    let buffer;
    try {
      buffer = await convertRdf(inputBaseRdfFile, rt);
      console.log(`converted input RDF to ${rt}: ${buffer.byteLength} bytes`);
    } catch (e) {
      console.error(`error converting RDF to ${rt}`, e);
      throw e;
    }
    fileInfos.push({ fileName, buffer, contentType });
  }

  for (let i = 0; i < userCount; i++) {
    const account = `user${i}`;
    const authFetch = await authFetchCache.getAuthFetcher(i);

    for (const fileInfo of fileInfos) {
      await uploadPodFile(
        cssBaseUrl,
        account,
        fileInfo.buffer,
        fileInfo.fileName,
        authFetch,
        fileInfo.contentType,
        i < 2
      );

      if (addAclFiles) {
        await addAclFile(
          cssBaseUrl,
          account,
          authFetch,
          fileInfo.fileName,
          true,
          false,
          false,
          i < 2
        );
      }
    }
  }
}
