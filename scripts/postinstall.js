#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const APPDATA_DIR = path.join(os.homedir(), ".code-container");
const CONFIGS_DIR = path.join(APPDATA_DIR, "configs");
const DOCKERFILE_PATH = path.join(APPDATA_DIR, "Dockerfile");
const MOUNTS_PATH = path.join(APPDATA_DIR, "MOUNTS.txt");
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

if (!fs.existsSync(MOUNTS_PATH)) {
  const home = os.homedir();

  const defaultMounts = [
    `${CONFIGS_DIR}/.claude:/root/.claude`,
    `${CONFIGS_DIR}/.claude.json:/root/.claude.json`,
    `${CONFIGS_DIR}/.codex:/root/.codex`,
    `${CONFIGS_DIR}/.opencode:/root/.config/opencode`,
    `${CONFIGS_DIR}/.gemini:/root/.gemini`,
    `${CONFIGS_DIR}/.local:/root/.local`,
    `${home}/.gitconfig:/root/.gitconfig:ro`,
    `${home}/.ssh:/root/.ssh:ro`,
  ];

  fs.writeFileSync(MOUNTS_PATH, defaultMounts.join("\n") + "\n", {
    mode: 0o600,
  });
}