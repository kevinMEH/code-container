#!/bin/bash
# Egress firewall: whitelist permitted outbound destinations, block everything else.
# Closes the primary exfiltration vector identified in agentic AI security research.
#
# Usage: egress-firewall [extra-domain ...]
# Extra domains (e.g. Z.AI endpoint host) are appended to the whitelist.
# Re-applied at each container session start (iptables rules are in-memory).

set -uo pipefail

WHITELIST=(
    # Anthropic / Claude API
    api.anthropic.com
    statsig.anthropic.com

    # GitHub (git, gh CLI, release downloads, raw files)
    github.com
    api.github.com
    codeload.github.com
    objects.githubusercontent.com
    raw.githubusercontent.com
    uploads.github.com
    alive.github.com

    # npm registry
    registry.npmjs.org

    # Python packages
    pypi.org
    files.pythonhosted.org

    # mise tool manager
    mise.jdx.dev
)

# Append any extra domains passed as arguments (e.g. Z.AI API host)
for arg in "$@"; do
    [ -n "$arg" ] && WHITELIST+=("$arg")
done

# Flush existing OUTPUT rules and set default DROP policy
iptables -F OUTPUT
iptables -P OUTPUT DROP

# Always allow loopback
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established/related connections (responses to our requests)
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow DNS so tools can resolve names
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# Allow access to the host gateway (for connecting to local services on the host)
HOST_GW=$(ip route 2>/dev/null | awk '/default/ {print $3; exit}')
if [ -n "$HOST_GW" ]; then
    iptables -A OUTPUT -d "$HOST_GW" -j ACCEPT
fi

# Detect ip6tables availability
HAS_IP6TABLES=false
command -v ip6tables >/dev/null 2>&1 && ip6tables -L OUTPUT >/dev/null 2>&1 && HAS_IP6TABLES=true

if [ "$HAS_IP6TABLES" = "true" ]; then
    ip6tables -F OUTPUT
    ip6tables -P OUTPUT DROP
    ip6tables -A OUTPUT -o lo -j ACCEPT
    ip6tables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
    ip6tables -A OUTPUT -p udp --dport 53 -j ACCEPT
    ip6tables -A OUTPUT -p tcp --dport 53 -j ACCEPT
fi

# Resolve each whitelisted domain and allow its current IPs (IPv4 via iptables, IPv6 via ip6tables)
allowed_ips=0
failed=()
for domain in "${WHITELIST[@]}"; do
    ips=$(getent ahosts "$domain" 2>/dev/null | awk '{print $1}' | sort -u)
    if [ -z "$ips" ]; then
        failed+=("$domain")
        continue
    fi
    for ip in $ips; do
        if [[ "$ip" == *:* ]]; then
            # IPv6 address
            if [ "$HAS_IP6TABLES" = "true" ]; then
                ip6tables -A OUTPUT -d "$ip" -j ACCEPT
                allowed_ips=$((allowed_ips + 1))
            fi
        else
            # IPv4 address
            iptables -A OUTPUT -d "$ip" -j ACCEPT
            allowed_ips=$((allowed_ips + 1))
        fi
    done
done

# Mark this session so apply_firewall skips re-application while container is running
touch /run/egress-firewall-active

echo "[firewall] Egress active: $allowed_ips IPs across ${#WHITELIST[@]} domains"
[ ${#failed[@]} -gt 0 ] && echo "[firewall] Warning: could not resolve: ${failed[*]}"
exit 0
