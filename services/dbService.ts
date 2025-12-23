
import { DatabaseSchema, DbCredentials, ExplainNode, IntersectionResult } from "../types";

const API_URL = 'http://localhost:3000/api';

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

export const fetchIntersectionDetail = async (
  creds: DbCredentials, 
  tableA: string, 
  colA: string, 
  tableB: string, 
  colB: string
): Promise<IntersectionResult> => {
   if (creds.host === 'simulated') {
      await new Promise(r => setTimeout(r, 800));
      return {
         count: 15,
         sample: [1, 2, 3, 4, 5],
         tableA, columnA: colA,
         tableB, columnB: colB,
         matchPercentage: 75
      };
   }

   const countSql = `SELECT COUNT(DISTINCT A."${colA}") as count 
                     FROM ${tableA} A 
                     INNER JOIN ${tableB} B ON A."${colA}"::text = B."${colB}"::text`;
   
   const sampleSql = `SELECT DISTINCT A."${colA}" as val 
                      FROM ${tableA} A 
                      INNER JOIN ${tableB} B ON A."${colA}"::text = B."${colB}"::text 
                      LIMIT 20`;

   const [countRes, sampleRes] = await Promise.all([
      executeQueryReal(creds, countSql),
      executeQueryReal(creds, sampleSql)
   ]);

   return {
      count: parseInt(countRes[0].count),
      sample: sampleRes.map(r => r.val),
      tableA, columnA: colA,
      tableB, columnB: colB
   };
};

export const explainQueryReal = async (creds: DbCredentials, sql: string): Promise<ExplainNode> => {
   if (creds.host === 'simulated') {
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
      
      if (result && result.length > 0) {
         const planRow = result[0];
         const key = Object.keys(planRow).find(k => 
            k.toUpperCase() === 'QUERY PLAN' || 
            k.toUpperCase() === 'JSON' || 
            k.toUpperCase().includes('PLAN')
         );

         if (!key) throw new Error("Coluna 'QUERY PLAN' não encontrada no resultado do banco.");

         let planData = planRow[key];

         if (typeof planData === 'string') {
            try {
               planData = JSON.parse(planData);
            } catch (e) {
               throw new Error("Falha ao decodificar JSON do plano de execução.");
            }
         }

         if (Array.isArray(planData) && planData.length > 0 && planData[0].Plan) {
            return planData[0].Plan as ExplainNode;
         }
      }
      throw new Error("Formato de plano inválido retornado pelo banco.");
   } catch (e: any) {
      throw new Error("Falha ao gerar plano de execução: " + e.message);
   }
};
