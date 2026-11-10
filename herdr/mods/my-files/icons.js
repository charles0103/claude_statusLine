const types = {
  md: "markdown", markdown: "markdown", py: "python",
  js: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", json: "json",
  toml: "config", yml: "config", yaml: "config", ini: "config", cfg: "config", conf: "config",
  ps1: "shell", psm1: "shell", sh: "shell", bash: "shell", bat: "shell", cmd: "shell",
  png: "image", jpg: "image", jpeg: "image", gif: "image", svg: "image", webp: "image", ico: "image",
  txt: "text", log: "text", html: "html", htm: "html", css: "css", scss: "css",
  zip: "archive", "7z": "archive", tar: "archive", gz: "archive"
};

export function fileIcon(filename) {
  if (typeof filename !== "string") return null;
  const name = filename.split(/[\\/]/).pop().toLowerCase();
  const type = [".gitignore", ".gitattributes", ".gitmodules"].includes(name) ? "git"
    : /^(license|copying)/.test(name) ? "license"
    : name.includes(".") ? types[name.split(".").pop()] : null;
  return type ? `mods/my-files/icons/${type}.svg` : null;
}
