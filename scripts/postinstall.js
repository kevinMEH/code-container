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
  fs.writeFileSync(
    FLAGS_PATH,
    "# Add custom Docker flags here (one per line)\n# Note: These flags are passed to every created container and every exec session.\n# Use DOCKER_RUN_FLAGS.txt for flags that only apply to 'docker run'.\n",
  );
}

if (!fs.existsSync(RUN_FLAGS_PATH)) {
  fs.writeFileSync(
    RUN_FLAGS_PATH,
    "# Add Docker run-only flags here (one per line)\n# Note: These flags are only passed to 'docker run', not 'docker exec'.\n# Use this for flags like -v, --network, --restart that are not valid for exec.\n",
  );
}

// --- Migration: Remove stale core mounts from MOUNTS.txt ---
// Prior to v2.2.0, `container init` wrote core mounts directly into MOUNTS.txt.
// Core mounts are now applied in-memory at runtime (see getCoreMounts() in mounts.ts).
// Old entries in MOUNTS.txt can conflict with updated core mounts (e.g. the old
// /root/.local mount shadows the new /root/.local/share and /root/.local/state mounts).
// This block removes those stale entries on upgrade.
const MOUNTS_PATH = path.join(APPDATA_DIR, "MOUNTS.txt");
const STALE_CONTAINER_PATHS = [
  "/root/.claude",
  "/root/.claude.json",
  "/root/.codex",
  "/root/.copilot",
  "/root/.config/opencode",
  "/root/.gemini",
  "/root/.local",
  "/root/.gitconfig",
];

if (fs.existsSync(MOUNTS_PATH)) {
  const content = fs.readFileSync(MOUNTS_PATH, "utf-8");
  const lines = content.split("\n");
  const cleaned = lines.filter((line) => {
    // Filter out all lines with target location in STALE_CONTAINER_PATHS
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    const parts = trimmed.split(":");
    const containerPath = parts.length >= 2 ? parts[1] : null;
    return (
      containerPath === null || !STALE_CONTAINER_PATHS.includes(containerPath)
    );
  });
  const cleanedContent = cleaned.join("\n");
  if (cleanedContent !== content) {
    fs.writeFileSync(MOUNTS_PATH, cleanedContent, { mode: 0o600 });
    console.log("Note: Removed outdated core mounts from MOUNTS.txt");
  }
}
// --- End Migration ---
