#!/bin/sh



JDTLS_HOME="${JDTLS_HOME:-$HOME/Downloads/jdtls-latest}"

# Download JDT Language Server if it doesn't exist
if [ ! -d "$JDTLS_HOME" ]; then
    echo "JDT Language Server not found at $JDTLS_HOME"

    # Get the directory where this script is located
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    DOWNLOAD_SCRIPT="$SCRIPT_DIR/download-jdtls.sh"

    if [ -f "$DOWNLOAD_SCRIPT" ]; then
        echo "Running download script..."
        "$DOWNLOAD_SCRIPT" "$JDTLS_HOME"
    else
        echo "Error: Download script not found at $DOWNLOAD_SCRIPT" >&2
        echo "Please run: ./download-jdtls.sh \"$JDTLS_HOME\"" >&2
        exit 1
    fi
fi

JDTLS_CONFIGURATION="${JDTLS_CONFIGURATION:-$HOME/.cache/jdtls-mcp}"
JDTLS_DATA="${JDTLS_DATA:-/tmp/jdtls-mcp}"

"$JDTLS_HOME/bin/jdtls" -configuration "$JDTLS_CONFIGURATION" -data "$JDTLS_DATA"
