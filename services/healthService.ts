
import { GoogleGenAI } from "@google/genai";
import { SAMPLE_SCHEMA } from "../types";
import { executeOfflineQuery, initializeSimulation } from "./simulationService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface HealthStatus {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  cause?: string;
  solution?: string;
}

export const runFullHealthCheck = async (): Promise<HealthStatus[]> => {
  const results: HealthStatus[] = [
    { id: 'gemini', name: 'Gemini AI API', status: 'pending' },
    { id: 'backend', name: 'Servidor Backend Local', status: 'pending' },
    { id: 'storage', name: 'Persistência Local (Storage)', status: 'pending' },
    { id: 'simulation', name: 'Motor de Simulação Offline', status: 'pending' }
  ];

  // 1. Storage Check
  try {
    const testKey = 'psql_buddy_health_test';
    localStorage.setItem(testKey, 'ok');
    if (localStorage.getItem(testKey) !== 'ok') throw new Error("Mismatch");
    localStorage.removeItem(testKey);
    results[2].status = 'success';
    results[2].message = 'Leitura e escrita funcionando perfeitamente.';
  } catch (e) {
    results[2].status = 'error';
    results[2].message = 'Falha ao acessar o LocalStorage do navegador.';
    results[2].cause = 'O navegador pode estar em modo privado ou com o armazenamento cheio.';
    results[2].solution = 'Desative o modo anônimo ou limpe o cache do site.';
  }

  // 2. Backend Check
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    // Ping only - assuming server.js is at 3000
    const res = await fetch('http://localhost:3000', { mode: 'no-cors', signal: controller.signal });
    clearTimeout(id);
    results[1].status = 'success';
    results[1].message = 'Backend detectado e respondendo.';
  } catch (e) {
    results[1].status = 'error';
    results[1].message = 'Não foi possível contatar o servidor local.';
    results[1].cause = 'O processo Node.js (server.js) não está rodando na porta 3000.';
    results[1].solution = 'Abra um novo terminal na pasta do projeto e execute: npm run server';
  }

  // 3. AI Check
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Respond with "ping"',
    });
    if (response.text?.toLowerCase().includes('ping')) {
      results[0].status = 'success';
      results[0].message = 'Conexão com Gemini AI estabelecida.';
    } else {
      throw new Error("Unexpected response");
    }
  } catch (e: any) {
    results[0].status = 'error';
    results[0].message = 'Falha na comunicação com a API do Google.';
    results[0].cause = 'Chave de API inválida, sem conexão com internet ou cota excedida.';
    results[0].solution = 'Verifique seu arquivo .env e sua conexão com a internet.';
  }

  // 4. Simulation Check
  try {
    const simData = initializeSimulation(SAMPLE_SCHEMA);
    const mockState: any = {
      selectedTables: [Object.keys(simData)[0]],
      selectedColumns: [],
      aggregations: {},
      joins: [],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: 5
    };
    const testData = executeOfflineQuery(SAMPLE_SCHEMA, simData, mockState);
    if (testData.length > 0) {
      results[3].status = 'success';
      results[3].message = 'Gerador de dados fictícios operacional.';
    } else {
      throw new Error("No data");
    }
  } catch (e) {
    results[3].status = 'error';
    results[3].message = 'Erro interno no motor de simulação.';
    results[3].cause = 'Inconsistência nos tipos de dados do SAMPLE_SCHEMA.';
    results[3].solution = 'Recarregue a aplicação para reiniciar o estado global.';
  }

  return results;
};
