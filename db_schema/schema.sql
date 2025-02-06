CREATE TABLE locations (
  id INTEGER PRIMARY KEY,
  name TEXT --(e.g., 'Fridge', 'Cupboard')
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT,
  location_id INTEGER REFERENCES locations(id),
  quantity INTEGER,
  expiration_date DATE,
  frozen_date DATE,
  category TEXT, --(e.g., 'Dairy', 'Vegetables')
  ean13 TEXT UNIQUE NOT NULL CHECK(LENGTH(ean13) = 13 AND ean13 GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'), -- EAN13 barcode (13 digits)
  image_url TEXT -- URL of the product image (can be NULL)
);