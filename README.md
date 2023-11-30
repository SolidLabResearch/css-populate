# CSS Populate
This tool is now part of: https://github.com/SolidLabResearch/solid-perftest-tools

Use the new repo instead of this one. This repo is only left for archival purposes.

---

Tool to populate the Community Solid Server with dummy accounts and data, for testing purposes.

Install:

```
npm install
npm run build
npm link
css-populate --help
```

Help:

```
$ css-populate --help
Usage: css-populate --url <url> --generate-xxx --generate-yyy ...

CSS Server:
  -u, --url         Base URL of the CSS                                                              [string] [required]
      --user-count  Number of users/pods to generate/populate                                        [number] [required]

Generate users:
      --generate-users  Generate users. If not specified, it is assumed users have already been generated.
                                                                                              [boolean] [default: false]

Generate Variable Size Content:
      --generate-variable-size  Generate 7 files with random data of increasing size: 10.rnd, ...  10_000_000.rnd
                                                                                              [boolean] [default: false]

Generate Fixed Size Content:
      --generate-fixed-size  Generate a configurable number of files of configurable fixed size
                                                                                              [boolean] [default: false]
      --file-count           Number of files to generate                                           [number] [default: 0]
      --file-size            Size of files to generate                                             [number] [default: 0]

Use content from a directory:
      --generate-from-dir  Populate with existing content read from a specified directory     [boolean] [default: false]
      --dir                Dir with the generated data                                                          [string]

Options:
      --version  Show version number                                                                           [boolean]
      --help     Show help                                                                                     [boolean]
```

# Data for --source 'generate'

When `--source 'generate'` is specified, `--count` is required to specify the number of users to generate.
For each generated user, a pod is generated and filled with dummy files containing random data, with various sizes ranges from 10 byte to 10MB.


# Data for --source 'dir'

For `--source 'dir'`, the `--dir` option requires a "dir with the generated data". 
This dir is generated with [ldbc-snb-decentralized](https://github.com/rubensworks/ldbc-snb-decentralized.js):

```
git clone https://github.com/rubensworks/ldbc-snb-decentralized.js.git
cd ldbc-snb-decentralized.js
npm install
docker pull rubensworks/ldbc_snb_datagen:latest
bin/ldbc-snb-decentralized generate --scale 0.1 --overwrite --fragmentConfig config-posts-to-person.json
```

(`config-posts-to-person.json` can be found in this repo)

# Credits

Partially based on example code from Ruben Dedecker

Generated data by [ldbc-snb-decentralized](https://github.com/rubensworks/ldbc-snb-decentralized.js) by Ruben Taelman

# License

This code is copyrighted by [Ghent University – imec](http://idlab.ugent.be/) and released under the [MIT license](http://opensource.org/licenses/MIT).
