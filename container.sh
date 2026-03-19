#!/bin/bash

# Code Container Manager
# Manages isolated containers (Podman/Docker) for running coding tools on different projects

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory (where Containerfile and shared volumes are)
SCRIPT_PATH="$0"
while [ -L "$SCRIPT_PATH" ]; do
    SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
IMAGE_NAME="code"
IMAGE_TAG="latest"
CONTAINER_HOME="/container/$USER"

# Detect container runtime (prefer podman)
if command -v podman >/dev/null 2>&1; then
    CONTAINER_RUNTIME="podman"
elif command -v docker >/dev/null 2>&1; then
    CONTAINER_RUNTIME="docker"
else
    echo -e "${RED}[ERROR]${NC} Neither podman nor docker is installed"
    exit 1
fi

# Container launch command; modify to add additional mounts
start_new_container() {
    local container_name="$1"
    local project_relpath="$2"
    local project_path="$3"

    # Build optional mounts conditionally
    local optional_args=""

    # 1Password SSH agent socket
    local op_agent="$HOME/.1password/agent.sock"
    if [ -S "$op_agent" ]; then
        optional_args="$optional_args -v $op_agent:$CONTAINER_HOME/.1password/agent.sock"
        optional_args="$optional_args -e SSH_AUTH_SOCK=$CONTAINER_HOME/.1password/agent.sock"
    fi

    # GPG agent SSH socket (for YubiKey SSH auth)
    local gpg_ssh_socket="/run/user/$(id -u)/gnupg/S.gpg-agent.ssh"
    if [ -S "$gpg_ssh_socket" ]; then
        optional_args="$optional_args -v $gpg_ssh_socket:$CONTAINER_HOME/.gnupg-sockets/S.gpg-agent.ssh"
        # Only set SSH_AUTH_SOCK if 1Password agent isn't already set
        if [ ! -S "$op_agent" ]; then
            optional_args="$optional_args -e SSH_AUTH_SOCK=$CONTAINER_HOME/.gnupg-sockets/S.gpg-agent.ssh"
        fi
    fi

    # GPG configuration (for YubiKey)
    if [ -d "$HOME/.gnupg" ]; then
        optional_args="$optional_args -v $HOME/.gnupg:$CONTAINER_HOME/.gnupg:ro"
    fi

    # YubiKey USB device passthrough (Yubico vendor ID: 1050)
    local yubikey_bus=$(lsusb 2>/dev/null | grep -i "yubico\|1050" | head -1 | awk '{print $2}')
    local yubikey_dev=$(lsusb 2>/dev/null | grep -i "yubico\|1050" | head -1 | awk '{print $4}' | tr -d ':')
    if [ -n "$yubikey_bus" ] && [ -n "$yubikey_dev" ]; then
        local yubikey_device="/dev/bus/usb/$yubikey_bus/$yubikey_dev"
        if [ -e "$yubikey_device" ]; then
            optional_args="$optional_args --device $yubikey_device"
        fi
    fi

    # Z.AI config for GLM models
    local zai_config="$HOME/.zai.json"
    if [ -f "$zai_config" ]; then
        optional_args="$optional_args -v $zai_config:$CONTAINER_HOME/.zai.json:ro"
    fi

    # Git config (XDG or legacy location)
    if [ -d "$HOME/.config/git" ]; then
        optional_args="$optional_args -v $HOME/.config/git:$CONTAINER_HOME/.config/git:ro"
    elif [ -f "$HOME/.gitconfig" ]; then
        optional_args="$optional_args -v $HOME/.gitconfig:$CONTAINER_HOME/.gitconfig:ro"
    fi

    # Host machine ID - makes Claude Code think it's running on the same machine (avoids re-auth)
    if [ -f /etc/machine-id ]; then
        optional_args="$optional_args -v /etc/machine-id:/etc/machine-id:ro"
    fi

    # Claude Code config - mount entire directory for full auth + config sharing
    mkdir -p "$HOME/.claude"
    local claude_configs="-v $HOME/.claude:$CONTAINER_HOME/.claude:rw"
    if [ -f "$HOME/.claude.json" ]; then
        claude_configs="$claude_configs -v $HOME/.claude.json:$CONTAINER_HOME/.claude.json:rw"
    fi

    $CONTAINER_RUNTIME run -d \
        --name "$container_name" \
        --userns=keep-id \
        --network host \
        -e TERM=xterm-256color \
        -w "$CONTAINER_HOME/$project_relpath" \
        -v "$project_path:$CONTAINER_HOME/$project_relpath" \
        $claude_configs \
        -v "$SCRIPT_DIR/.codex:$CONTAINER_HOME/.codex" \
        -v "$SCRIPT_DIR/.opencode:$CONTAINER_HOME/.config/opencode" \
        -v "$SCRIPT_DIR/.gemini:$CONTAINER_HOME/.gemini" \
        -v "$SCRIPT_DIR/.npm:$CONTAINER_HOME/.npm" \
        -v "$SCRIPT_DIR/pip:$CONTAINER_HOME/.cache/pip" \
        -v "$HOME/.ssh:$CONTAINER_HOME/.ssh:ro" \
        $optional_args \
        "${IMAGE_NAME}:${IMAGE_TAG}" \
        sleep infinity
}

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] [PROJECT_PATH]

