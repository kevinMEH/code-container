#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const APPDATA_DIR = path.join(os.homedir(), ".code-container");
const CONFIGS_DIR = path.join(APPDATA_DIR, "configs");
const DOCKERFILE_PATH = path.join(APPDATA_DIR, "Dockerfile");
const PACKAGED_DOCKERFILE = path.join(__dirname, "..", "Dockerfile");

if (!fs.existsSync(APPDATA_DIR)) {
  fs.mkdirSync(APPDATA_DIR, { recursive: true, mode: 0o700 });
}

if (!fs.existsSync(CONFIGS_DIR)) {
  fs.mkdirSync(CONFIGS_DIR, { recursive: true, mode: 0o700 });
}

if (!fs.existsSync(DOCKERFILE_PATH)) {
  fs.copyFileSync(PACKAGED_DOCKERFILE, DOCKERFILE_PATH);
}