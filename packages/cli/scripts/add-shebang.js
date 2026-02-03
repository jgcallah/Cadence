import { readFileSync, writeFileSync } from "fs";

const cliPath = "dist/cli.js";
const shebang = "#!/usr/bin/env node\n";

const content = readFileSync(cliPath, "utf8");

// Only add shebang if not already present
if (!content.startsWith("#!")) {
  writeFileSync(cliPath, shebang + content);
}
