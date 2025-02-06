const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

const dbPath = path.join(__dirname, 'kitchen.db'); // Include __dirname for db path as well

// Check if the database file exists *before* opening it
const dbExists = fs.existsSync(dbPath);

let db;  // Declare db outside the if block

if (!dbExists) {
  // Create the database and initialize the schema
  db = new Database(dbPath); // Now create ONLY if the file doesn't exist.
  const schemaPath = path.join(__dirname, './db_schema/schema.sql');
  try {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    console.log('Database created and schema initialized successfully.');
  } catch (err) {
    console.error('Error initializing database schema:', err);
    db.close(); // Close the database on error
    process.exit(1);
  }
} else {
  // Open the existing database
  db = new Database(dbPath);
  console.log('Database already exists. Skipping schema initialization.');
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