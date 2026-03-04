#!/bin/bash
# Test /api/splitwise/status with your token
# 1. Log in to the app in the browser
# 2. Open DevTools → Application → Local Storage → copy value of splitsprint-token
# 3. Run: ./scripts/test-splitwise-status.sh YOUR_TOKEN_HERE

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <your-jwt-token>"
  echo "Get token from: DevTools → Application → Local Storage → splitsprint-token"
  exit 1
fi

echo "Testing http://localhost:3002/api/splitwise/status"
curl -s -w "\n\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3002/api/splitwise/status
