import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Client } = pg;
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

console.log(`Starting server...`);

// Helper to handle encoding errors automatically with multiple fallbacks
async function queryWithFallback(client, sql, params = []) {
  try {
    return await client.query(sql, params);
  } catch (error) {
    // Code 22021: character_not_in_repertoire / invalid_byte_sequence
    // Check message text for generic encoding errors (case insensitive)
    const errorMsg = error.message ? error.message.toLowerCase() : '';
    const isEncodingError = 
      error.code === '22021' || 
      errorMsg.includes('invalid byte sequence') ||
      errorMsg.includes('encoding') ||
      errorMsg.includes('utf8');

    if (isEncodingError) {
      console.warn(`[Encoding Fix] Error detected: ${error.message}`);
      
      // Attempt 1: WIN1252 (Common in legacy BR systems - Fixes 0xc7 (Ç) 0xc3 (Ã) issues)
      try {
        console.warn(`[Encoding Fix] Switching client_encoding to 'WIN1252' and retrying...`);
        await client.query("SET client_encoding TO 'WIN1252'");
        return await client.query(sql, params);
      } catch (retryError) {
        // Attempt 2: LATIN1 (ISO-8859-1)
        console.warn(`[Encoding Fix] WIN1252 failed. Switching to 'LATIN1' and retrying...`);
        try {
           await client.query("SET client_encoding TO 'LATIN1'");
           return await client.query(sql, params);
        } catch (finalError) {
           console.error(`[Encoding Fix] All encoding fallbacks failed.`);
           throw finalError;
        }
      }
    }
    throw error;
  }
}

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

    // OPTIMIZED QUERY: Fetches Tables, Columns, PKs, and FKs in a SINGLE round-trip.
    // This is significantly faster for databases with many tables than doing 4 separate queries.
    const unifiedSchemaQuery = `
      SELECT
        t.table_name,
        c.column_name,
        c.data_type,
        
        -- Check if Primary Key
        CASE WHEN pk.constraint_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        
        -- Check if Foreign Key and get target
        CASE WHEN fk.constraint_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
        fk.foreign_table_name,
        fk.foreign_column_name

      FROM information_schema.tables t
      JOIN information_schema.columns c
        ON t.table_name = c.table_name
        AND t.table_schema = c.table_schema

      -- Left Join to identify Primary Keys
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name

      -- Left Join to identify Foreign Keys
      LEFT JOIN (
        SELECT
          kcu.table_name,
          kcu.column_name,
          tc.constraint_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
      ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name

      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position;
    `;

    const result = await queryWithFallback(client, unifiedSchemaQuery);

    // Process the flat result set into the hierarchical structure required by the frontend
    const tablesMap = {};

    result.rows.forEach(row => {
      // Initialize table if not exists
      if (!tablesMap[row.table_name]) {
        tablesMap[row.table_name] = {
          name: row.table_name,
          columns: [],
          description: "" // Information schema doesn't provide standard descriptions easily in this view
        };
      }

      // Add column
      tablesMap[row.table_name].columns.push({
        name: row.column_name,
        type: row.data_type,
        isPrimaryKey: row.is_primary_key,
        isForeignKey: row.is_foreign_key,
        references: row.is_foreign_key ? `${row.foreign_table_name}.${row.foreign_column_name}` : undefined
      });
    });

    const schema = {
      name: database,
      tables: Object.values(tablesMap),
      connectionSource: "real",
    };

    console.log(`Schema parsed successfully. Found ${schema.tables.length} tables.`);
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
    
    // Use the fallback wrapper which now handles WIN1252 and LATIN1 automatically
    const result = await queryWithFallback(client, sql);
    
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