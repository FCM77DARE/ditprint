import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // Testes que sobem o servidor em porta efêmera passam de 10 s com a máquina carregada.
    hookTimeout: 30000,
    testTimeout: 30000,
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "client/src/lib/**/*.test.ts"],
  },
});
