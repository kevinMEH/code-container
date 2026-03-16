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
    tree

# Use existing ubuntu user (UID 1000)
USER ubuntu
WORKDIR /home/ubuntu

# Install mise (modern runtime manager)
RUN curl -fsSL https://mise.run | bash
ENV PATH="/home/ubuntu/.local/share/mise/shims:/home/ubuntu/.local/bin:${PATH}"

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
RUN echo 'PS1="\[\033[01;32m\][code-container]\[\033[00m\] \[\033[01;34m\]\w\[\033[00m\]\$ "' >> /home/ubuntu/.bashrc

# Source mise in bashrc for interactive shells
RUN echo 'eval "$(mise activate bash)"' >> /home/ubuntu/.bashrc && \
    echo 'mise trust -a 2>/dev/null' >> /home/ubuntu/.bashrc && \
    echo 'mise up 2>/dev/null' >> /home/ubuntu/.bashrc

# Default command: bash shell
CMD ["/bin/bash"]
