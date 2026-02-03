import { readFileSync, writeFileSync } from "fs";

const serverPath = "dist/server.js";
const shebang = "#!/usr/bin/env node\n";

const content = readFileSync(serverPath, "utf8");

// Only add shebang if not already present
if (!content.startsWith("#!")) {
  writeFileSync(serverPath, shebang + content);
}
