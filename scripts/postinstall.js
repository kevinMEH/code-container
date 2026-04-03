#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const APPDATA_DIR = path.join(os.homedir(), ".code-container");
const CONFIGS_DIR = path.join(APPDATA_DIR, "configs");
const USER_DOCKERFILE_PATH = path.join(APPDATA_DIR, "Dockerfile.User");
const PACKAGED_USER_DOCKERFILE = path.join(__dirname, "..", "Dockerfile.User");
const FLAGS_PATH = path.join(APPDATA_DIR, "DOCKER_FLAGS.txt");
const RUN_FLAGS_PATH = path.join(APPDATA_DIR, "DOCKER_RUN_FLAGS.txt");

if (!fs.existsSync(APPDATA_DIR)) {
  fs.mkdirSync(APPDATA_DIR, { recursive: true, mode: 0o700 });
}

if (!fs.existsSync(CONFIGS_DIR)) {
  fs.mkdirSync(CONFIGS_DIR, { recursive: true, mode: 0o700 });
}

if (!fs.existsSync(USER_DOCKERFILE_PATH)) {
  fs.copyFileSync(PACKAGED_USER_DOCKERFILE, USER_DOCKERFILE_PATH);
}

if (!fs.existsSync(FLAGS_PATH)) {
  fs.writeFileSync(FLAGS_PATH, "# Add custom Docker flags here (one per line)\n# Note: These flags are passed to every created container and every exec session.\n# Use DOCKER_RUN_FLAGS.txt for flags that only apply to 'docker run'.\n");
}

if (!fs.existsSync(RUN_FLAGS_PATH)) {
  fs.writeFileSync(RUN_FLAGS_PATH, "# Add Docker run-only flags here (one per line)\n# Note: These flags are only passed to 'docker run', not 'docker exec'.\n# Use this for flags like -v, --network, --restart that are not valid for exec.\n");
}
