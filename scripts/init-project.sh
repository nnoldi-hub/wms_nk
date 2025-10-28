#!/bin/bash

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   WMS-NKS Project Initialization      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠ Please review and update passwords in .env file${NC}"
else
    echo -e "${YELLOW}⚠ .env file already exists${NC}"
fi

# Create necessary directories
echo -e "${BLUE}Creating necessary directories...${NC}"
mkdir -p backups
mkdir -p logs
mkdir -p data/postgres
mkdir -p data/redis
mkdir -p data/grafana
echo -e "${GREEN}✓ Directories created${NC}"

# Pull Docker images
echo -e "${BLUE}Pulling Docker images...${NC}"
docker-compose pull

# Start infrastructure services first
echo -e "${BLUE}Starting infrastructure services...${NC}"
docker-compose up -d postgres redis rabbitmq

# Wait for PostgreSQL to be ready
echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
until docker-compose exec -T postgres pg_isready -U wms_admin &> /dev/null; do
    echo -n "."
    sleep 1
done
echo ""
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Wait for Redis to be ready
echo -e "${BLUE}Waiting for Redis to be ready...${NC}"
until docker-compose exec -T redis redis-cli -a redis_pass_2025 ping &> /dev/null; do
    echo -n "."
    sleep 1
done
echo ""
echo -e "${GREEN}✓ Redis is ready${NC}"

# Initialize database
echo -e "${BLUE}Initializing database...${NC}"
docker-compose exec -T postgres psql -U wms_admin -d wms_nks -f /docker-entrypoint-initdb.d/01-init-databases.sql
echo -e "${GREEN}✓ Database initialized${NC}"

# Start all services
echo -e "${BLUE}Starting all services...${NC}"
docker-compose up -d

# Wait a bit for services to start
echo -e "${BLUE}Waiting for services to start...${NC}"
sleep 10

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     WMS-NKS Initialized Successfully!  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Available Services:${NC}"
echo -e "  ${YELLOW}Kong Gateway:${NC}      http://localhost:8000"
echo -e "  ${YELLOW}Konga Admin UI:${NC}    http://localhost:1337"
echo -e "  ${YELLOW}Grafana:${NC}           http://localhost:3001 (admin/grafana_admin_2025)"
echo -e "  ${YELLOW}Prometheus:${NC}        http://localhost:9090"
echo -e "  ${YELLOW}RabbitMQ UI:${NC}       http://localhost:15672 (wms_queue/queue_pass_2025)"
echo ""
echo -e "${BLUE}Direct Service Ports:${NC}"
echo -e "  ${YELLOW}Auth Service:${NC}      http://localhost:3010"
echo -e "  ${YELLOW}Inventory:${NC}         http://localhost:3011"
echo -e "  ${YELLOW}Scanner:${NC}           http://localhost:3012"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Run: ${YELLOW}make create-admin${NC} to create admin user"
echo -e "  2. Run: ${YELLOW}make health${NC} to check service health"
echo -e "  3. Run: ${YELLOW}make logs${NC} to view logs"
echo -e "  4. Run: ${YELLOW}make help${NC} for all available commands"
echo ""
