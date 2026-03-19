# Code Container
# Generic Dockerfile for running coding tools in isolated project environments

FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Set timezone to America/New_York (EST)
ENV TZ=America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install system dependencies and common build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    unzip \
    ca-certificates \
    libssl-dev \
    zlib1g-dev \
    libffi-dev \
    vim \
    tree \
    gnupg

# Install 1Password CLI and desktop app (for SSH signing with op-ssh-sign)
RUN curl -sS https://downloads.1password.com/linux/keys/1password.asc | \
    gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | \
    tee /etc/apt/sources.list.d/1password.list && \
    apt-get update && apt-get install -y 1password 1password-cli && \
    rm -rf /var/lib/apt/lists/*

# Accept build-time username (defaults to ubuntu)
ARG USERNAME=ubuntu

# Rename ubuntu user and move home to /container/$USERNAME
RUN mkdir -p /container && \
    usermod -l ${USERNAME} ubuntu && \
    groupmod -n ${USERNAME} ubuntu && \
    usermod -d /container/${USERNAME} -m ${USERNAME}

USER ${USERNAME}
WORKDIR /container/${USERNAME}

# Install mise (modern runtime manager)
RUN curl -fsSL https://mise.run | bash
ENV PATH="/container/${USERNAME}/.local/share/mise/shims:/container/${USERNAME}/.local/bin:${PATH}"

# Configure mise tools
RUN mise settings set experimental true && \
    mise use -g \
        node@22 \
        pnpm@latest \
        python@latest \
        fd \
        ripgrep \
        "github:steveyegge/beads@latest" \
        "github:steveyegge/gastown@latest" \
        npm:opencode-ai \
        npm:@openai/codex \
        npm:@google/gemini-cli && \
    mise install && \
    mise trust ~/.config/mise/config.toml

# Install Claude Code globally via official installer
RUN curl -fsSL https://claude.ai/install.sh | bash

# Configure bash prompt to show container name
RUN echo 'PS1="\[\033[01;32m\][code-container]\[\033[00m\] \[\033[01;34m\]\w\[\033[00m\]\$ "' >> /container/${USERNAME}/.bashrc

# Source mise in bashrc for interactive shells
RUN echo 'eval "$(mise activate bash)"' >> /container/${USERNAME}/.bashrc && \
    echo 'mise trust -a 2>/dev/null' >> /container/${USERNAME}/.bashrc && \
    echo 'mise up 2>/dev/null' >> /container/${USERNAME}/.bashrc

# Default command: bash shell
CMD ["/bin/bash"]
