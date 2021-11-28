#!/usr/bin/env node

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const levelup = require("levelup");
const leveldown = require("leveldown");
const encode = require("encoding-down");
const parseRegex = require("regex-parser");
const Table = require("cli-table");

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [cmd] [options]")
  .command("get <key>", "Get value", (yargs) => {})
  .command(
    ["put <key> <value>", "set <key> <value>"],
    "Set value",
    (yargs) => {}
  )
  .command("del <key>", "Delete value", (yargs) => {
    return yargs.option("pattern", {
      alias: "p",
      type: "boolean",
      description: "Delete records by pattern",
    });
  })
  .command("list [options]", "Delete value", (yargs) => {
    return yargs
      .option("all", {
        alias: "a",
        type: "boolean",
        description: "List all the keys and values",
        conflicts: ["limit"],
      })
      .option("pattern", {
        alias: "p",
        type: "string",
        description: "Search records by pattern",
      })
      .option("limit", {
        type: "number",
        description: "List number of records",
        default: 100,
        conflicts: ["all"],
      })
      .option("offset", {
        type: "number",
        description: "Skip number of records",
        default: 0,
      })
      .option("reverse", {
        type: "boolean",
        description: "Reverse records",
      })
      .option("json", {
        type: "boolean",
        description: "Print records in json format",
      })
      .option("only-keys", {
        type: "boolean",
        description: "List keys only",
        conflicts: ["only-values"],
      })
      .option("only-values", {
        type: "boolean",
        description: "List values only",
        conflicts: ["only-keys"],
      });
  })
  .help("help")
  .alias("help", "h")
  .option("encoding", {
    alias: "e",
    type: "string",
    default: "json",
    description: "Specify the encoding for the values",
  })
  .option("db", {
    alias: "d",
    description: "Specify the path to the LevelDB to use",
  })
  .demandCommand(1)
  .parse();

async function main() {
  const db = levelup(
    encode(leveldown(argv.db || "."), { valueEncoding: argv.encoding })
  );
  const cmds = {
    async get(key) {
      try {
        const data = await db.get(key);
        if (typeof data === "string") {
          console.log(data);
        } else {
          console.log(JSON.stringify(data));
        }
      } catch (err) {
        return fatal(`not found`);
      }
    },
    async put(key, value) {
      try {
        await db.put(key, value);
      } catch (err) {
        return fatal(`set value throw ${err.message}`);
      }
    },
    async del(key, pattern) {
      try {
        if (pattern) {
          const keys = await this.list({
            pattern: parsePattern(key),
            onlyKeys: true,
            all: true,
          });
          if (keys.length === 0) {
            return fatal(`not found`);
          }
          const batch = db.batch();
          keys.forEach((key) => batch.del(key));
          await batch.write();
        } else {
          await db.del(key);
        }
      } catch (err) {
        return fatal(`delete value throw ${err.message}`);
      }
    },
    async list({ onlyKeys, onlyValues, reverse, pattern, limit, offset, all }) {
      let records = [];
      let index = 0;
      const addRecord = (key, value) => {
        if (index < offset) return;
        if (onlyKeys) {
          records.push(key);
        } else if (onlyValues) {
          records.push(value);
        } else {
          records.push([key, value]);
        }
      };
      for await (const [key, value] of db.iterator({ values: !onlyKeys })) {
        if (!all && records.length >= limit) break;
        if (pattern) {
          if (pattern.test(key)) {
            addRecord(key, value);
          }
        } else {
          addRecord(key, value);
        }
        index++;
      }
      if (reverse) records.reverse();
      return records;
    },
  };
  const [cmd] = argv._;
  if (cmd === "get") {
    await cmds.get(argv.key);
  } else if (cmd === "put" || cmd === "set") {
    await cmds.put(argv.key, argv.value);
  } else if (cmd === "del") {
    await cmds.del(argv.key, argv.pattern);
  } else if (cmd === "list") {
    if (argv.pattern) argv.pattern = parsePattern(argv.pattern);
    const records = await cmds.list(argv);
    if (argv["only-keys"] || argv["only-values"]) {
      records.forEach((key) => console.log(key));
    } else {
      if (argv.json) {
        console.log(JSON.stringify(records));
      } else {
        const table = new Table({
          rows: records,
        });
        console.log(table.toString());
      }
    }
  } else {
    return fatal("unknown cmd");
  }
}

function fatal(msg) {
  console.log(msg);
  process.exit(1);
}

function parsePattern(key) {
  try {
    return parseRegex(key);
  } catch {
    return fatal(`invalid pattern`);
  }
}

main();
