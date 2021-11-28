#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const prompts = require("prompts");
const levelup = require("levelup");
const leveldown = require("leveldown");
const encode = require("encoding-down");
const Table = require("cli-table3");

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
  .command("list [options]", "List records", (yargs) => {
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
        alias: "k",
        description: "List keys only",
        conflicts: ["only-values"],
      })
      .option("only-values", {
        alias: "v",
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
  const [cmd] = argv._;
  const dbPath = argv.db || ".";
  const exist = fs.existsSync(path.resolve(dbPath, "CURRENT"));
  const initdb = () => {
    return new Promise((resolve, reject) => {
      levelup(
        encode(leveldown(dbPath), { valueEncoding: argv.encoding }),
        (err, db) => {
          if (err) {
            return reject(new Error(`db throws ${err.message}`));
          }
          resolve(db);
        }
      );
    });
  };
  let db;
  if (exist) {
    db = await initdb();
  } else {
    if (["set", "put"].includes(cmd)) {
      const { create } = await prompts({
        type: "confirm",
        name: "create",
        message: "Level db not exist, create?",
        initial: true,
      });
      if (!create) return;
      db = await initdb();
    } else {
      throw new Error("db not exist");
    }
  }
  const cmds = {
    async get(key) {
      try {
        const value = await db.get(key);
        console.log(serialValue(value));
      } catch (err) {
        throw new Error(`key not found`);
      }
    },
    async put(key, value) {
      try {
        await db.put(key, value);
      } catch (err) {
        throw new Error(`set value throws ${err.message}`);
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
            throw new Error(`key not found`);
          }
          const batch = db.batch();
          keys.forEach((key) => batch.del(key));
          await batch.write();
        } else {
          await db.del(key);
        }
      } catch (err) {
        throw new Error(`delete value throws ${err.message}`);
      }
    },
    async list({ onlyKeys, onlyValues, reverse, pattern, limit, offset, all }) {
      let records = [];
      let index = 0;
      const addRecord = (key, value) => {
        if (index < offset) return;
        value = serialValue(value);
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
        const table = new Table();
        table.push(...records);
        console.log(table.toString());
      }
    }
  } else {
    throw new Error("unknown cmd");
  }
}

function parsePattern(key) {
  try {
    return new RegExp(key);
  } catch {
    throw new Error(`invalid pattern`);
  }
}

function serialValue(value) {
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

main().catch((err) => {
  console.log(err.message);
  process.exit(1);
});
