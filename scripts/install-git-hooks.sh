#!/bin/bash
# Install git hooks from .git-hooks directory

set -e

HOOKS_DIR=".git-hooks"
GIT_HOOKS_DIR=".git/hooks"

echo "📦 Installing git hooks..."

# Check if hooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
  echo "❌ Hooks directory '$HOOKS_DIR' not found"
  exit 1
fi

# Copy each hook to .git/hooks and make it executable
for hook in "$HOOKS_DIR"/*; do
  if [ -f "$hook" ]; then
    hook_name=$(basename "$hook")
    echo "  → Installing $hook_name"
    cp "$hook" "$GIT_HOOKS_DIR/$hook_name"
    chmod +x "$GIT_HOOKS_DIR/$hook_name"
  fi
done

echo "✅ Git hooks installed successfully!"
echo ""
echo "📝 Installed hooks:"
ls -1 "$GIT_HOOKS_DIR" | grep -v '.sample$' | sed 's/^/  - /'
echo ""
echo "ℹ️  To skip hooks temporarily, use: git commit --no-verify"
