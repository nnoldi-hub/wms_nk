#!/bin/bash

# Kong Gateway - Scanner Service Configuration
# This script configures Scanner Service in Kong Gateway

echo "Configuring Scanner Service in Kong Gateway..."

# 1. Create Scanner Service
echo "Creating Scanner Service..."
curl -i -X POST http://localhost:8001/services \
  --data name=scanner-service \
  --data host=wms-scanner \
  --data port=3000 \
  --data protocol=http

# 2. Create Route for Scanner Service
echo "Creating route for Scanner Service..."
curl -i -X POST http://localhost:8001/services/scanner-service/routes \
  --data 'name=scanner-route' \
  --data 'paths[]=/api/v1/scanner' \
  --data 'strip_path=false' \
  --data 'methods[]=GET' \
  --data 'methods[]=POST' \
  --data 'methods[]=PUT' \
  --data 'methods[]=DELETE' \
  --data 'methods[]=PATCH'

# 3. Enable CORS
echo "Enabling CORS for Scanner Service..."
curl -i -X POST http://localhost:8001/services/scanner-service/plugins \
  --data name=cors \
  --data 'config.origins=*' \
  --data 'config.methods=GET' \
  --data 'config.methods=POST' \
  --data 'config.methods=PUT' \
  --data 'config.methods=DELETE' \
  --data 'config.methods=PATCH' \
  --data 'config.methods=OPTIONS' \
  --data 'config.headers=Accept' \
  --data 'config.headers=Authorization' \
  --data 'config.headers=Content-Type' \
  --data 'config.exposed_headers=X-Auth-Token' \
  --data 'config.credentials=true' \
  --data 'config.max_age=3600'

# 4. Enable Rate Limiting
echo "Enabling rate limiting for Scanner Service..."
curl -i -X POST http://localhost:8001/services/scanner-service/plugins \
  --data name=rate-limiting \
  --data 'config.minute=100' \
  --data 'config.policy=local' \
  --data 'config.hide_client_headers=false'

# 5. Enable Request Logging
echo "Enabling request logging for Scanner Service..."
curl -i -X POST http://localhost:8001/services/scanner-service/plugins \
  --data name=file-log \
  --data 'config.path=/var/log/kong/scanner-service.log' \
  --data 'config.reopen=true'

echo "Scanner Service configuration completed!"
echo ""
echo "Test endpoints:"
echo "  GET  http://localhost:8000/api/v1/scanner/validate/:code"
echo "  POST http://localhost:8000/api/v1/scanner/scan"
echo "  GET  http://localhost:8000/api/v1/scanner/history/:userId"
echo "  GET  http://localhost:8000/api/v1/scanner/stats"
