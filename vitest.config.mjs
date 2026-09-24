import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          PATH_SECRET: "test-path-secret",
          ADMIN_PASSWORD: "test-admin-password",
          // Must match contract/vectors.json `secret` so the fixed envelope
          // fixture can be replayed against the live Worker.
          TRANSPORT_SECRET: "contract-transport-secret",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.js"],
  },
});