Manage Code containers for isolated project environments.

Arguments:
    PROJECT_PATH    Path to the project directory (defaults to current directory)

Options:
    -h, --help      Show this help message
    -b, --build     Force rebuild the container image
    -s, --stop      Stop the container for this project
    -r, --remove    Remove the container for this project
    -l, --list      List all Code containers
    --clean         Remove all stopped Code containers
    --claude        Start Claude (in YOLO mode)
    --zai           Start Claude with Z.AI/GLM models (requires ~/.zai.json)

Examples:
    $0                          # Uses current directory
    $0 /Users/kevin/my-project
    $0 --build
    $0 --stop
    $0 --list
    $0 --claude                  # Start Claude in YOLO mode
    $0 --zai                     # Start with Z.AI models

EOF
    exit 0
}

# Function to generate container name from project path
generate_container_name() {
    local project_path="$1"
    # Remove trailing slash
    project_path="${project_path%/}"
    # Get the project folder name
    local project_name=$(basename "$project_path")
    # Create a hash of the full path for uniqueness
    local path_hash
    if command -v shasum >/dev/null 2>&1; then
        path_hash=$(echo -n "$project_path" | shasum | cut -c1-8)
    elif command -v sha1sum >/dev/null 2>&1; then
        path_hash=$(echo -n "$project_path" | sha1sum | cut -c1-8)
    else
        print_error "Neither shasum nor sha1sum is available; cannot generate container hash"
        exit 1
    fi

    echo "code-${project_name}-${path_hash}"
}

# Function to check if container image exists
image_exists() {
    $CONTAINER_RUNTIME image inspect "${IMAGE_NAME}:${IMAGE_TAG}" >/dev/null 2>&1
}

# Function to build container image
build_image() {
    print_info "Building container image: ${IMAGE_NAME}:${IMAGE_TAG}"

    # Build the image
    $CONTAINER_RUNTIME build -t "${IMAGE_NAME}:${IMAGE_TAG}" --build-arg USERNAME="$USER" "$SCRIPT_DIR"

    print_success "Container image built successfully"
}

# Function to check if container exists
container_exists() {
    local container_name="$1"
    $CONTAINER_RUNTIME container inspect "$container_name" >/dev/null 2>&1
}

# Function to check if container is running
container_running() {
    local container_name="$1"
    [ "$($CONTAINER_RUNTIME container inspect -f '{{.State.Running}}' "$container_name" 2>/dev/null)" == "true" ]
}

