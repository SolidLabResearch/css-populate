import fs from "fs";
import N3 from "n3";
import { JsonLdSerializer } from "jsonld-streaming-serializer";
import { Writable } from "stream";
import { pipeline } from "node:stream/promises";

export const RDFTypeValues = [
  "TURTLE",
  "N_TRIPLES",
  "RDF_XML",
  "JSON_LD",
  "N3",
  "N_QUADS",
] as const;
export type RDFType = typeof RDFTypeValues[number];
export const RDFContentTypeMap: { [Property in RDFType]: string } = {
  TURTLE: "text/turtle",
  N_TRIPLES: "application/n-triples",
  RDF_XML: "application/rdf+xml",
  JSON_LD: "application/ld+json",
  N3: "text/n3;charset=utf-8",
  N_QUADS: "application/n-quads",
};
export const RDFFormatMap: { [Property in RDFType]: string } = {
  TURTLE: "Turtle",
  N_TRIPLES: "N-Triples",
  RDF_XML: "RDF/XML",
  JSON_LD: "JSON-LD",
  N3: "Notation3",
  N_QUADS: "N-Quads",
};
export const RDFExtMap: { [Property in RDFType]: string } = {
  TURTLE: "ttl", //or .turtle
  N_TRIPLES: "nt", //or .ntriples
  N_QUADS: "nq", //or .nquads
  RDF_XML: "rdf", //or .rdfxml or .owl
  JSON_LD: "jsonld", // or .json
  N3: "n3",
};

export async function convertRdf(
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
