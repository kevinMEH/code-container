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

const SECURITY_ADVISORY = `
\x1b[33m⚠️  Security Advisory:\x1b[0m

The main purpose of Code Container is to protect commands like 'rm' or 'apt'
from unintentionally affecting your main system.
- container assumes that your agent is acting in good faith.

container does not protect from prompt injections or network exfiltration in
the event that an agent becomes malaligned.

This is an innate problem within coding harness software and container does
not attempt to solve it.
- Users are advised to not download or work with unverified software
  even within the container.
- Sensitive information inside the container may still be exfiltrated by
  an attacker just as with your regular system.
  - This includes:
  - OAuth credentials inside harness configs
  - API keys inside harness configs
  - SSH keys for git functionality if enabled

Never install or run your harness on unverified software. By using Code
Container, you agree that you are aware of these risks and will not hold the
author liable for any outcomes arising from usage of the software.
`;

console.log(SECURITY_ADVISORY);