import type { Plugin } from "esbuild";
import { build } from "esbuild";

const MINIFY = true;

type ExternalPluginFactory = (external: string[]) => Plugin;
const externalCjsToEsmPlugin: ExternalPluginFactory = (external) => ({
  name: "external",
  setup(builder): void {
    const escape = (text: string): string =>
      `^${text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`;
    const filter = new RegExp(external.map(escape).join("|"));
    builder.onResolve({ filter: /.*/, namespace: "external" }, (args) => ({
      path: args.path,
      external: true,
    }));
    builder.onResolve({ filter }, (args) => ({
      path: args.path,
      namespace: "external",
    }));
    builder.onLoad({ filter: /.*/, namespace: "external" }, (args) => ({
      contents: `export * from ${JSON.stringify(args.path)}`,
    }));
  },
});

/** Adds support for require, __filename, and __dirname to ESM / Node. */
const esmNodeSupportBanner = {
  js: `import { fileURLToPath } from 'url';
import { createRequire as topLevelCreateRequire } from 'module';
import _nPath from 'path'
const require = topLevelCreateRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = _nPath.dirname(__filename);`,
};

const edgeSupportBanner = {
  js: `if (globalThis.performance === undefined) {
    const timeOrigin = Date.now() - 1;
    globalThis.performance = { timeOrigin: timeOrigin, now: () => Date.now() - timeOrigin };
  }`,
};

const peerDependencies = ["@opentelemetry/api", "@opentelemetry/api-logs"];

async function buildAll(): Promise<void> {
  await Promise.all([
    build({
      platform: "node",
      format: "esm",
      splitting: true,
      entryPoints: ["src/index.ts"],
      outdir: "dist/node",
      bundle: true,
      minify: MINIFY,
      sourcemap: true,
      banner: esmNodeSupportBanner,
      external: ["@opentelemetry/api"],
      plugins: [externalCjsToEsmPlugin(peerDependencies)],
    }),
    build({
      target: "esnext",
      format: "esm",
      splitting: false,
      entryPoints: ["src/index.ts"],
      outdir: "dist/edge",
      bundle: true,
      minify: MINIFY,
      sourcemap: true,
      banner: edgeSupportBanner,
      external: ["@opentelemetry/api"],
      plugins: [
        externalCjsToEsmPlugin(["async_hooks", "events", ...peerDependencies]),
      ],
    }),
  ]);
}

void buildAll();