
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

console.log(`Starting server...`);

async function queryWithFallback(client, sql, params = []) {
  try {
    return await client.query(sql, params);
  } catch (error) {
    const errorMsg = error.message ? error.message.toLowerCase() : '';
    const isEncodingError = 
      error.code === '22021' || 
      errorMsg.includes('invalid byte sequence') ||
      errorMsg.includes('encoding');

    if (isEncodingError) {
      console.warn('Encoding error detected. Attempting fallback to LATIN1...');
      try {
        await client.query("SET CLIENT_ENCODING TO 'LATIN1'");
        return await client.query(sql, params);
      } catch (retryError) {
        throw retryError; 
      }
    }
    throw error;
  }
}

app.post('/api/connect', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  
  if (!host || !port || !user || !database) {
    return res.status(400).json({ error: 'Missing connection details' });
  }

  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    connectionTimeoutMillis: 5000, 
  });

  try {
    await client.connect();
    
    const tablesQuery = `
      SELECT 
        table_schema, 
        table_name, 
        table_type,
        obj_description((table_schema || '.' || table_name)::regclass) as description
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_schema, table_name;
    `;
    const tablesRes = await queryWithFallback(client, tablesQuery);

    const columnsQuery = `
      SELECT 
        c.table_schema, 
        c.table_name, 
        c.column_name, 
        c.data_type,
        (
          SELECT COUNT(*) > 0 
          FROM information_schema.key_column_usage kcu
          JOIN information_schema.table_constraints tc 
            ON kcu.constraint_name = tc.constraint_name 
            AND kcu.table_schema = tc.table_schema
          WHERE kcu.table_name = c.table_name 
            AND kcu.column_name = c.column_name
            AND tc.constraint_type = 'PRIMARY KEY'
        ) as is_primary
      FROM information_schema.columns c
      WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY c.ordinal_position;
    `;
    const columnsRes = await queryWithFallback(client, columnsQuery);

    const fkQuery = `
      SELECT
          tc.table_schema, 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY';
    `;
    const fkRes = await queryWithFallback(client, fkQuery);

    const tables = tablesRes.rows.map(t => {
      const tableCols = columnsRes.rows
        .filter(c => c.table_name === t.table_name && c.table_schema === t.table_schema)
        .map(c => {
          const fk = fkRes.rows.find(f => 
            f.table_name === t.table_name && 
            f.table_schema === t.table_schema && 
            f.column_name === c.column_name
          );

          return {
            name: c.column_name,
            type: c.data_type,
            isPrimaryKey: !!c.is_primary,
            isForeignKey: !!fk,
            references: fk ? `${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}` : undefined
          };
        });

      return {
        name: t.table_name,
        schema: t.table_schema,
        type: t.table_type === 'VIEW' ? 'view' : 'table',
        description: t.description,
        columns: tableCols
      };
    });

    res.json({
      name: database,
      tables: tables
    });

  } catch (err) {
    console.error('Connection error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    try { await client.end(); } catch (e) {}
  }
});

app.post('/api/execute', async (req, res) => {
  const { credentials, sql } = req.body;
  
  if (!credentials || !sql) {
    return res.status(400).json({ error: 'Missing credentials or SQL' });
  }

  const client = new Client(credentials);

  try {
    await client.connect();
    const result = await queryWithFallback(client, sql);
    if (Array.isArray(result)) {
        res.json(result[result.length - 1].rows); 
    } else {
        res.json(result.rows);
    }
  } catch (err) {
    console.error('Execution error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    try { await client.end(); } catch (e) {}
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
