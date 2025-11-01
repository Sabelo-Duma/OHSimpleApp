#!/bin/bash
echo "=== Checking Port 3000 Status ==="
echo ""
echo "1. Checking if app is running on localhost:3000..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000
echo ""
echo "2. Port binding status:"
netstat -tuln 2>/dev/null | grep 3000 || netstat -an | grep 3000 | head -3
echo ""
echo "3. If you see 'TCP 0.0.0.0:3000' above, the app is ready!"
echo ""
echo "=== Next Steps ==="
echo "In VS Code, go to the PORTS tab at the bottom"
echo "Find port 3000 and make sure it's set to 'Public'"
echo "Then try accessing: https://solid-palm-tree-v6pr54ggq5g5fq5v-3000.app.github.dev/"
