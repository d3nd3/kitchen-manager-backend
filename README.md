# Kitchen Manager Backend

Node.js + Express + better-sqlite3 backend for the Kitchen Inventory PWA. Provides product catalog, item storage by location, tags, alerts, and Open Food Facts enrichment.

## Features

- SQLite database auto-initialized with schema on first run
- Locations (Fridge, Cupboard, Freezer) seeded
- Products with mutually exclusive identifiers:
  - Either EAN-13 barcode or uppercase `product_code` (one must be set)
  - `min_stock` threshold for low-stock alerts
  - Optional `image_url`
- Tags with many-to-many product association
- Items stored at locations with quantity, expiration and frozen dates
- Alerts:
  - Expiring/expired items (window configurable)
  - Low stock by product vs `min_stock`
- Open Food Facts enrichment endpoint to auto-fill product data
- CORS enabled for the UI

## Tech stack

- Node.js (>= 18 recommended), Express 4
- better-sqlite3 for synchronous, fast SQLite access

## Project structure

- `server.js`: App entry, DB setup/migrations, and all routes
- `db_schema/schema.sql`: Initial schema and seed (for first run)
- `kitchen.db`: SQLite database (created at runtime; not versioned)

## Setup

Prerequisites:
- Node.js >= 18, npm

Install dependencies:
```bash
npm install
```

Start server:
```bash
npm run dev
# or
npm start
```

Default port: `3001`

## Database

Tables:
- `locations (id, name)`
- `products (id, ean13, product_code, name, image_url, min_stock)` with constraints
- `tags (id, name unique)`
- `product_tags (product_id, tag_id)`
- `items (id, product_id, location_id, quantity, expiration_date, frozen_date)`

On first run (no `kitchen.db`): schema is applied from `db_schema/schema.sql` and locations are seeded.
A lightweight migration adds `products.min_stock` if missing.

## API

Base URL defaults to `http://localhost:3001` (adjust CORS/domain as needed).

- Locations
  - `GET /locations`: List all locations

- Items
  - `GET /items/:locationId`: Items for a location including product name, image, and tags
  - `POST /item`: Add an item instance
    - Body: `{ product_id, location_id, quantity, expiration_date?, frozen_date?, tags? }`

- Tags
  - `GET /tags`: All tags
  - `POST /tag`: Create a tag `{ name }` (uppercased and deduped)

- Products
  - `GET /products`: All products with tags array
  - `GET /products/:id`: Single product
  - `POST /product`: Create product
    - Body: `{ product_name, ean13?, product_code?, image_url?, tags?, min_stock? }`
  - `PUT /product/:id`: Update product
    - Body: same as create

- Alerts
  - `GET /alerts?expSoonDays=3`: Returns `{ expiring: [...], lowStock: [...] }`

- Open Food Facts
  - `GET /openfoodfacts/:ean13`: Returns `{ name, image_url, tags }`

## Validation and constraints

- Either `ean13` (13 digits) or `product_code` (uppercase) must be present, not both.
- `min_stock` is a non-negative integer (defaults 0).
- Tag names are uppercased and unique.

## Development notes

- CORS is enabled for local development; tighten in production as needed.
- The DB file `kitchen.db` is ignored by git; use export scripts for migrations/seeding if needed.

## Roadmap

- Auth and multi-user support
- Soft deletes and audit history
- Webhooks/integrations for notifications (email/Telegram/web push)

## License

MIT (c) 2025