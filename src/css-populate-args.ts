#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export enum AccountAction {
  UseExisting,
  Create,
  Auto,
}

export enum AccountSource {
  File,
  Template,
}

export interface CliArgs {
  verbosity_count: number;
  cssBaseUrl: string[];

  accountAction: AccountAction;
  accountSource: AccountSource;
  accountSourceCount: number;
  accountSourceFile?: string;
  accountSourceTemplateUsername: string;
  accountSourceTemplatePass: string;

  fileSize: number;
  fileCount: number;
  addAclFiles: boolean;
  addAcrFiles: boolean;
  dirDepth: number;
  userJsonOut?: string;
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
    .option("accounts", {
      group: "Accounts:",
      type: "string",
      choices: ["USE_EXISTING", "CREATE", "AUTO"],
      description:
        "Do accounts exist already, or do they need to be created? (AUTO will create them if they don't yet exist.)" +
        " Creating accounts includes creating a webID, and a pod.",
      // default: "USE_EXISTING",
      demandOption: true,
    })
    .option("account-source", {
      group: "Accounts:",
      type: "string",
      choices: ["FILE", "TEMPLATE"],
      description:
        "Where to get the accounts to use or generate? A FILE with json info, or generate from TEMPLATE?",
      default: "TEMPLATE",
      demandOption: false,
    })
    .option("account-source-count", {
      group: "Accounts:",
      type: "number",
      description: "Number of users/pods to generate/populate",
      demandOption: false,
    })
    .option("account-source-file", {
      group: "Accounts:",
      type: "string",
      description:
        "The file from which to read JSON account info. Expected JSON: [{username: foo, password: bar}, ...]",
      demandOption: false,
    })
    .option("account-template-username", {
      group: "Accounts:",
      type: "string",
      description:
        "Template for the account username. The text {{NR}} is replaced by the user number.",
      default: "user{{NR}}",
      demandOption: false,
    })
    .option("account-template-password", {
      group: "Accounts:",
      type: "string",
      description:
        "Template for the account password. The text {{NR}} is replaced by the user number.",
      default: "pass",
      demandOption: false,
    })

    .option("user-json-out", {
      group: "Generate users:",
      type: "string",
      description:
        "A file to write user info to in JSON format. (username/password, webID, pod root URL, ...)",
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
    .check((argvc, options) => {
      if (argvc.url.length < 1) {
        return "--url should be specified at least once";
      }

      if (argvc.accountSource == "FILE" && !argvc.accountSourceFile) {
        return "--account-source FILE requires --account-source-file";
      }
      if (argvc.accountSource == "TEMPLATE" && !argvc.accountSourceCount) {
        return "--account-source FILE requires --account-source-count";
      }

      if (argvc.generateFixedSize && !argvc.userCount) {
        return "--generate-fixed-size requires --user-count";
      }
      if (argvc.generateFixedSize && !argvc.fileSize) {
        return "--generate-fixed-size requires --file-size";
      }
      if (argvc.generateFixedSize && !argvc.fileCount) {
        return "--generate-fixed-size requires --file-count";
      }
      if (argvc.generateFromDir && !argvc.dir) {
        return "--generate-from-dir requires --dir";
      }
      if (argvc.generateRdf && !argvc.baseRdfFile) {
        return "--generate-rdf requires --base-rdf-file";
      }
      if (
        !argvc.generateFromDir &&
        !argvc.generateVariableSize &&
        !argvc.generateRdf &&
        !argvc.generateFixedSize
      ) {
        return "select at least one --generate-xxx option";
      }
      return true;
    })
    .wrap(120)
    .strict(true);
  // ya = ya.wrap(ya.terminalWidth());
  const argv = ya.parseSync();
  const accountAction =
    argv.accounts == "USE_EXISTING"
      ? AccountAction.UseExisting
      : argv.accounts == "CREATE"
      ? AccountAction.Create
      : argv.accounts == "AUTO"
      ? AccountAction.Auto
      : null;
  const accountSource =
    argv.accountSource == "TEMPLATE"
      ? AccountSource.Template
      : argv.accountSource == "FILE"
      ? AccountSource.File
      : null;
  if (accountAction === null) {
    //this should not happen
    throw new Error(`--accounts ${argv.accountAction} is invalid`);
  }
  if (accountSource === null) {
    //this should not happen
    throw new Error(`--account-source ${argv.accountSource} is invalid`);
  }

  return {
    verbosity_count: argv.v,
    cssBaseUrl: argv.url.map((u) => (u.endsWith("/") ? u : u + "/")),

    // generateUsers: argv.generateUsers,
    // userCount: argv.userCount || 1,

    accountAction,
    accountSource,
    accountSourceCount: argv.accountSourceCount || 1,
    accountSourceFile: argv.accountSourceFile,
    accountSourceTemplateUsername: argv.accountTemplateUsername,
    accountSourceTemplatePass: argv.accountTemplatePassword,

    fileSize: argv.fileSize || 10,
    fileCount: argv.fileCount || 1,
    addAclFiles: argv.addAclFiles,
    addAcrFiles: argv.addAcrFiles,
    userJsonOut: argv.userJsonOut,
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
