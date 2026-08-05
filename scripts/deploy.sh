#!/bin/sh
set -eu

echo "scripts/deploy.sh no longer deploys production."
echo "Push through the protected CI/CD pipeline; Render runs scripts/migrate.js as its pre-deploy gate."
exit 1
