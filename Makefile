.PHONY: help init up down restart logs health db-shell db-backup db-reset grafana prometheus kong-ui api-test-login test clean

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)WMS-NKS Management Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

init: ## Initialize project (first time setup)
	@echo "$(BLUE)Initializing WMS-NKS project...$(NC)"
	@bash scripts/init-project.sh
	@echo "$(GREEN)✓ Project initialized successfully!$(NC)"

up: ## Start all services
	@echo "$(BLUE)Starting all services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ All services started!$(NC)"
	@echo "$(YELLOW)Run 'make health' to check status$(NC)"

down: ## Stop all services
	@echo "$(BLUE)Stopping all services...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ All services stopped!$(NC)"

restart: down up ## Restart all services

logs: ## View logs (all services)
	docker-compose logs -f

logs-auth: ## View auth service logs
	docker-compose logs -f auth-service

logs-inventory: ## View inventory service logs
	docker-compose logs -f inventory-service

health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo ""
	@echo "$(YELLOW)Auth Service:$(NC)"
	@curl -s http://localhost:3010/health | jq . || echo "$(RED)✗ Auth service not responding$(NC)"
	@echo ""
	@echo "$(YELLOW)Inventory Service:$(NC)"
	@curl -s http://localhost:3011/health | jq . || echo "$(RED)✗ Inventory service not responding$(NC)"
	@echo ""
	@echo "$(YELLOW)PostgreSQL:$(NC)"
	@docker-compose exec -T postgres pg_isready -U wms_admin && echo "$(GREEN)✓ PostgreSQL is ready$(NC)" || echo "$(RED)✗ PostgreSQL not ready$(NC)"
	@echo ""
	@echo "$(YELLOW)Redis:$(NC)"
	@docker-compose exec -T redis redis-cli -a redis_pass_2025 ping && echo "$(GREEN)✓ Redis is ready$(NC)" || echo "$(RED)✗ Redis not ready$(NC)"

ps: ## Show running containers
	docker-compose ps

# Database commands
db-shell: ## Connect to PostgreSQL shell
	docker-compose exec postgres psql -U wms_admin -d wms_nks

db-backup: ## Backup database
	@echo "$(BLUE)Backing up database...$(NC)"
	@mkdir -p backups
	@docker-compose exec -T postgres pg_dump -U wms_admin wms_nks > backups/wms_nks_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backed up to backups/$(NC)"

db-restore: ## Restore database from latest backup
	@echo "$(YELLOW)This will restore the latest backup. Continue? [y/N]$(NC)"
	@read -r response && [ "$$response" = "y" ] || exit 1
	@LATEST=$$(ls -t backups/*.sql | head -1) && \
		cat $$LATEST | docker-compose exec -T postgres psql -U wms_admin wms_nks && \
		echo "$(GREEN)✓ Database restored from $$LATEST$(NC)"

db-reset: ## Reset database (DANGER!)
	@echo "$(RED)WARNING: This will delete all data!$(NC)"
	@echo "$(YELLOW)Are you sure? Type 'yes' to confirm:$(NC)"
	@read -r response && [ "$$response" = "yes" ] || exit 1
	@docker-compose down -v
	@docker-compose up -d postgres
	@sleep 5
	@echo "$(GREEN)✓ Database reset complete$(NC)"

# Monitoring
grafana: ## Open Grafana in browser
	@echo "$(BLUE)Opening Grafana...$(NC)"
	@xdg-open http://localhost:3001 2>/dev/null || open http://localhost:3001 2>/dev/null || start http://localhost:3001
	@echo "$(YELLOW)Username: admin | Password: grafana_admin_2025$(NC)"

prometheus: ## Open Prometheus in browser
	@echo "$(BLUE)Opening Prometheus...$(NC)"
	@xdg-open http://localhost:9090 2>/dev/null || open http://localhost:9090 2>/dev/null || start http://localhost:9090

kong-ui: ## Open Kong admin UI in browser
	@echo "$(BLUE)Opening Konga (Kong Admin UI)...$(NC)"
	@xdg-open http://localhost:1337 2>/dev/null || open http://localhost:1337 2>/dev/null || start http://localhost:1337

rabbitmq-ui: ## Open RabbitMQ management UI
	@echo "$(BLUE)Opening RabbitMQ Management...$(NC)"
	@xdg-open http://localhost:15672 2>/dev/null || open http://localhost:15672 2>/dev/null || start http://localhost:15672
	@echo "$(YELLOW)Username: wms_queue | Password: queue_pass_2025$(NC)"

# User management
create-admin: ## Create admin user
	@echo "$(BLUE)Creating admin user...$(NC)"
	@bash scripts/create-admin.sh

# API Testing
api-test-login: ## Test login endpoint
	@echo "$(BLUE)Testing login endpoint...$(NC)"
	@curl -X POST http://localhost:8000/api/v1/auth/login \
		-H "Content-Type: application/json" \
		-d '{"username":"admin","password":"Admin123!"}' | jq .

api-test-health: ## Test all health endpoints
	@echo "$(BLUE)Testing health endpoints...$(NC)"
	@echo "Auth: " && curl -s http://localhost:3010/health | jq .
	@echo "Inventory: " && curl -s http://localhost:3011/health | jq .

# Development
install-deps: ## Install dependencies for all services
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Installing $$service..."; \
			cd $$service && npm install && cd ../..; \
		fi \
	done
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

lint: ## Run linting on all services
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			cd $$service && npm run lint && cd ../..; \
		fi \
	done

test: ## Run tests
	@echo "$(BLUE)Running tests...$(NC)"
	@echo "$(YELLOW)Tests not yet implemented$(NC)"

# Cleanup
clean: ## Remove all containers, volumes, and networks
	@echo "$(RED)WARNING: This will remove all containers, volumes, and networks!$(NC)"
	@echo "$(YELLOW)Are you sure? Type 'yes' to confirm:$(NC)"
	@read -r response && [ "$$response" = "yes" ] || exit 1
	@docker-compose down -v --remove-orphans
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

clean-logs: ## Remove log files
	@echo "$(BLUE)Removing log files...$(NC)"
	@find . -name "*.log" -type f -delete
	@echo "$(GREEN)✓ Log files removed$(NC)"

# Build
build: ## Build all services
	@echo "$(BLUE)Building services...$(NC)"
	docker-compose build
	@echo "$(GREEN)✓ Build complete$(NC)"

rebuild: ## Rebuild specific service (usage: make rebuild SERVICE=auth-service)
	@echo "$(BLUE)Rebuilding $(SERVICE)...$(NC)"
	docker-compose up -d --build $(SERVICE)
	@echo "$(GREEN)✓ $(SERVICE) rebuilt$(NC)"

# Environment
setup-env: ## Create .env from .env.example
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)✓ .env file created from .env.example$(NC)"; \
		echo "$(YELLOW)⚠ Please update passwords in .env file$(NC)"; \
	else \
		echo "$(YELLOW).env file already exists$(NC)"; \
	fi

# Default target
.DEFAULT_GOAL := help
