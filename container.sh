#!/bin/bash

# Code Container Manager
# Manages isolated Docker containers for running coding tools on different projects

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory (where Dockerfile and shared volumes are)
SCRIPT_PATH="$0"
while [ -L "$SCRIPT_PATH" ]; do
    SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
IMAGE_NAME="code"
IMAGE_TAG="latest"

# Container launch command; modify to add additional mounts
start_new_container() {
    local container_name="$1"
    local project_name="$2"
    local project_path="$3"

    docker run -d \
        --name "$container_name" \
        -e TERM=xterm-256color \
        -w "/root/$project_name" \
        -v "$project_path:/root/$project_name" \
        -v "$SCRIPT_DIR/.claude:/root/.claude" \
        -v "$SCRIPT_DIR/container.claude.json:/root/.claude.json" \
        -v "$SCRIPT_DIR/.codex:/root/.codex" \
        -v "$SCRIPT_DIR/.opencode:/root/.config/opencode" \
        -v "$SCRIPT_DIR/.gemini:/root/.gemini" \
        -v "$SCRIPT_DIR/.npm:/root/.npm" \
        -v "$SCRIPT_DIR/pip:/root/.cache/pip" \
        -v "$SCRIPT_DIR/.local:/root/.local" \
        -v "$HOME/.gitconfig:/root/.gitconfig:ro" \
        -v "$HOME/.ssh:/root/.ssh:ro" \
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
    -b, --build     Force rebuild the Docker image
    -s, --stop      Stop the container for this project
    -r, --remove    Remove the container for this project
    -l, --list      List all Code containers
    --clean         Remove all stopped Code containers

Examples:
    $0                          # Uses current directory
    $0 /Users/kevin/my-project
    $0 --build
    $0 --stop
    $0 --list

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

# Function to check if Docker image exists
image_exists() {
    docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" >/dev/null 2>&1
}

# Function to build Docker image
build_image() {
    print_info "Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
    
    # Build the image
    docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" "$SCRIPT_DIR"
    
    print_success "Docker image built successfully"
}

# Function to check if container exists
container_exists() {
    local container_name="$1"
    docker container inspect "$container_name" >/dev/null 2>&1
}

# Function to check if container is running
container_running() {
    local container_name="$1"
    [ "$(docker container inspect -f '{{.State.Running}}' "$container_name" 2>/dev/null)" == "true" ]
}

# Stop the container only if no other terminal sessions for the project are active.
stop_container_if_last_session() {
    local container_name="$1"
    local project_name="$2"
    local other_sessions

    other_sessions=$(ps ax -o command= | awk -v name="$container_name" -v proj="$project_name" '
        BEGIN { count=0 }
        {
            is_exec = (index($0, "docker exec") && index($0, "-it") && index($0, name) && index($0, "/bin/bash"))
            if (is_exec && index($0, "-w /root/" proj)) { count++ }
        }
        END { print count }
    ')
    if [ "$other_sessions" -eq 0 ]; then
        docker stop "$container_name"
    else
        print_info "Skipping stop; $other_sessions other terminal(s) still attached"
    fi
}

# Function to start/create container
start_container() {
    local project_path="$1"
    local container_name=$(generate_container_name "$project_path")
    local project_name=$(basename "$project_path")
    
    # Validate project path
    if [ ! -d "$project_path" ]; then
        print_error "Project directory does not exist: $project_path"
        exit 1
    fi
    
    # Create shared directories if they don't exist
    mkdir -p "$SCRIPT_DIR/.claude"
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
        print_warning "Docker image not found. Building..."
        build_image
    fi
    
    # If container exists and is running, attach to it
    if container_running "$container_name"; then
        print_info "Container '$container_name' is already running"
        print_info "Attaching to container..."
        docker exec -it -e TERM=xterm-256color -w "/root/$project_name" "$container_name" /bin/bash
        stop_container_if_last_session "$container_name" "$project_name"
        return
    fi
    
    # If container exists but is stopped, start it
    if container_exists "$container_name"; then
        print_info "Starting existing container: $container_name"
        docker start "$container_name"
        docker exec -it -e TERM=xterm-256color -w "/root/$project_name" "$container_name" /bin/bash
        stop_container_if_last_session "$container_name" "$project_name"
        return
    fi
    
    # Create and start new container
    print_info "Creating new container: $container_name"
    print_info "Project: $project_path -> ~/$(basename "$project_path")"

    start_new_container "$container_name" "$project_name" "$project_path"

    docker exec -it -e TERM=xterm-256color -w "/root/$project_name" "$container_name" /bin/bash
    
    stop_container_if_last_session "$container_name" "$project_name"
    
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
        docker stop "$container_name"
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
        docker stop "$container_name"
    fi
    
    print_info "Removing container: $container_name"
    docker rm "$container_name"
    print_success "Container removed"
}

# Function to list containers
list_containers() {
    print_info "Code Containers:"
    docker ps -a --filter "name=code-" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
}

# Function to clean up stopped containers
clean_containers() {
    print_info "Removing all stopped Code containers..."
    local container_ids
    container_ids=$(docker ps -a --filter "name=code-" --filter "status=exited" --quiet)

    if [ -z "$container_ids" ]; then
        print_info "No stopped Code containers to remove"
        return
    fi

    docker rm $container_ids

    print_success "Cleanup complete"
}

# Parse command line arguments
BUILD_FLAG=false
STOP_FLAG=false
REMOVE_FLAG=false
LIST_FLAG=false
CLEAN_FLAG=false
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
start_container "$PROJECT_PATH"
