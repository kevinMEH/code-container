import { fs } from "memfs";
import * as path from "path";

interface CopyOptions {
  recursive?: boolean;
}

fs.cpSync = function (
  src: string | URL,
  dest: string | URL,
  options?: CopyOptions,
): void {
  const srcPath = src.toString();
  const destPath = dest.toString();
  if (options && options.recursive) {
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      for (const entry of fs.readdirSync(srcPath)) {
        fs.cpSync(
          path.join(srcPath, entry),
          path.join(destPath, entry),
          options,
        );
      }
    } else {
      fs.writeFileSync(destPath, fs.readFileSync(srcPath));
    }
  } else {
    fs.writeFileSync(destPath, fs.readFileSync(srcPath));
  }
};

export default fs;
