#!/bin/bash

# Add castContext: null to all useFarcasterAuth mocks

# Fix simple mocks that just return { isAuthenticated: true/false }
find src -name "*.test.tsx" -o -name "*.test.ts" | while read file; do
  # Add castContext to simple isAuthenticated mocks
  sed -i 's/\.mockReturnValue({ isAuthenticated: true });/.mockReturnValue({ isAuthenticated: true, castContext: null });/g' "$file"
  sed -i 's/\.mockReturnValue({ isAuthenticated: false });/.mockReturnValue({ isAuthenticated: false, castContext: null });/g' "$file"
done

echo "Fixed simple mocks"

# Now we need to manually fix the more complex mocks in specific files