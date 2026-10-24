import fs from "node:fs";
import path from "node:path";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type Plugin } from "vite";

// `srv/` is the catalog used while developing: the very same directory layout
// the VPS serves under `/catalog/` (caddy et al.). It is NOT part of the
// build — production serves its own catalog next to `dist/` — so instead of
// `public/` it is mounted by hand, dev server only.
const CATALOG_DIR = "srv/catalog";

function devCatalog(): Plugin {
  return {
    name: "dev-catalog",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/catalog", (request, response, next) => {
        const url = decodeURIComponent((request.url ?? "/").split("?")[0]);
        // No directory listing and no escaping the catalog directory.
        const file = path.resolve(
          import.meta.dirname,
          CATALOG_DIR,
          "." + path.posix.normalize(url),
        );
        if (!file.startsWith(path.resolve(import.meta.dirname, CATALOG_DIR))) return next();
        fs.readFile(file, (error, data) => {
          if (error) {
            response.statusCode = 404;
            response.end("not found");
            return;
          }
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          // The app revalidates with `cache: "no-cache"`; keep the dev server
          // from answering from a stale memory cache on top of that.
          response.setHeader("Cache-Control", "no-cache");
          response.end(data);
        });
      });
    },
  };
}

// Share links open on `/s/#…` (`shareUrl`): `dist/s/index.html` is the built
// page with the "timetable shared" link preview card instead of the main one.
// The state stays in the fragment, which no crawler sees, so this card is as
// specific as a static file can get. Replaces the `index.html` tags by name;
// the build fails if one of them goes missing.
const SHARE_CARD: Record<string, string> = {
  "og:title": "Stundenplan geteilt · Zeiteisen",
  "og:description": "Öffnen, um die Gruppen anzusehen",
  "og:image:alt": "Zeiteisen: ein geteilter Stundenplan",
  description: "Öffnen, um die Gruppen anzusehen",
};

function shareCard(): Plugin {
  let site = "";
  return {
    name: "og-share",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      site = config.env.VITE_SITE_URL ?? "";
      if (!site) config.logger.warn("VITE_SITE_URL is empty: link previews get no image.");
    },
    generateBundle(_, bundle) {
      const page = bundle["index.html"];
      if (page?.type !== "asset") return this.error("og-share: no index.html in the bundle");
      let html = String(page.source);
      const swaps = {
        ...SHARE_CARD,
        "og:url": `${site}/s/`,
        "og:image": `${site}/og-share.png`,
      };
      for (const [key, content] of Object.entries(swaps)) {
        const tag = new RegExp(`(<meta\\s+(?:property|name)="${key}"\\s+content=")[^"]*(")`);
        if (!tag.test(html)) return this.error(`og-share: no <meta ${key}> in index.html`);
        html = html.replace(tag, (_, open: string, close: string) => open + content + close);
      }
      this.emitFile({ type: "asset", fileName: "s/index.html", source: html });
    },
  };
}

// Shown next to the name (`Brand`), so a bug report tells which deploy the
// user's service worker serves. Bump `version` in `package.json` per release.
const APP_VERSION: string = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"),
).version;

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    devCatalog(),
    shareCard(),
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./generated/paraglide",
      // The app is TypeScript only: the compiler still writes JSDoc-typed
      // `.js`, so it has to ship `.d.ts` next to it. `allowJs` is off.
      emitTsDeclarations: true,
      // Client-only app: no server, no locale in the URL.
      strategy: ["localStorage", "preferredLanguage", "baseLocale"],
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      // The manifest's icons would be precached regardless of `globIgnores`
      // below; they are read at install time only (`logo.svg` still comes
      // along through `globPatterns`).
      includeManifestIcons: false,
      workbox: {
        // Launch timings for the Debug info (`public/sw-launch.js`).
        importScripts: ["sw-launch.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,zip}"],
        // Geist's other scripts: German and English never hit their
        // `unicode-range`, so the browser never asks for them either.
        // The link preview cards are for crawlers only, never shown in the app;
        // the app icons are read when the app is installed (online), never by
        // the app itself.
        globIgnores: [
          "**/geist-{cyrillic,cyrillic-ext,vietnamese}-*.woff2",
          "**/geist-mono-{cyrillic,cyrillic-ext,vietnamese,symbols2}-*.woff2",
          "og.png",
          // Kept by the service worker itself, as its imported script.
          "sw-launch.js",
          "og-share.png",
          "apple-touch-icon.png",
          "icon-*.png",
        ],
        // The catalog is served next to the app but is not part of the build,
        // so it cannot be precached. Network first keeps it fresh online and
        // still answers offline from the last response. The app also keeps its
        // own copy in `tt.catalog.v1`, so this is only a second line. A network
        // that has not answered after 5 s (a dead Wi-Fi, a captive portal)
        // gets the cached copy instead; without one, the worker keeps waiting
        // for the network, up to the app's own timeout (`FETCH_TIMEOUT_MS`).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/catalog/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "catalog",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Zeiteisen",
        short_name: "Zeiteisen",
        description: "Personal university timetable builder.",
        theme_color: "#08060d",
        // Splash color: shadcn light --primary oklch(0.505 0.213 27.518) as hex.
        background_color: "#c10007",
        display: "standalone",
        start_url: "/",
        // The SVG for browsers that take one; PNGs for Android browsers that
        // do not; a full-bleed maskable one, or Android shrinks the icon onto
        // a white plate. iOS ignores these (`apple-touch-icon` in
        // `index.html`). All rendered by `scripts/app-icons.mjs`.
        icons: [
          { src: "logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // React is split off the app chunk: it changes only on a version
        // bump, so a deploy of the app alone leaves it in the browser cache.
        // Every other dependency is left to rolldown on purpose, which puts it
        // next to its only user: `ics` (and yup with it) in the export chunk,
        // `react-day-picker` in the calendar, base-ui dialogs and sonner in
        // `components/deferred`. A catch-all `vendor` group would pull all of
        // that back into the first load. Every chunk still lands in `dist/`
        // and is precached by the service worker above, so offline is the same.
        codeSplitting: {
          groups: [{ name: "react", test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/ }],
        },
      },
    },
  },
  // Found late otherwise (lazy `import()`s): the dep optimizer then re-bundles
  // on first use, logs missing-chunk errors and reloads the page twice.
  optimizeDeps: {
    include: ["zod/mini", "zod/locales"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Generated message code lives outside `src/`; `src/i18n.ts` is the only
      // file that imports it.
      "@paraglide": path.resolve(import.meta.dirname, "./generated/paraglide"),
    },
  },
});
