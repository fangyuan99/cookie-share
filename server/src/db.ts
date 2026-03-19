import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { RuntimeConfig } from "./types";

const { DatabaseSync: NodeSqliteDatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");

export function createDatabase(config: RuntimeConfig): DatabaseSync {
  if (config.dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  }

  return new NodeSqliteDatabaseSync(config.dbPath);
}
