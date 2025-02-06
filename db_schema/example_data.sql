-- Insert locations
INSERT INTO locations (name) VALUES ('Fridge');
INSERT INTO locations (name) VALUES ('Cupboard');
INSERT INTO locations (name) VALUES ('Freezer');

-- Insert items
INSERT INTO items (name, location_id, quantity, expiration_date, category)
VALUES ('Milk', 1, 2, '2023-12-01', 'Dairy');

INSERT INTO items (name, location_id, quantity, expiration_date, category)
VALUES ('Bread', 2, 1, '2023-11-15', 'Bakery');

INSERT INTO items (name, location_id, quantity, expiration_date, category)
VALUES ('Chicken', 3, 3, '2023-11-20', 'Meat');