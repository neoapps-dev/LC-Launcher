#!/usr/bin/env bash

# Install LC Launcher using this command:
#
# curl -sSL https://install.lce-launcher.com | bash
#
# OR
#
# wget -qO- https://install.lce-launcher.com | bash

set -euo pipefail

readonly APP_NAME="LC Launcher"
readonly SAFE_NAME="lc-launcher"
readonly GITHUB_USER="thehuckledev"
readonly GITHUB_REPO="LC-Launcher"

readonly INSTALL_DIR="$HOME/.local/share/$SAFE_NAME"
readonly BIN_DIR="$HOME/.local/bin"
readonly DESKTOP_DIR="$HOME/.local/share/applications"
readonly APPIMAGE_PATH="$INSTALL_DIR/$SAFE_NAME.AppImage"
readonly ICON_PATH="$INSTALL_DIR/$SAFE_NAME.png"
readonly DESKTOP_PATH="$DESKTOP_DIR/$SAFE_NAME.desktop"

readonly C_RESET="\033[0m"
readonly C_BOLD="\033[1m"
readonly C_BLUE="\033[1;34m"
readonly C_GREEN="\033[1;32m"
readonly C_YELLOW="\033[1;33m"
readonly C_RED="\033[1;31m"
readonly C_CYAN="\033[1;36m"

log() { printf "[%bINFO%b] %s\n" "${C_BLUE}" "${C_RESET}" "$*" >&2; }
warn() { printf "[%bWARN%b] %s\n" "${C_YELLOW}" "${C_RESET}" "$*" >&2; }
error() { printf "[%bERROR%b] %s\n" "${C_RED}" "${C_RESET}" "$*" >&2; exit 1; }

check_fuse_dependency() {
    log "Checking for libfuse2..."
    if [ ! -f /usr/lib/x86_64-linux-gnu/libfuse.so.2 ] && \
       [ ! -f /usr/lib/libfuse.so.2 ] && \
       [ ! -f /usr/lib/x86_64-linux-gnu/libfuse.so.2t64 ] && \
       ! command -v fusermount3 &> /dev/null; then
        
        warn "Missing libfuse2, attempting to install..."
        if command -v apt-get &> /dev/null; then
            if apt-cache show libfuse2t64 &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y libfuse2t64
            else
                sudo apt-get update && sudo apt-get install -y libfuse2
            fi
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y fuse-libs
        elif command -v pacman &> /dev/null; then
            sudo pacman -Sy --noconfirm fuse2
        else
            error "Couldn't find package manager, install libfuse2 manually"
        fi
    else
        log "Found libfuse2"
    fi
}

get_download_url() {
    log "Fetching GitHub release..."
    local api_url="https://api.github.com/repos/$GITHUB_USER/$GITHUB_REPO/releases/latest"
    local release_json
    
    if ! release_json=$(wget -qO- "$api_url"); then
        error "Failed to fetch GitHub release"
    fi

    local arch
    arch=$(uname -m)
    
    local target_arch="x64"
    if [[ "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
        target_arch="arm64"
    fi

    local download_url=""
    
    while read -r line; do
        if [[ $line =~ \"browser_download_url\":\ *\"([^\"]*${target_arch}[^\"]*\.([aA]pp[iI]mage))\" ]]; then
            download_url="${BASH_REMATCH[1]}"
            break
        fi
    done <<< "$release_json"

    if [[ -z "$download_url" ]]; then
        while read -r line; do
            if [[ $line =~ \"browser_download_url\":\ *\"([^\"]+\.([aA]pp[iI]mage))\" ]]; then
                download_url="${BASH_REMATCH[1]}"
                break
            fi
        done <<< "$release_json"
    fi

    if [[ -z "$download_url" ]]; then
        error "A .AppImage wasn't in the GitHub release"
    fi

    echo "$download_url"
}

download_appimage() {
    local download_url="$1"
    log "Downloading latest release..."
    mkdir -p "$(dirname "$APPIMAGE_PATH")"
    wget -q --show-progress "$download_url" -O "$APPIMAGE_PATH"
    chmod +x "$APPIMAGE_PATH"
}

create_symlink() {
    log "Creating bin symlink..."
    ln -sf "$APPIMAGE_PATH" "$BIN_DIR/$SAFE_NAME"
}

extract_desktop_assets() {
    log "Extracting desktop shortcut and icon..."
    (
        cd "$INSTALL_DIR"
        
        "$APPIMAGE_PATH" --appimage-extract &> /dev/null
        
        if [ ! -d "squashfs-root" ]; then
            error "AppImage extraction failed"
        fi

        if [ -f "squashfs-root/.DirIcon" ]; then
            cp "squashfs-root/.DirIcon" "$ICON_PATH"
        else
            local found_icon
            found_icon=$(find squashfs-root -name "*.png" -print -quit 2>/dev/null)
            if [ -n "$found_icon" ]; then
                cp "$found_icon" "$ICON_PATH"
            fi
        fi

        local found_desktop
        found_desktop=$(find squashfs-root -maxdepth 2 -name "*.desktop" -print -quit 2>/dev/null)

        if [ -z "$found_desktop" ]; then
            rm -rf squashfs-root
            exit 1
        fi

        cp "$found_desktop" "$DESKTOP_PATH"
        
        sed -i "s|^Exec=.*|Exec=$BIN_DIR/$SAFE_NAME %U|" "$DESKTOP_PATH"
        if [ -f "$ICON_PATH" ]; then
            sed -i "s|^Icon=.*|Icon=$ICON_PATH|" "$DESKTOP_PATH"
        fi
        
        rm -rf squashfs-root
    ) || error "Failed to extract .desktop file from the AppImage"

    chmod +x "$DESKTOP_PATH"
}

main() {
    printf '\033[2J\033[3J\033[H'
    printf "%b=================================================================%b\n" "${C_CYAN}" "${C_RESET}"
    printf "  Installing %b%s%b\n" "${C_BOLD}" "$APP_NAME" "${C_RESET}"
    printf "%b=================================================================%b\n" "${C_CYAN}" "${C_RESET}\n"

    mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR"
    check_fuse_dependency
    
    local download_url
    download_url=$(get_download_url)
    
    download_appimage "$download_url"
    create_symlink
    extract_desktop_assets
    
    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$DESKTOP_DIR"
    fi

    printf "\n%b=================================================================%b\n" "${C_CYAN}" "${C_RESET}"
    printf "  %b✓%b %b%s%b installed\n" "${C_GREEN}" "${C_RESET}" "${C_BOLD}" "$APP_NAME" "${C_RESET}"
    printf "  Launch it from your applications menu\n"
    printf "%b=================================================================%b\n\n" "${C_CYAN}" "${C_RESET}"
}

main "$@"