

import { DatabaseSchema, DbCredentials, ExplainNode } from "../types";

const API_URL = 'http://localhost:3000/api';

// ... (Existing Connect/Execute) ...

export const connectToDatabase = async (creds: DbCredentials): Promise<DatabaseSchema> => {
  try {
    const response = await fetch(`${API_URL}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to connect');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error("Cannot reach backend server (localhost:3000). Run 'npm run server' in a separate terminal.");
    }
    throw error;
  }
};

export const executeQueryReal = async (creds: DbCredentials, sql: string): Promise<any[]> => {
  try {
    const response = await fetch(`${API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: creds, sql })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to execute query');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error("Backend server is unreachable.");
    }
    throw error;
  }
};

// NEW: Feature #2 Explain Plan
export const explainQueryReal = async (creds: DbCredentials, sql: string): Promise<ExplainNode> => {
   if (creds.host === 'simulated') {
      // Return a Mock Plan for offline mode
      await new Promise(r => setTimeout(r, 600));
      return {
         type: "Result",
         cost: { startup: 0.00, total: 10.00 },
         rows: 100,
         width: 4,
         children: [
            {
               type: "Seq Scan",
               relation: "simulated_table",
               cost: { startup: 0.00, total: 10.00 },
               rows: 100,
               width: 4
            }
         ]
      };
   }

   const explainSql = `EXPLAIN (FORMAT JSON, ANALYZE) ${sql}`;
   
   try {
      const result = await executeQueryReal(creds, explainSql);
      // Postgres returns: [ { "QUERY PLAN": [ { ... } ] } ]
      // We need to parse this safely
      if (result && result.length > 0) {
         // The key might differ depending on driver/version, usually "QUERY PLAN" or "Plan"
         const planRow = result[0];
         const planJson = planRow['QUERY PLAN'] || planRow['Plan']; // Check both
         if (planJson && planJson[0] && planJson[0].Plan) {
            return planJson[0].Plan as ExplainNode;
         }
         // Sometimes it returns the array directly
         if (Array.isArray(planJson) && planJson[0].Plan) {
            return planJson[0].Plan;
         }
      }
      throw new Error("Formato de plano inválido retornado pelo banco.");
   } catch (e: any) {
      console.error("Explain Error:", e);
      throw new Error("Falha ao gerar plano de execução: " + e.message);
   }
};