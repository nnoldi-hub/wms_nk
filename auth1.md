Cum pornești proiectul (3 minute)
bash# 1. Clonează/creează structura
mkdir wms-nks && cd wms-nks

# 2. Copiază fișierele din artifacts:
#    - docker-compose.yml
#    - Makefile
#    - scripts/init-project.sh

# 3. Rulează inițializarea
chmod +x scripts/init-project.sh
make init

# 4. Pornește serviciile
make up

# 5. Verifică starea
make health

# 6. Creează admin user
make create-admin

# 7. Accesează aplicația
# Web UI: http://localhost:3000
# Kong Gateway: http://localhost:8000
# Grafana: http://localhost:3001

📋 Comenzi esențiale
bash# Development
make up              # Pornește toate serviciile
make down            # Oprește toate serviciile
make logs            # Vezi logs în real-time
make restart         # Restart complet
make health          # Verifică health

# Database
make db-shell        # Conectează-te la PostgreSQL
make db-backup       # Backup database
make db-reset        # Reset complet (ATENȚIE!)

# Monitoring
make grafana         # Deschide Grafana
make prometheus      # Deschide Prometheus
make kong-ui         # Deschide Kong admin

# Testing
make api-test-login  # Test login endpoint
make test            # Rulează toate testele

# Cleanup
make clean           # Șterge tot (containers + volumes)