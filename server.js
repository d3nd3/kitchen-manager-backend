const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const fs = require('fs');

const db = new Database('kitchen.db'); // SQLite database
const app = express();
app.use(express.json());
app.use(cors());

// Initialize database tables from schema.sql
const schemaPath = './db_schema/schema.sql';
try {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('Database schema initialized successfully.');
} catch (err) {
  console.error('Error initializing database schema:', err);
  // Handle the error appropriately, e.g., exit the process
  process.exit(1); // Or other error handling
}


// Get all locations
app.get('/locations', (req, res) => {
    const locations = db.prepare('SELECT * FROM locations').all();
    res.json(locations);
});

// Get items by location
app.get('/items/:locationId', (req, res) => {
    const { locationId } = req.params;
    const items = db.prepare('SELECT * FROM items WHERE location_id = ?').all(locationId);
    res.json(items);
});

// Add new item
app.post('/items', (req, res) => {
    const { name, location_id, quantity, expiration_date, frozen_date, category, ean13, image_url } = req.body;
    const stmt = db.prepare(
        `INSERT INTO items (name, location_id, quantity, expiration_date, frozen_date, category, ean13, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(name, location_id, quantity, expiration_date, frozen_date, category, ean13, image_url);
    res.json({ message: 'Item added successfully' });
});

// Start server
app.listen(3001, () => console.log('API running on port 3001'));