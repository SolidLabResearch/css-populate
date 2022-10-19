# CSS Populate

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
Options:
      --version  Show version number                                   [boolean]
  -u, --url      Base URL of the CSS                         [string] [required]
  -d, --data     Data dir of the CSS                                    [string]
  -s, --source   Source of generated data
                                [string] [required] [choices: "dir", "generate"]
  -g, --dir      Dir with the generated data                            [string]
  -c, --count    Number of users/pods to generate                       [number]
      --help     Show help                                             [boolean]

```

# Create generated data

The "Dir with the generated data" can be generated with:

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

