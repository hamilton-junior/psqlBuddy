import { DatabaseSchema, DbCredentials } from "../types";

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