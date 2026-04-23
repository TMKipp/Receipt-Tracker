import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  outputFileTracingRoot: currentDir,
};

export default nextConfig;
