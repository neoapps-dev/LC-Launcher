#!/usr/bin/env bash

# Uninstall LC Launcher using this command:
#
# curl -sSL https://uninstall.lce-launcher.com | bash
#
# OR
#
# wget -qO- https://uninstall.lce-launcher.com | bash

set -euo pipefail

readonly APP_NAME="LC Launcher"
readonly SAFE_NAME="lc-launcher"

readonly INSTALL_DIR="$HOME/.local/share/$SAFE_NAME"
readonly BIN_SYMLINK="$HOME/.local/bin/$SAFE_NAME"
readonly DESKTOP_DIR="$HOME/.local/share/applications"
readonly DESKTOP_PATH="$DESKTOP_DIR/$SAFE_NAME.desktop"

readonly C_RESET="\033[0m"
readonly C_BOLD="\033[1m"
readonly C_BLUE="\033[1;34m"
readonly C_GREEN="\033[1;32m"
readonly C_RED="\033[1;31m"
readonly C_CYAN="\033[1;36m"

log() { printf "[%bINFO%b] %s\n" "${C_BLUE}" "${C_RESET}" "$*" >&2; }
warn() { printf "[%bWARN%b] %s\n" "${C_RED}" "${C_RESET}" "$*" >&2; }

remove() {
    local target="$1"
    local description="$2"

    if [ -e "$target" ] || [ -L "$target" ]; then
        log "Removing $description: $target"
        rm -rf "$target"
    fi
}

main() {
    printf '\033[2J\033[3J\033[H'
    printf "%b=================================================================%b\n" "${C_CYAN}" "${C_RESET}"
    printf "  Uninstalling %b%s%b\n" "${C_BOLD}" "$APP_NAME" "${C_RESET}"
    printf "%b=================================================================%b\n" "${C_CYAN}" "${C_RESET}\n"

    remove "$INSTALL_DIR" "application files & data"
    remove "$BIN_SYMLINK" "binary symlink"
    remove "$DESKTOP_PATH" "desktop shortcut"

    if command -v update-desktop-database &> /dev/null && [ -d "$DESKTOP_DIR" ]; then
        update-desktop-database "$DESKTOP_DIR"
    fi

    printf "\n%b=================================================================%b\n" "${C_CYAN}" "${C_RESET}"
    printf "  %b✓%b %b%s%b has been uninstalled\n" "${C_GREEN}" "${C_RESET}" "${C_BOLD}" "$APP_NAME" "${C_RESET}"
    printf "%b=================================================================%b\n\n" "${C_CYAN}" "${C_RESET}"
}

main "$@"