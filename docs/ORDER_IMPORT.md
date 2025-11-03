# Order CSV Import (MVP)

Endpoint: POST /api/v1/orders/import-csv (multipart/form-data)
- Field name: `file`
- Accepts: CSV with comma separator (use dot or comma decimals). Header required.

Supported columns (case-insensitive):
- order_number (optional – if missing, number auto-generated as CMD_#####)
- customer, address, contact, delivery_type, agent
- sku, description, qty, uom (Km/Buc/etc)
- requested_lengths (e.g. "50+20+30" or "50,20,30")
- management_code (Cod gest.)
- lot_label (Lot intrare)
- line_weight (kg) – optional, used for PDF total weight

Response:
```
{
  "success": true,
  "data": {
    "orders": [ { "id": "...", "number": "CMD_108818", "lines": 5 } ]
  }
}
```

List orders: GET /api/v1/orders?page=1&limit=25
Get one: GET /api/v1/orders/:id

Example file: `docs/ORDER_IMPORT_EXAMPLE.csv`