# Stop the container only if no other terminal sessions for the project are active.
stop_container_if_last_session() {
    local container_name="$1"
    local project_name="$2"
    local other_sessions

    other_sessions=$(ps ax -o command= | awk -v name="$container_name" -v proj="$project_name" -v runtime="$CONTAINER_RUNTIME" -v chome="$CONTAINER_HOME" '
        BEGIN { count=0 }
        {
            is_exec = (index($0, runtime " exec") && index($0, "-it") && index($0, name) && index($0, "/bin/bash"))
            if (is_exec && index($0, "-w " chome "/" proj)) { count++ }
        }
        END { print count }
    ')
    if [ "$other_sessions" -eq 0 ]; then
        $CONTAINER_RUNTIME stop -t 0 "$container_name" &>/dev/null &
        disown
    else
        print_info "Skipping stop; $other_sessions other terminal(s) still attached"
    fi
}

# Function to start/create container
start_container() {
    local project_path="$1"
    local use_claude="${2:-false}"
    local use_zai="${3:-false}"
    local container_name=$(generate_container_name "$project_path")
    # Use relative path for consistent session storage across /home and /data
    local project_relpath
    if [[ "$project_path" == "$HOME/"* ]]; then
        project_relpath="${project_path#$HOME/}"
    elif [[ "$project_path" == "/data/$USER/"* ]]; then
        project_relpath="${project_path#/data/$USER/}"
    else
        project_relpath=$(basename "$project_path")
    fi

    # Validate project path
    if [ ! -d "$project_path" ]; then
        print_error "Project directory does not exist: $project_path"
        exit 1
    fi

    # Create shared directories if they don't exist
    mkdir -p "$SCRIPT_DIR/.codex"
    mkdir -p "$SCRIPT_DIR/.npm"
    mkdir -p "$SCRIPT_DIR/pip"
    mkdir -p "$SCRIPT_DIR/.local"
    mkdir -p "$SCRIPT_DIR/.opencode"
    mkdir -p "$SCRIPT_DIR/.gemini"

    if [ ! -f "$SCRIPT_DIR/container.claude.json" ]; then
        print_warning "Missing $SCRIPT_DIR/container.claude.json; creating default file"
        echo '{}' > "$SCRIPT_DIR/container.claude.json"
    fi

    # Check if image exists, build if not
    if ! image_exists; then
        print_warning "Container image not found. Building..."
        build_image
    fi

    # Determine the command to run
    local exec_cmd="/bin/bash"
    local exec_env="-e TERM=xterm-256color"
    local mise_init="source ~/.bashrc && mise trust -a 2>/dev/null"

    # --claude flag: start regular claude in YOLO mode
    if [ "$use_claude" = "true" ]; then
        exec_cmd="claude --dangerously-skip-permissions"
    fi

    # --zai flag: start claude with Z.AI/GLM models in YOLO mode
    if [ "$use_zai" = "true" ]; then
        local zai_config="$HOME/.zai.json"
        if [ ! -f "$zai_config" ]; then
            print_error "Z.AI config not found: $zai_config"
            exit 1
        fi

        # Read Z.AI config and build environment variables
        if ! command -v jq >/dev/null 2>&1; then
            print_error "jq is required for --zai option"
            exit 1
        fi

        local api_url api_key haiku_model sonnet_model opus_model
        api_url=$(jq -r '.apiUrl // ""' "$zai_config")
        api_key=$(jq -r '.apiKey // ""' "$zai_config")
        haiku_model=$(jq -r '.haikuModel // "glm-4.5-air"' "$zai_config")
        sonnet_model=$(jq -r '.sonnetModel // "glm-5.0"' "$zai_config")
        opus_model=$(jq -r '.opusModel // "glm-5.0"' "$zai_config")

        if [ -z "$api_url" ] || [ -z "$api_key" ]; then
            print_error "apiUrl/apiKey missing in $zai_config"
            exit 1
        fi

        local key_hint="${api_key:0:4}...${api_key: -4}"
        print_info "Z.AI: endpoint=$api_url | haiku=$haiku_model | sonnet=$sonnet_model | opus=$opus_model | key=$key_hint"

        exec_env="$exec_env"
        exec_env="$exec_env -e ANTHROPIC_BASE_URL=$api_url"
        exec_env="$exec_env -e ANTHROPIC_AUTH_TOKEN=$api_key"
        exec_env="$exec_env -e ANTHROPIC_DEFAULT_HAIKU_MODEL=$haiku_model"
        exec_env="$exec_env -e ANTHROPIC_DEFAULT_SONNET_MODEL=$sonnet_model"
        exec_env="$exec_env -e ANTHROPIC_DEFAULT_OPUS_MODEL=$opus_model"

        exec_cmd="claude --dangerously-skip-permissions"
    fi

    # If container exists and is running, attach to it
    if container_running "$container_name"; then
        print_info "Container '$container_name' is already running"
        print_info "Attaching to container..."
        $CONTAINER_RUNTIME exec -it $exec_env -w "$CONTAINER_HOME/$project_relpath" "$container_name" bash -l -c "$mise_init && $exec_cmd"
        stop_container_if_last_session "$container_name" "$project_relpath"
        return
    fi

    # If container exists but is stopped, start it
    if container_exists "$container_name"; then
        print_info "Starting existing container: $container_name"
        $CONTAINER_RUNTIME start "$container_name"
        $CONTAINER_RUNTIME exec -it $exec_env -w "$CONTAINER_HOME/$project_relpath" "$container_name" bash -l -c "$mise_init && $exec_cmd"
        stop_container_if_last_session "$container_name" "$project_relpath"
        return
    fi

    # Create and start new container
    print_info "Creating new container: $container_name"
    print_info "Project: $project_path -> ~/$project_relpath"

    start_new_container "$container_name" "$project_relpath" "$project_path"

    $CONTAINER_RUNTIME exec -it $exec_env -w "$CONTAINER_HOME/$project_relpath" "$container_name" bash -l -c "$mise_init && $exec_cmd"

    stop_container_if_last_session "$container_name" "$project_relpath"

    print_success "Container session ended"
}

# Function to stop container
stop_container() {
    local project_path="$1"
    local container_name=$(generate_container_name "$project_path")
    
    if ! container_exists "$container_name"; then
        print_error "Container does not exist: $container_name"
        exit 1
    fi
    
    if container_running "$container_name"; then
        print_info "Stopping container: $container_name"
        $CONTAINER_RUNTIME stop -t 0 "$container_name"
        print_success "Container stopped"
    else
        print_warning "Container is not running: $container_name"
    fi
}

# Function to remove container
remove_container() {
    local project_path="$1"
    local container_name=$(generate_container_name "$project_path")
    
    if ! container_exists "$container_name"; then
        print_error "Container does not exist: $container_name"
        exit 1
    fi
    
    if container_running "$container_name"; then
        print_info "Stopping container: $container_name"
        $CONTAINER_RUNTIME stop -t 0 "$container_name"
    fi
    
    print_info "Removing container: $container_name"
    $CONTAINER_RUNTIME rm "$container_name"
    print_success "Container removed"
}

# Function to list containers
list_containers() {
    print_info "Code Containers:"
    $CONTAINER_RUNTIME ps -a --filter "name=code-" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
}

# Function to clean up stopped containers
clean_containers() {
    print_info "Removing all stopped Code containers..."
    local container_ids
    container_ids=$($CONTAINER_RUNTIME ps -a --filter "name=code-" --filter "status=exited" --quiet)

    if [ -z "$container_ids" ]; then
        print_info "No stopped Code containers to remove"
        return
    fi

    $CONTAINER_RUNTIME rm $container_ids

    print_success "Cleanup complete"
}

# Parse command line arguments
BUILD_FLAG=false
STOP_FLAG=false
REMOVE_FLAG=false
LIST_FLAG=false
CLEAN_FLAG=false
CLAUDE_FLAG=false
ZAI_FLAG=false
PROJECT_PATH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -b|--build)
            BUILD_FLAG=true
            shift
            ;;
        -s|--stop)
            STOP_FLAG=true
            shift
            ;;
        -r|--remove)
            REMOVE_FLAG=true
            shift
            ;;
        -l|--list)
            LIST_FLAG=true
            shift
            ;;
        --clean)
            CLEAN_FLAG=true
            shift
            ;;
        --claude)
            CLAUDE_FLAG=true
            shift
            ;;
        --zai)
            ZAI_FLAG=true
            shift
            ;;
        *)
            if [ -z "$PROJECT_PATH" ]; then
                PROJECT_PATH="$1"
            else
                print_error "Unknown argument: $1"
                usage
            fi
            shift
            ;;
    esac
done

# Handle flags
if [ "$LIST_FLAG" = true ]; then
    list_containers
    exit 0
fi

if [ "$CLEAN_FLAG" = true ]; then
    clean_containers
    exit 0
fi

# Default to current directory if PROJECT_PATH not provided
if [ -z "$PROJECT_PATH" ]; then
    PROJECT_PATH=$(pwd)
fi

# Convert to absolute path
PROJECT_PATH=$(cd "$PROJECT_PATH" 2>/dev/null && pwd || echo "$PROJECT_PATH")

# Handle operations
if [ "$BUILD_FLAG" = true ]; then
    build_image
    exit 0
fi

if [ "$STOP_FLAG" = true ]; then
    stop_container "$PROJECT_PATH"
    exit 0
fi

if [ "$REMOVE_FLAG" = true ]; then
    remove_container "$PROJECT_PATH"
    exit 0
fi

# Default operation: start container
start_container "$PROJECT_PATH" "$CLAUDE_FLAG" "$ZAI_FLAG"
