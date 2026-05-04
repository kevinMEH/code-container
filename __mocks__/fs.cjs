const { fs } = require("memfs");
const path = require("path");

fs.cpSync = function (src, dest, options) {
  if (options && options.recursive) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        fs.cpSync(path.join(src, entry), path.join(dest, entry), options);
      }
    } else {
      fs.writeFileSync(dest, fs.readFileSync(src));
    }
  } else {
    fs.writeFileSync(dest, fs.readFileSync(src));
  }
};

module.exports = fs;
