🔌 Extensii propuse pentru WMS-NKS
1. Inventory Service (3011)
🔧 Noi entități:
product_units: definește unități de ambalare (cutie, rolă, tambur, metru, kg)

product_batches: loturi individuale cu ambalaj, lungime, greutate, status (intact, tăiat, reambalat)

product_transformations: istoric de tăieri, reambalări, conversii

🧠 Logică nouă:
Stocul nu se mai bazează doar pe SKU, ci pe SKU + ambalaj + lot/tambur

Se adaugă un algoritm de selectare automată tambur pentru tăiere:

FIFO

pierdere minimă

spațiu disponibil

2. Cutting Service (3013)
🔧 Extindere API:
http
POST /api/v1/cutting/orders          # Create cutting order
POST /api/v1/cutting/orders/:id/suggest-source  # Sugerează tambur
POST /api/v1/cutting/orders/:id/execute         # Execută tăierea
🧠 Funcționalități:
Primește comanda de tăiere (lungime, SKU)

Sugerează tambur optim (dacă agentul nu a ales)

Execută tăierea → creează un nou tambur cu restul

Înregistrează conversia în product_transformations

3. Scanner Service (3012)
🔧 Extindere:
Scanare tambur → identificare lungime, status

Scanare post-tăiere → înregistrare tambur nou

4. Inventory Movements
🔁 Mișcări noi:
CUT: tăiere din tambur

REPACK: reambalare în tambur mai mic

CONVERT: schimbare ambalaj (ex: rolă → cutie)

5. Frontend (Mobile + Web)
📱 Mobile App:
Ecran nou: “Tăiere cablu”

Scan tambur

Introdu lungime

Sugestie automată

Confirmare tăiere

🖥️ Web UI:
Dashboard “Transformări produs”

Istoric tăieri

Tamburi activi

Conversii și ambalaje

6. Reports Service (3019)
Raport “Consum tamburi”

Raport “Transformări SKU”

Raport “Pierderi la tăiere”

7. ERP Connector (3018)
Trimite în ERP:

Conversii SKU

Mișcări stoc post-tăiere

Ambalaje noi

🔐 Audit & Trasabilitate
Fiecare tăiere → log în audit_logs

Fiecare tambur → ID unic, trasabilitate completă

Conversii → legături între tambur sursă și tambur rezultat