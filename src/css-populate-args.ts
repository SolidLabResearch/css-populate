#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

let ya = yargs(hideBin(process.argv))
  .usage("Usage: $0 --url <url> --generate-xxx --generate-yyy ...")
  .option("v", {
    group: "Base:",
    type: "count",
    description:
      "Verbosity. The more times this option is added, the more messages are printed.",
    demandOption: false,
  })
  .option("url", {
    group: "CSS Server:",
    alias: "u",
    type: "string",
    description: "Base URL of the CSS",
    demandOption: true,
    array: true,
  })
  .option("user-count", {
    group: "CSS Server:",
    type: "number",
    description: "Number of users/pods to generate/populate",
    demandOption: true,
  })
  .option("generate-users", {
    group: "Generate users:",
    type: "boolean",
    description:
      "Generate users. If not specified, it is assumed users have already been generated.",
    default: false,
    demandOption: false,
  })
  .option("generate-variable-size", {
    group: "Generate Variable Size Content:",
    type: "boolean",
    description:
      "Generate 7 files with random data of increasing size: 10.rnd, ...  10_000_000.rnd",
    default: false,
    demandOption: false,
  })
  .option("generate-fixed-size", {
    group: "Generate Fixed Size Content:",
    type: "boolean",
    description:
      "Generate a configurable number of files of configurable fixed size",
    default: false,
    demandOption: false,
  })
  .option("file-count", {
    group: "Generate Fixed Size Content:",
    type: "number",
    description: "Number of files to generate",
    demandOption: false,
    default: 0,
    implies: ["generate-fixed-size"],
  })
  .option("file-size", {
    group: "Generate Fixed Size Content:",
    type: "number",
    description: "Size of files to generate",
    demandOption: false,
    default: 0,
    implies: ["generate-fixed-size"],
  })
  .option("generate-rdf", {
    group: "Generate RDF Content:",
    type: "boolean",
    description: "Generate RDF files with various content types",
    default: false,
    demandOption: false,
  })
  .option("base-rdf-file", {
    group: "Generate RDF Content:",
    type: "string",
    description:
      "Base RDF file to upload. Will be converted into various RDF file formats.",
    demandOption: false,
    implies: ["generate-rdf"],
  })
  .option("generate-from-dir", {
    group: "Use content from a directory:",
    type: "boolean",
    description:
      "Populate with existing content read from a specified directory",
    default: false,
    demandOption: false,
  })
  .option("add-acl-files", {
    group: "Generate Content:",
    type: "boolean",
    description:
      "Upload a corresponding .acl file for each generated file and/or dir",
    default: false,
    demandOption: false,
  })
  .option("add-acr-files", {
    group: "Generate Content:",
    type: "boolean",
    description:
      "Upload a corresponding .acr file for each generated file and/or dir",
    default: false,
    demandOption: false,
  })
  .option("add-ac-file-per-resource", {
    group: "Generate Content:",
    type: "boolean",
    description:
      "Upload a corresponding .acl/.acr file for each generated file. Use --no-add-ac-file-per-resource to set to false.",
    default: true,
    demandOption: false,
  })
  .option("add-ac-file-per-dir", {
    group: "Generate Content:",
    type: "boolean",
    description:
      "Upload a corresponding .acl/.acr file for each pod root and subdir. Use --no-add-ac-file-per-dir to set to false.",
    default: true,
    demandOption: false,
  })
  .option("dir-depth", {
    group: "Generate Content:",
    type: "number",
    description:
      "Put the generated content in this amount of nested subdirs. Use 0 for no subdirs (= files in pod root). " +
      "Subdirs will all be named 'data'. " +
      "Example generated file if this option is 2: https://example.com/user0/data/data/10.rnd",
    default: 0,
    demandOption: false,
  })
  .option("dir", {
    group: "Use content from a directory:",
    type: "string",
    description: "Dir with the generated data",
    demandOption: false,
    implies: ["generate-from-dir"],
  })
  .help()
  .check((argv, options) => {
    if (argv.url.length < 1) {
      return "--url should be specified at least once";
    }
    if (argv.generateUsers && !argv.userCount) {
      return "--generate-users requires --user-count";
    }
    if (argv.generateFixedSize && !argv.userCount) {
      return "--generate-fixed-size requires --user-count";
    }
    if (argv.generateFixedSize && !argv.fileSize) {
      return "--generate-fixed-size requires --file-size";
    }
    if (argv.generateFixedSize && !argv.fileCount) {
      return "--generate-fixed-size requires --file-count";
    }
    if (argv.generateFromDir && !argv.dir) {
      return "--generate-from-dir requires --dir";
    }
    if (argv.generateRdf && !argv.baseRdfFile) {
      return "--generate-rdf requires --base-rdf-file";
    }
    if (
      !argv.generateFromDir &&
      !argv.generateVariableSize &&
      !argv.generateRdf &&
      !argv.generateFixedSize
    ) {
      return "select at least one --generate-xxx option";
    }
    return true;
  })
  .wrap(120)
  .strict(true);

// ya = ya.wrap(ya.terminalWidth());
const argv = ya.parseSync();

export interface CliArgs {
  verbosity_count: number;
  cssBaseUrl: string[];
  userCount: number;
  fileSize: number;
  fileCount: number;
  addAclFiles: boolean;
  addAcrFiles: boolean;
  dirDepth: number;
  generateUsers: boolean;
  addAcFilePerDir: boolean;
  addAcFilePerResource: boolean;
  generateVariableSize: boolean;
  generateFixedSize: boolean;
  generateRdf: boolean;
  generateFromDir: boolean;
  generatedDataBaseDir?: string;
  baseRdfFile?: string;

  v1: (message?: any, ...optionalParams: any[]) => void;
  v2: (message?: any, ...optionalParams: any[]) => void;
  v3: (message?: any, ...optionalParams: any[]) => void;
}

export function getCliArgs(): CliArgs {
  return {
    verbosity_count: argv.v,
    cssBaseUrl: argv.url.map((u) => (u.endsWith("/") ? u : u + "/")),
    userCount: argv.userCount || 1,
    fileSize: argv.fileSize || 10,
    fileCount: argv.fileCount || 1,
    addAclFiles: argv.addAclFiles,
    addAcrFiles: argv.addAcrFiles,
    generateUsers: argv.generateUsers,
    dirDepth: argv.dirDepth || 0,
    addAcFilePerDir: argv.addAcFilePerDir,
    addAcFilePerResource: argv.addAcFilePerResource,
    generateVariableSize: argv.generateVariableSize,
    generateFixedSize: argv.generateFixedSize,
    generateRdf: argv.generateRdf,
    generateFromDir: argv.generateFromDir,
    generatedDataBaseDir:
      argv.source === "dir"
        ? argv.dir?.endsWith("/")
          ? argv.dir
          : argv.dir + "/"
        : undefined,
    baseRdfFile: argv.baseRdfFile,

    v3: (message?: any, ...optionalParams: any[]) => {
      if (argv.v >= 3) console.log(message, ...optionalParams);
    },
    v2: (message?: any, ...optionalParams: any[]) => {
      if (argv.v >= 2) console.log(message, ...optionalParams);
    },
    v1: (message?: any, ...optionalParams: any[]) => {
      if (argv.v >= 1) console.log(message, ...optionalParams);
    },
  };
}
