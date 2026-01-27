
import { GoogleGenAI, Type } from "@google/genai";
import { DatabaseSchema, QueryResult, BuilderState, ServerStats, ActiveProcess } from "../types";

const cleanJsonString = (str: string): string => {
  if (!str) return "[]";
  return str.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
};

const getEffectiveApiKey = (): string => {
  try {
    const settingsStr = localStorage.getItem('psqlBuddy-settings');
    if (settingsStr) {
      const settings = JSON.parse(settingsStr);
      if (settings.geminiApiKey && settings.geminiApiKey.trim() !== '') {
        console.log("[GEMINI_SERVICE] Utilizando API Key fornecida pelo usuário.");
        return settings.geminiApiKey;
      }
    }
  } catch (e) {
    console.warn("[GEMINI_SERVICE] Falha ao ler API Key das configurações:", e);
  }
  console.log("[GEMINI_SERVICE] Utilizando API Key padrão do ambiente.");
  return process.env.API_KEY || "";
};

export const getHealthDiagnosis = async (stats: ServerStats, processes: ActiveProcess[]): Promise<string> => {
  console.log("[GEMINI_SERVICE] Iniciando diagnóstico de saúde do servidor...");
  const key = getEffectiveApiKey();
  if (!key) throw new Error("MISSING_API_KEY");

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `
    Como um DBA Sênior PostgreSQL, analise a telemetria atual do servidor:
    
    METRICAS:
    - Conexões Ativas: ${stats.connections}
    - Tamanho: ${stats.dbSize}
    - Cache Hit Rate: ${stats.cacheHitRate}
    - Query mais longa: ${stats.maxQueryDuration}
    
    PROCESSOS CRITICOS (PID/User/Duration/State/BlockedBy):
    ${processes.slice(0, 10).map(p => `${p.pid} | ${p.user} | ${p.duration} | ${p.state} | ${p.blockingPids.length ? p.blockingPids.join(',') : 'None'}`).join('\n')}
    
    FORNEÇA:
    1. Resumo rápido da saúde.
    2. Identificação de gargalos (se houver).
    3. Próximos passos recomendados (ex: rodar vacuum, criar índice, matar PID X).
    
    Use Markdown. Responda em Português. Seja direto.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    console.log("[GEMINI_SERVICE] Diagnóstico gerado com sucesso.");
    return response.text || "Não foi possível gerar um diagnóstico.";
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro ao gerar diagnóstico:", e);
    throw e;
  }
};

export const generateSqlFromBuilderState = async (schema: DatabaseSchema, state: BuilderState, includeTips: boolean = true): Promise<QueryResult> => {
  console.log("[GEMINI_SERVICE] Gerando SQL a partir do estado do builder...");
  const key = getEffectiveApiKey();
  if (!key) throw new Error("MISSING_API_KEY");

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `
    Gere uma query SQL PostgreSQL baseada neste estado: ${JSON.stringify(state)}.
    Contexto do Schema: ${JSON.stringify(schema.tables.map(t => ({ name: t.name, cols: t.columns.map(c => c.name) })))}.
    
    Retorne apenas um JSON com os campos:
    - sql: A query final
    - explanation: Explicação curta da lógica
    - tips: Array de strings com dicas de performance se aplicável
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    console.log("[GEMINI_SERVICE] SQL gerado com sucesso.");
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro ao gerar SQL:", e);
    throw e;
  }
};

export const analyzeQueryPerformance = async (schema: DatabaseSchema, sql: string): Promise<any> => {
  console.log("[GEMINI_SERVICE] Analisando performance da query...");
  const key = getEffectiveApiKey();
  if (!key) throw new Error("MISSING_API_KEY");

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `
    Analise a performance desta query SQL: "${sql}".
    Schema: ${JSON.stringify(schema.tables.map(t => ({ name: t.name, cols: t.columns.map(c => c.name) })))}.
    Retorne um JSON com:
    - rating: número de 0 a 100
    - summary: resumo curto
    - explanation: explicação detalhada
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro na análise de performance:", e);
    throw e;
  }
};

export const analyzeLog = async (schema: DatabaseSchema, logText: string): Promise<{ sql: string, explanation: string }> => {
  console.log("[GEMINI_SERVICE] Analisando log de erro...");
  const key = getEffectiveApiKey();
  if (!key) throw new Error("MISSING_API_KEY");

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `
    Analise este log de erro de banco de dados: "${logText}".
    Sugira uma query SQL para investigar ou corrigir o problema baseado neste schema: ${JSON.stringify(schema.tables.map(t => ({ name: t.name, cols: t.columns.map(c => c.name) })))}.
    Retorne JSON: { "sql": "...", "explanation": "..." }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro na análise de log:", e);
    throw e;
  }
};

export const generateBuilderStateFromPrompt = async (schema: DatabaseSchema, userPrompt: string): Promise<Partial<BuilderState>> => {
  console.log("[GEMINI_SERVICE] Magic Fill: Convertendo prompt em estado de builder...");
  const key = getEffectiveApiKey();
  if (!key) throw new Error("MISSING_API_KEY");

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `
    Converta este pedido do usuário em um estado de BuilderState JSON: "${userPrompt}".
    Schema disponível: ${JSON.stringify(schema.tables.map(t => ({ name: t.name, cols: t.columns.map(c => c.name) })))}.
    Use IDs de colunas no formato 'schema.tabela.coluna'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro no Magic Fill:", e);
    throw e;
  }
};

export const validateSqlQuery = async (sql: string, schema?: DatabaseSchema): Promise<any> => { return { isValid: true }; };
export const fixSqlError = async (sql: string, errorMessage: string, schema: DatabaseSchema): Promise<string> => { return sql; };
export const suggestRelationships = async (schema: DatabaseSchema): Promise<any[]> => { return []; };
export const generateSchemaFromTopic = async (topic: string, context: string): Promise<DatabaseSchema> => {
  console.log("[GEMINI_SERVICE] Gerando schema simulado para o tópico:", topic);
  const key = getEffectiveApiKey();
  if (!key) throw new Error("MISSING_API_KEY");

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `Gere um schema de banco de dados PostgreSQL simulado para: "${topic}". Contexto: "${context}". Retorne apenas JSON seguindo a estrutura de DatabaseSchema.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro ao gerar schema simulado:", e);
    throw e;
  }
};

export const parseSchemaFromDDL = async (ddl: string): Promise<DatabaseSchema> => { return { name: '', tables: [] }; };
export const extractSqlFromLogs = async (logText: string): Promise<string[]> => {
  console.log("[GEMINI_SERVICE] Extraindo queries de logs...");
  const key = getEffectiveApiKey();
  if (!key) throw new Error("MISSING_API_KEY");

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `Extraia todas as queries SQL válidas deste texto: "${logText}". Retorne um array JSON de strings.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro ao extrair SQL:", e);
    throw e;
  }
};
