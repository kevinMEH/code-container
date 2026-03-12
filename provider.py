#!/usr/bin/env python3

import json
import sys
import os
from typing import Literal

PROVIDERS_FILE = os.path.expanduser("~/.providers/providers.json")
SETTINGS_FILE = os.path.expanduser("~/.claude/settings.json")

COLORS = {
    "red": "\033[0;31m",
    "green": "\033[0;32m",
    "yellow": "\033[1;33m",
    "blue": "\033[0;34m",
    "nc": "\033[0m",
}


def print_msg(level: Literal["INFO", "SUCCESS", "ERROR"], msg):
    colors = {
        "INFO": COLORS["blue"],
        "SUCCESS": COLORS["green"],
        "ERROR": COLORS["red"],
    }
    print(f"{colors.get(level, '')}[{level}]{COLORS['nc']} {msg}")


def load_providers():
    if not os.path.exists(PROVIDERS_FILE):
        os.makedirs(os.path.dirname(PROVIDERS_FILE), exist_ok=True)
        with open(PROVIDERS_FILE, "w") as f:
            json.dump({}, f)
        os.chmod(PROVIDERS_FILE, 0o600)
        return {}
    with open(PROVIDERS_FILE) as f:
        return json.load(f)


def save_providers(data):
    with open(PROVIDERS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def cmd_add():
    providers = load_providers()
    provider_id = input("Provider ID: ").strip()
    if not provider_id:
        print_msg("ERROR", "Provider ID cannot be empty")
        sys.exit(1)
    if provider_id in providers:
        print_msg("ERROR", f"Provider '{provider_id}' already exists")
        sys.exit(1)
    api_key = input("API Key: ").strip()
    base_url = input("Base URL: ").strip()
    providers[provider_id] = {"api_key": api_key, "base_url": base_url}
    save_providers(providers)
    print_msg("SUCCESS", f"Provider '{provider_id}' added")


def cmd_list():
    providers = load_providers()
    print(f"Configured Providers:\n")
    if not providers:
        print("  No providers configured")
        return
    for pid, p in providers.items():
        print(f"  ID: {pid}")
        print(f"    Base URL: {p['base_url']}")
        print(f"    API Key: {p['api_key']}\n")


def cmd_update(provider_id):
    if not provider_id:
        print_msg("ERROR", "Provider ID required")
        sys.exit(1)
    providers = load_providers()
    p = providers.get(provider_id)
    if not p:
        print_msg("ERROR", f"Provider '{provider_id}' not found")
        sys.exit(1)
    print(f"Update Provider: {provider_id}\n")
    print(f"Current API Key: {COLORS['yellow']}{p['api_key']}{COLORS['nc']}")
    print(f"Current Base URL: {COLORS['yellow']}{p['base_url']}{COLORS['nc']}\n")
    new_key = input("New API Key (Enter to keep): ").strip()
    new_url = input("New Base URL (Enter to keep): ").strip()
    p["api_key"] = new_key or p["api_key"]
    p["base_url"] = new_url or p["base_url"]
    save_providers(providers)
    print_msg("SUCCESS", f"Provider '{provider_id}' updated")


def cmd_remove(provider_id):
    if not provider_id:
        print_msg("ERROR", "Provider ID required")
        sys.exit(1)
    providers = load_providers()
    if provider_id not in providers:
        print_msg("ERROR", f"Provider '{provider_id}' not found")
        sys.exit(1)
    del providers[provider_id]
    save_providers(providers)
    print_msg("SUCCESS", f"Provider '{provider_id}' removed")


def cmd_swap(provider_id):
    if not provider_id:
        print_msg("ERROR", "Provider ID required")
        sys.exit(1)
    providers = load_providers()
    p = providers.get(provider_id)
    if not p:
        print_msg("ERROR", f"Provider '{provider_id}' not found")
        sys.exit(1)
    if not os.path.exists(SETTINGS_FILE):
        print_msg("ERROR", f"Settings file not found: {SETTINGS_FILE}")
        sys.exit(1)
    with open(SETTINGS_FILE) as f:
        settings = json.load(f)
    settings.setdefault("env", {})
    settings["env"]["ANTHROPIC_AUTH_TOKEN"] = p["api_key"]
    settings["env"]["ANTHROPIC_BASE_URL"] = p["base_url"]
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)
    print_msg("SUCCESS", f"Swapped to provider '{provider_id}'")


def usage():
    print(
        """Usage: provider <command> [provider_id]

Commands:
    add             Add a new provider
    update <id>     Update a provider
    remove <id>     Remove a provider
    swap <id>       Set provider as active in Claude settings
    list            List all providers
"""
    )
    sys.exit(0)


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ["-h", "--help"]:
        usage()
    cmd = sys.argv[1]
    arg = sys.argv[2] if len(sys.argv) > 2 else None
    {
        "add": lambda: cmd_add(),
        "list": lambda: cmd_list(),
        "update": lambda: cmd_update(arg),
        "remove": lambda: cmd_remove(arg),
        "swap": lambda: cmd_swap(arg),
    }.get(cmd, usage)()


if __name__ == "__main__":
    main()
