#!/bin/sh

# Script to download and setup JDT Language Server
# Usage: ./download-jdtls.sh [target_directory]

set -e  # Exit on any error

# Default target directory
DEFAULT_TARGET="$HOME/Downloads/jdt-language-server-latest"
TARGET_DIR="${1:-$DEFAULT_TARGET}"

# JDT Language Server download URL (use direct URL for better reliability)
JDTLS_URL="https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz"

echo "Downloading JDT Language Server to: $TARGET_DIR"

# Remove target directory if it exists
if [ -d "$TARGET_DIR" ]; then
    echo "Removing existing directory: $TARGET_DIR"
    rm -rf "$TARGET_DIR"
fi

# Create target directory
mkdir -p "$TARGET_DIR"

echo "Downloading and extracting JDT Language Server..."
# Download and extract directly to target directory
# The archive extracts files directly (no subdirectory)
if ! curl -L -f "$JDTLS_URL" | tar -xz -C "$TARGET_DIR"; then
    echo "Error: Failed to download and extract JDT Language Server" >&2
    rm -rf "$TARGET_DIR"
    exit 1
fi

# Verify installation
if [ -f "$TARGET_DIR/bin/jdtls" ]; then
    echo "✓ JDT Language Server successfully installed at: $TARGET_DIR"
    echo "✓ Executable found at: $TARGET_DIR/bin/jdtls"
else
    echo "Warning: JDT Language Server installed but jdtls executable not found at expected location" >&2
    echo "Contents of $TARGET_DIR:"
    ls -la "$TARGET_DIR" || true
fi
