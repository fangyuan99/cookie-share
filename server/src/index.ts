import { createApp } from "./app";
import { loadRuntimeConfig } from "./config";
import { createDatabase } from "./db";
import { CookieStore } from "./store";

function main(): void {
  const config = loadRuntimeConfig();
  const database = createDatabase(config);
  const store = new CookieStore(database);
  const app = createApp(config, store);

  app.listen(config.port, config.host, () => {
    console.log(`Cookie-share server listening on http://${config.host}:${config.port}${config.basePath}`);
  });
}

main();
