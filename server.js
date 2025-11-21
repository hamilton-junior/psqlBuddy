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
    console.log("Attempting to connect to Postgres...");
    await client.connect();
    console.log("Connected successfully. Fetching schema...");

    // Query to extract schema information (optimized)
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const columnsQuery = `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `;
    const pkQuery = `
      SELECT
        kcu.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';
    `;
    const fkQuery = `
      SELECT
        kcu.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `;

    const [tablesRes, columnsRes, pkRes, fkRes] = await Promise.all([
      client.query(tablesQuery),
      client.query(columnsQuery),
      client.query(pkQuery),
      client.query(fkQuery),
    ]);

    // Build schema
    const tablesMap = {};
    tablesRes.rows.forEach((row) => {
      tablesMap[row.table_name] = {
        name: row.table_name,
        columns: [],
        description: "",
      };
    });

    columnsRes.rows.forEach((row) => {
      if (tablesMap[row.table_name]) {
        tablesMap[row.table_name].columns.push({
          name: row.column_name,
          type: row.data_type,
          isPrimaryKey: false,
          isForeignKey: false,
          references: undefined,
        });
      }
    });

    pkRes.rows.forEach((row) => {
      if (tablesMap[row.table_name] && tablesMap[row.table_name].columns) {
        const col = tablesMap[row.table_name].columns.find(
          (c) => c.name === row.column_name
        );
        if (col) col.isPrimaryKey = true;
      }
    });

    fkRes.rows.forEach((row) => {
      if (tablesMap[row.table_name] && tablesMap[row.table_name].columns) {
        const col = tablesMap[row.table_name].columns.find(
          (c) => c.name === row.column_name
        );
        if (col) {
          col.isForeignKey = true;
          col.references = `${row.foreign_table_name}.${row.foreign_column_name}`;
        }
      }
    });

    const schema = {
      name: database,
      tables: Object.values(tablesMap),
      connectionSource: "real",
    };

    console.log("Schema parsed successfully. Sending response.");
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