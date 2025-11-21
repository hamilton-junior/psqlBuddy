import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Client } = pg;
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

console.log(`Starting server...`);

// Endpoint to test connection and fetch schema
app.post('/api/connect', async (req, res) => {
  console.log('--- Received connection request ---');
  const { host, port, user, database } = req.body;
  console.log(`Target: ${user}@${host}:${port}/${database}`);
  
  const client = new Client({
    host,
    port: parseInt(port),
    user,
    password: req.body.password,
    database,
    ssl: false,
    connectionTimeoutMillis: 5000 // Fail fast if unreachable
  });

  try {
    console.log('Attempting to connect to Postgres...');
    await client.connect();
    console.log('Connected successfully. Fetching schema...');

    // Query to extract schema information
    const schemaQuery = `
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        tc.constraint_type,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position;
    `;

    const result = await client.query(schemaQuery);
    console.log(`Schema query returned ${result.rows.length} rows.`);
    
    // Transform raw rows into the app's DatabaseSchema format
    const tablesMap = {};

    result.rows.forEach(row => {
      if (!tablesMap[row.table_name]) {
        tablesMap[row.table_name] = {
          name: row.table_name,
          columns: [],
          description: "" 
        };
      }

      // check if column already exists
      const existingCol = tablesMap[row.table_name].columns.find(c => c.name === row.column_name);
      if (existingCol) {
        if (row.constraint_type === 'PRIMARY KEY') existingCol.isPrimaryKey = true;
        if (row.constraint_type === 'FOREIGN KEY') {
          existingCol.isForeignKey = true;
          existingCol.references = `${row.foreign_table_name}.${row.foreign_column_name}`;
        }
        return;
      }

      tablesMap[row.table_name].columns.push({
        name: row.column_name,
        type: row.data_type,
        isPrimaryKey: row.constraint_type === 'PRIMARY KEY',
        isForeignKey: row.constraint_type === 'FOREIGN KEY',
        references: row.constraint_type === 'FOREIGN KEY' ? `${row.foreign_table_name}.${row.foreign_column_name}` : undefined
      });
    });

    const schema = {
      name: database,
      tables: Object.values(tablesMap),
      connectionSource: 'real'
    };

    console.log('Schema parsed successfully. Sending response.');
    res.json(schema);

  } catch (error) {
    console.error("CONNECTION ERROR:", error.message);
    res.status(500).json({ error: `Database Error: ${error.message}` });
  } finally {
    try {
      await client.end();
      console.log('Connection closed.');
    } catch (e) {
      // ignore close errors
    }
  }
});

// Endpoint to execute SQL
app.post('/api/execute', async (req, res) => {
  console.log('--- Received execution request ---');
  const { credentials, sql } = req.body;
  console.log(`Executing on ${credentials.database}: ${sql.substring(0, 50)}...`);
  
  const client = new Client({
    host: credentials.host,
    port: parseInt(credentials.port),
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
    ssl: false
  });

  try {
    await client.connect();
    const result = await client.query(sql);
    console.log(`Query successful. Returned ${result.rows.length} rows.`);
    res.json(result.rows);
  } catch (error) {
    console.error("QUERY ERROR:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Ready to accept connections.`);
});