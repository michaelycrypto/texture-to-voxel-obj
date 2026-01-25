#!/bin/bash
# Remove all Zone.Identifier files from input/GoodVibes subfolders
# These files are created by Windows when downloading files from the internet

TARGET_DIR="input/GoodVibes"

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Directory $TARGET_DIR does not exist"
    exit 1
fi

echo "Finding Zone.Identifier files in $TARGET_DIR..."
COUNT=$(find "$TARGET_DIR" -name "*Zone.Identifier*" 2>/dev/null | wc -l)

if [ "$COUNT" -eq 0 ]; then
    echo "No Zone.Identifier files found."
    exit 0
fi

echo "Found $COUNT Zone.Identifier files. Removing..."
find "$TARGET_DIR" -name "*Zone.Identifier*" -type f -delete 2>/dev/null

# Verify removal
REMAINING=$(find "$TARGET_DIR" -name "*Zone.Identifier*" 2>/dev/null | wc -l)

if [ "$REMAINING" -eq 0 ]; then
    echo "Successfully removed $COUNT Zone.Identifier files."
else
    echo "Warning: $REMAINING files could not be removed."
fi
