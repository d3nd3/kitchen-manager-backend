-- Get all items
SELECT * FROM items;

-- Get items in the Fridge
SELECT * FROM items WHERE location_id = 1;

-- Get items expiring soon
SELECT * FROM items WHERE expiration_date < '2023-12-01';