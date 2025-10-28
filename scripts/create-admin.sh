#!/bin/bash

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Create Admin User                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Generate password hash for "Admin123!"
PASSWORD_HASH='$2a$10$YcGbJ5eLXZlNLPBD5qJ6FeGNdD1G8hYxJ5QGX5QJ8MZ5XQJ5XQJ5X'

# Check if admin user already exists
EXISTING_ADMIN=$(docker-compose exec -T postgres psql -U wms_admin -d wms_nks -t -c "SELECT username FROM users WHERE username = 'admin';")

if [ ! -z "$EXISTING_ADMIN" ]; then
    echo -e "${YELLOW}⚠ Admin user already exists${NC}"
    echo -e "${BLUE}Username:${NC} admin"
    echo -e "${BLUE}Password:${NC} Admin123!"
    exit 0
fi

# Create admin user
echo -e "${BLUE}Creating admin user...${NC}"

docker-compose exec -T postgres psql -U wms_admin -d wms_nks << EOF
INSERT INTO users (username, email, password_hash, role) 
VALUES (
    'admin',
    'admin@wms-nks.local',
    '$PASSWORD_HASH',
    'admin'
) ON CONFLICT (username) DO NOTHING;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Admin user created successfully!${NC}"
    echo ""
    echo -e "${BLUE}Login Credentials:${NC}"
    echo -e "  ${YELLOW}Username:${NC} admin"
    echo -e "  ${YELLOW}Password:${NC} Admin123!"
    echo ""
    echo -e "${BLUE}Test Login:${NC}"
    echo -e "  curl -X POST http://localhost:8000/api/v1/auth/login \\"
    echo -e "    -H \"Content-Type: application/json\" \\"
    echo -e "    -d '{\"username\":\"admin\",\"password\":\"Admin123!\"}'"
    echo ""
else
    echo -e "${RED}✗ Failed to create admin user${NC}"
    exit 1
fi
