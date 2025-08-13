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



// Get items by location, including product details
app.get('/items/:locationId', (req, res) => {
    const { locationId } = req.params;
    const items = db.prepare(`
        SELECT i.*, p.name AS product_name, p.image_url, GROUP_CONCAT(t.name) AS tags
        FROM items i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN tags t ON pt.tag_id = t.id
        WHERE i.location_id = ?
        GROUP BY i.id
    `).all(locationId);
    res.json(items);
});



// Get all tags
app.get('/tags', (req, res) => {
    const tags = db.prepare('SELECT * FROM tags').all();
    res.json(tags);
});


// GET /products (Get all products)
app.get('/products', (req, res) => {
  const stmt = db.prepare(`
    SELECT p.*, GROUP_CONCAT(t.name) AS tags
    FROM products p
    LEFT JOIN product_tags pt ON p.id = pt.product_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    GROUP BY p.id
  `);

  try {
    const rows = stmt.all(); // Use stmt.all() to get all rows

    if (rows && rows.length > 0) {
      const products = rows.map(row => ({
        id: row.id,
        ean13: row.ean13,
        product_code: row.product_code,
        name: row.name,
        image_url: row.image_url,
        tags: row.tags ? row.tags.split(',') : [],
      }));
      res.json(products);
    } else {
      // No products found (could be an empty database)
      res.json([]); // Return an empty array instead of 404
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});


// GET /products/:id (Get a single product by ID)
app.get('/products/:id', (req, res) => {
    const productId = req.params.id;

    // 1. Validate productId - crucial!
    const productIdNum = Number(productId); // Try converting to a number
    if (isNaN(productIdNum) || !Number.isInteger(productIdNum)) {
        return res.status(400).json({ error: 'Invalid product ID. Must be an integer.' });
    }

    const stmt = db.prepare(`
        SELECT p.*, GROUP_CONCAT(t.name) AS tags
        FROM products p
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN tags t ON pt.tag_id = t.id
        WHERE p.id = ?
        GROUP BY p.id
    `);

    try {
      // Execute the query synchronously
      const row = stmt.get(productIdNum);

      if (row) {
        // Construct the product object
        const product = {
          id: row.id,
          ean13: row.ean13,
          product_code: row.product_code,
          name: row.name,
          image_url: row.image_url,
          tags: row.tags ? row.tags.split(',') : [], // Split tags into array
        };
        res.json(product);
      } else {
        // Product not found
        res.status(404).json({ error: 'Product not found' });
      }
    } catch (err) {
      // Handle errors
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch product' });
    }
});

app.post('/tag', (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Tag name is required' });
    }

    const nameUpper = name.toUpperCase(); // Consistent uppercase storage

    try {
        // Check if the tag already exists (case-insensitive)
        const existingTag = db.prepare("SELECT name FROM tags WHERE UPPER(name) = ?").get(nameUpper);

        if (existingTag) {
            return res.status(409).json({ error: 'Tag already exists', tag: existingTag }); // 409 Conflict
        }

        // Insert the new tag (using parameterized query for security)
        const insertStatement = db.prepare("INSERT INTO tags (name) VALUES (?)");
        const result = insertStatement.run(nameUpper);

        if (result.changes > 0) {
            const newTag = { id: result.lastInsertRowid, name: nameUpper }; // Include ID if your table has it
            res.status(201).json(newTag); // 201 Created with the new tag data
        } else {
            res.status(500).json({ error: 'Failed to create tag' });
        }


    } catch (error) {
        console.error("Error creating tag:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

let validateProduct = (ean13, product_code) => {
    // Validate that either EAN13 or product_code is provided, but not both
    if (!ean13 && !product_code) {
        return 'Either EAN13 or Product Code must be provided.';
    }
    if (ean13 && product_code) {
        return 'Provide either EAN13 or Product Code, not both.';
    }

    // Validate EAN13 format if provided
    if (ean13 && !/^\d{13}$/.test(ean13)) {
        return 'EAN13 must be exactly 13 digits.';
    }

    // Validate product_code format if provided
    if (product_code && product_code.toUpperCase() !== product_code) {
        return 'Product Code must be uppercase.';
    }

    return null;
};

// PUT /products/:id (Update an existing product)
app.put('/product/:id', (req, res) => {
    const productId = req.params.id;
    const { product_name, ean13, product_code, image_url, tags } = req.body;

    let nulled_ean13 = ean13 || null;
    let nulled_product_code = product_code || null;
    const validationError = validateProduct(nulled_ean13, nulled_product_code);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        db.exec('BEGIN TRANSACTION');

        const updateProductQuery = `
            UPDATE products
            SET name = ?, ean13 = ?, image_url = ?, product_code = ?
            WHERE id = ?
        `;
        const updateProductStatement = db.prepare(updateProductQuery);
        updateProductStatement.run(product_name, nulled_ean13, image_url, nulled_product_code, productId);

        //Clear their tags.
        const deleteProductTagsQuery = 'DELETE FROM product_tags WHERE product_id = ?';
        const deleteProductTagsStatement = db.prepare(deleteProductTagsQuery);
        deleteProductTagsStatement.run(productId);

        //Set new tags.
        if (tags) {
            const tagNames = tags.split(',').map(tag => tag.trim());
            for (const tagName of tagNames) {
                const selectTagQuery = 'SELECT id FROM tags WHERE name = ?';
                const selectTagStatement = db.prepare(selectTagQuery);
                const tag = selectTagStatement.get(tagName);

                if (tag) {
                    const insertProductTagQuery = 'INSERT INTO product_tags (product_id, tag_id) VALUES (?, ?)';
                    const insertProductTagStatement = db.prepare(insertProductTagQuery);
                    insertProductTagStatement.run(productId, tag.id);
                } else {
                    //If tag doesn't exist, you might want to handle this differently.  
                    //For example, create the tag or return an error.  This example skips it.
                    console.warn(`Tag "${tagName}" not found. Skipping.`);
                }
            }
        }

        db.exec('COMMIT');
        res.json({ message: 'Product updated successfully' });

    } catch (error) {
        db.exec('ROLLBACK');
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});


//a new product
//TODO: Add automatic getting of Name and ImageURL with HTTP Request.
app.post('/product', async (req, res) => {
    const { product_name, ean13, product_code, image_url, tags } = req.body;

    let nulled_ean13 = ean13 || null;
    let nulled_product_code = product_code || null;
    const validationError = validateProduct(nulled_ean13, nulled_product_code);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        // Start a transaction
        db.exec('BEGIN TRANSACTION');

        // Insert the new product into the products table
        const productQuery = `
            INSERT INTO products (ean13, product_code, name, image_url)
            VALUES (?, ?, ?, ?)
        `;
        const productParams = [nulled_ean13, nulled_product_code, product_name, image_url];
        const productStatement = db.prepare(productQuery);
        const productResult = productStatement.run(productParams);
        const productId = productResult.lastInsertRowid;


        // Insert tags into the tags table if they don't exist and associate them with the product
        if (tags) {
            const tagNames = tags.split(',').map(tag => tag.trim());
            for (const tagName of tagNames) {
                // Check if the tag already exists
                const tagQuery = 'SELECT id FROM tags WHERE name = ?';
                const tagStatement = db.prepare(tagQuery);
                const tag = tagStatement.get(tagName);

                if (!tag) {
                    // Insert new tag
                    const insertTagQuery = 'INSERT INTO tags (name) VALUES (?)';
                    const insertTagStatement = db.prepare(insertTagQuery);
                    const tagResult = insertTagStatement.run(tagName);
                    const tagId = tagResult.lastInsertRowid;
                    
                    // Associate the tag with the product
                    const productTagQuery = 'INSERT INTO product_tags (product_id, tag_id) VALUES (?, ?)';
                    const productTagStatement = db.prepare(productTagQuery);
                    productTagStatement.run(productId, tagId);

                } else {
                     // Associate the tag with the product
                    const productTagQuery = 'INSERT INTO product_tags (product_id, tag_id) VALUES (?, ?)';
                    const productTagStatement = db.prepare(productTagQuery);
                    productTagStatement.run(productId, tag.id);
                }
            }
        }

        // Commit the transaction
        db.exec('COMMIT');

        // Respond with the created product ID
        res.status(201).json({ productId });
    } catch (error) {
        // Rollback the transaction in case of error
        db.exec('ROLLBACK');
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//location,quantity,expiration_date,frozen_date
app.post('/item', (req, res) => {
    const { product_id, location_id, quantity, expiration_date, frozen_date, tags } = req.body;

    try {
        db.exec('BEGIN TRANSACTION');

        // 1. Check if the product exists (no creation here!)
        const productStmt = db.prepare('SELECT id FROM products WHERE id = ?'); // Use product_id directly
        const productResult = productStmt.get(product_id);

        if (!productResult) {
            db.exec('ROLLBACK');
            return res.status(400).json({ error: 'Product not found' }); // Return 400 if product doesn't exist
        }

        const productId = productResult.id; // Product exists, proceed

        // 2. Insert the item
        const itemStmt = db.prepare(
            `INSERT INTO items (product_id, location_id, quantity, expiration_date, frozen_date)
            VALUES (?, ?, ?, ?, ?)`
        );
        const itemResult = itemStmt.run(productId, location_id, quantity, expiration_date, frozen_date);
        const itemId = itemResult.lastInsertRowid;

        // 3. Handle tags (link to existing product)
        if (tags && tags.length > 0) {
            const tagNames = tags.split(',');
            tagNames.forEach(tagName => {
                const trimmedTagName = tagName.trim(); // Trim whitespace

                let tagId;
                let tagStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
                let tagResult = tagStmt.get(trimmedTagName);

                if (tagResult) {
                    tagId = tagResult.id;
                } else {
                    // Decide how to handle if the tag does not exist. Here I am returning an error.
                    db.exec('ROLLBACK');
                    return res.status(400).json({ error: `Tag ${trimmedTagName} not found` });
                }

                let productTagStmt = db.prepare('INSERT INTO product_tags (product_id, tag_id) VALUES (?, ?)');
                productTagStmt.run(productId, tagId);
            });
        }

        db.exec('COMMIT');
        res.json({ message: 'Item added successfully', itemId: itemId });

    } catch (error) {
        db.exec('ROLLBACK');
        console.error("Error adding item:", error);
        res.status(500).json({ error: 'Failed to add item' });
    }
});

// Start server
app.listen(3001, () => console.log('API running on port 3001'));

// Open Food Facts enrichment by EAN13
app.get('/openfoodfacts/:ean13', async (req, res) => {
    try {
        const { ean13 } = req.params;
        if (!ean13 || !/^\d{13}$/.test(ean13)) {
            return res.status(400).json({ error: 'Invalid EAN13' });
        }

        const url = `https://world.openfoodfacts.org/api/v0/product/${ean13}.json`;
        const response = await fetch(url, { headers: { 'User-Agent': 'kitchen-manager/1.0' } });
        if (!response.ok) {
            return res.status(502).json({ error: 'OpenFoodFacts unavailable' });
        }
        const data = await response.json();
        if (!data || data.status !== 1 || !data.product) {
            return res.status(404).json({ error: 'Product not found in OpenFoodFacts' });
        }

        const p = data.product;
        const name = p.product_name || p.generic_name || '';
        const image_url = p.image_front_url || p.image_url || '';
        const categoriesTags = Array.isArray(p.categories_tags) ? p.categories_tags : [];
        const labelsTags = Array.isArray(p.labels_tags) ? p.labels_tags : [];
        const tags = [...new Set([...categoriesTags, ...labelsTags])]
            .map(t => String(t).split(':').pop())
            .filter(Boolean)
            .map(s => s.replace(/[-_]/g, ' '))
            .map(s => s.toUpperCase())
            .slice(0, 12);

        return res.json({ name, image_url, tags });
    } catch (err) {
        console.error('OFF fetch error', err);
        return res.status(500).json({ error: 'Failed to fetch from OpenFoodFacts' });
    }
});