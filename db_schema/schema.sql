-- Table to store locations
CREATE TABLE locations (
  id INTEGER PRIMARY KEY,
  name TEXT -- (e.g., 'Fridge', 'Cupboard')
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    ean13 TEXT UNIQUE,
    product_code TEXT UNIQUE,  -- No inline check here
    name TEXT,
    image_url TEXT,
    CHECK ((ean13 IS NOT NULL AND product_code IS NULL) OR (ean13 IS NULL AND product_code IS NOT NULL)), -- Table-level check for EAN13/product_code exclusivity
    CHECK (product_code IS NULL OR (LENGTH(product_code) > 0 AND UPPER(product_code) = product_code)), -- Table-level check for product_code
    CHECK(LENGTH(ean13) = 13 AND ean13 GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);

-- Table to store tags
CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE -- Tag name (e.g., 'Dairy', 'Vegetables')
);

-- Table to associate products with tags (many-to-many relationship)
CREATE TABLE product_tags (
  product_id INTEGER REFERENCES products(id), -- Link to the product
  tag_id INTEGER REFERENCES tags(id), -- Link to the tag
  PRIMARY KEY (product_id, tag_id) -- Ensure unique combinations
);

-- Table to store specific item instances
CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  product_id INTEGER REFERENCES products(id), -- Link to the generic product information
  location_id INTEGER REFERENCES locations(id), -- Link to the location
  quantity INTEGER,
  expiration_date DATE,
  frozen_date DATE
);

-- Insert locations
INSERT INTO locations (name) VALUES ('Fridge');
INSERT INTO locations (name) VALUES ('Cupboard');
INSERT INTO locations (name) VALUES ('Freezer');