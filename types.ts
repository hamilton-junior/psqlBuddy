

export interface Column {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: string; // e.g., "users.id"
}

export interface Table {
  name: string;
  schema: string; // New field for categorization
  columns: Column[];
  description?: string;
}

export interface DatabaseSchema {
  name: string;
  tables: Table[];
  connectionSource?: 'ai' | 'ddl' | 'simulated' | 'real';
}

export interface DbCredentials {
  host: string;
  port: string;
  user: string;
  password?: string;
  database: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string; // Short technical error
  detailedError?: string; // Longer, helpful explanation
  errorLine?: number; // The line number where the error likely occurred
  correctedSql?: string;
}

export interface QueryResult {
  sql: string;
  explanation: string;
  tips?: string[];
  validation?: ValidationResult;
}

export type AppStep = 'connection' | 'builder' | 'preview' | 'results' | 'dashboard';

export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface Filter {
  id: string;
  column: string;
  operator: Operator;
  value: string;
}

export interface ExplicitJoin {
  id: string;
  fromTable: string;
  fromColumn: string;
  type: JoinType;
  toTable: string;
  toColumn: string;
}

export interface OrderBy {
  id: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface CalculatedColumn {
  id: string;
  alias: string;
  expression: string; // e.g. "price * quantity"
}

export type AggregateFunction = 'NONE' | 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

export interface BuilderState {
  selectedTables: string[];
  selectedColumns: string[]; // Format: "tableName.columnName"
  calculatedColumns: CalculatedColumn[]; // NEW: Feature #5
  aggregations: Record<string, AggregateFunction>; // Format: { "tableName.columnName": "COUNT" }
  joins: ExplicitJoin[];
  filters: Filter[];
  groupBy: string[];
  orderBy: OrderBy[];
  limit: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  createdAt: number;
  schemaName: string; // To ensure we only load queries for the correct DB
  state: BuilderState;
}

export interface QueryHistoryItem {
  id: string;
  timestamp: number;
  sql: string;
  rowCount: number;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  schemaName: string;
}

// NEW: Feature #3 Dashboard
export interface DashboardItem {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'area' | 'kpi';
  data: any[];
  config: {
    xAxis: string;
    yKeys: string[];
  };
  sql: string;
  createdAt: number;
}

// NEW: Feature #2 Explain Plan
export interface ExplainNode {
  type: string; // e.g. "Seq Scan", "Index Scan"
  relation?: string;
  cost: { startup: number; total: number };
  rows: number;
  width: number;
  actual_rows?: number;
  actual_loops?: number;
  children?: ExplainNode[];
}

export interface AppSettings {
  theme: 'light' | 'dark';
  defaultDbHost: string;
  defaultDbPort: string;
  defaultDbUser: string;
  defaultDbName: string;
  defaultLimit: number;
  enableAiGeneration: boolean; // Master switch for AI
  enableAiValidation: boolean;
  enableAiTips: boolean;
  aiGenerationTimeout: number; // ms to show skip button
  defaultRowsPerPage: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  defaultDbHost: 'localhost',
  defaultDbPort: '5432',
  defaultDbUser: 'postgres',
  defaultDbName: '',
  defaultLimit: 100,
  enableAiGeneration: true,
  enableAiValidation: true,
  enableAiTips: true,
  aiGenerationTimeout: 3000,
  defaultRowsPerPage: 10
};

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  queryResult?: QueryResult;
  mockData?: any[];
  isError?: boolean;
}

export const SAMPLE_SCHEMA: DatabaseSchema = {
  name: "E-Commerce Sample",
  connectionSource: 'simulated',
  tables: [
    {
      name: "users",
      schema: "public",
      description: "Registered customers",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "email", type: "VARCHAR(255)" },
        { name: "created_at", type: "TIMESTAMP" },
        { name: "country", type: "VARCHAR(100)" }
      ]
    },
    {
      name: "orders",
      schema: "public",
      description: "Customer orders",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "user_id", type: "INTEGER", isForeignKey: true, references: "users.id" },
        { name: "total_amount", type: "DECIMAL(10,2)" },
        { name: "status", type: "VARCHAR(50)" },
        { name: "created_at", type: "TIMESTAMP" }
      ]
    },
    {
      name: "order_items",
      schema: "public",
      description: "Items within an order",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "order_id", type: "INTEGER", isForeignKey: true, references: "orders.id" },
        { name: "product_id", type: "INTEGER", isForeignKey: true, references: "products.id" },
        { name: "quantity", type: "INTEGER" },
        { name: "price_at_purchase", type: "DECIMAL(10,2)" }
      ]
    },
    {
      name: "products",
      schema: "public",
      description: "Product inventory",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "name", type: "VARCHAR(255)" },
        { name: "category", type: "VARCHAR(100)" },
        { name: "price", type: "DECIMAL(10,2)" },
        { name: "stock_level", type: "INTEGER" }
      ]
    }
  ]
};