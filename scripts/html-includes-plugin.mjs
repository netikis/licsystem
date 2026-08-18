/**
 * Expande <!-- @include caminho/relativo.html --> no index.html
 * (dev + build). Caminhos relativos à raiz do projeto.
 */
import fs from "fs";
import path from "path";

const INCLUDE_RE = /<!--\s*@include\s+([^\s>]+)\s*-->/g;

function expandIncludes(html, root, seen = new Set()) {
  return html.replace(INCLUDE_RE, (_m, rel) => {
    const file = path.resolve(root, rel.trim());
    if (seen.has(file)) {
      throw new Error(`Include circular: ${rel}`);
    }
    if (!fs.existsSync(file)) {
      throw new Error(`Include não encontrado: ${rel}`);
    }
    seen.add(file);
    const raw = fs.readFileSync(file, "utf8");
    const expanded = expandIncludes(raw, root, seen);
    seen.delete(file);
    return expanded;
  });
}

export function htmlIncludesPlugin() {
  return {
    name: "licsystem-html-includes",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const root = path.resolve(".");
        return expandIncludes(html, root);
      },
    },
  };
}
