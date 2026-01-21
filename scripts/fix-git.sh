#!/bin/bash

# Git Fix Script - Resolves common git issues
# Fixes HEAD lock errors, cleans up repository, and ensures clean state

echo "🔧 Git Repository Fix Tool"
echo "=========================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not in a git repository"
    exit 1
fi

echo "📍 Current repository status:"
git status --porcelain

# Fix 1: Remove any git lock files
echo -e "\n🔒 Checking for lock files..."
LOCK_FILES=$(find .git -name "*.lock" -type f 2>/dev/null)
if [ -n "$LOCK_FILES" ]; then
    echo "Found lock files:"
    echo "$LOCK_FILES"
    find .git -name "*.lock" -type f -delete
    echo "✅ Lock files removed"
else
    echo "✅ No lock files found"
fi

# Fix 2: Clean up git repository
echo -e "\n🧹 Cleaning up repository..."
git gc --quiet 2>/dev/null
echo "✅ Git cleanup completed"

# Fix 3: Verify HEAD reference
echo -e "\n👤 Checking HEAD reference..."
if git rev-parse --verify HEAD >/dev/null 2>&1; then
    echo "✅ HEAD reference is valid: $(git rev-parse --short HEAD)"
else
    echo "❌ HEAD reference is invalid"
    # Try to fix by resetting to last known good commit
    LAST_COMMIT=$(git reflog | head -1 | cut -d' ' -f1)
    if [ -n "$LAST_COMMIT" ]; then
        echo "🔄 Resetting HEAD to: $LAST_COMMIT"
        git update-ref HEAD "$LAST_COMMIT"
        echo "✅ HEAD reference fixed"
    else
        echo "❌ Cannot determine last commit from reflog"
        exit 1
    fi
fi

# Fix 4: Check for conflicted merge state
echo -e "\n🔀 Checking for merge conflicts..."
if [ -f .git/MERGE_HEAD ]; then
    echo "⚠️  Repository is in merge state"
    echo "Run 'git merge --abort' or resolve conflicts manually"
elif [ -f .git/CHERRY_PICK_HEAD ]; then
    echo "⚠️  Repository is in cherry-pick state"
    echo "Run 'git cherry-pick --abort' or resolve conflicts manually"
elif [ -f .git/REBASE_HEAD ]; then
    echo "⚠️  Repository is in rebase state"
    echo "Run 'git rebase --abort' or resolve conflicts manually"
else
    echo "✅ No conflicted merge state"
fi

# Fix 5: Check working directory
echo -e "\n📁 Checking working directory..."
if git diff --quiet && git diff --cached --quiet; then
    echo "✅ Working directory is clean"
else
    echo "⚠️  Working directory has changes"
    echo "Uncommitted changes:"
    git status --short
fi

# Fix 6: Verify remote connectivity
echo -e "\n🌐 Testing remote connectivity..."
if git ls-remote origin HEAD >/dev/null 2>&1; then
    echo "✅ Remote connectivity working"
else
    echo "⚠️  Remote connectivity issues (may be normal in local environment)"
fi

# Final status
echo -e "\n📊 Final repository status:"
echo "Current branch: $(git branch --show-current)"
echo "Last commit: $(git log -1 --oneline)"
echo "Clean working tree: $(git diff --quiet && git diff --cached --quiet && echo 'Yes' || echo 'No')"

echo -e "\n✅ Git repository fix completed!"
echo -e "\n💡 If issues persist:"
echo "   • Try: git reset --hard HEAD"
echo "   • Or: git stash (to save changes) then git reset --hard HEAD"
echo "   • For severe issues: backup files and re-clone repository"
