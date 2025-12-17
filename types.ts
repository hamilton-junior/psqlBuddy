
export interface Column {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: string; // e.g., "users.id"
}

export interface Table {
  name: string;
  schema: string; 
  type: 'table' | 'view'; // New field
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
  error?: string; 
  detailedError?: string; 
  errorLine?: number; 
  correctedSql?: string;
}

export interface OptimizationAnalysis {
  rating: number; 
  summary: string;
  explanation: string;
  suggestedIndexes: string[];
  optimizedSql: string;
  improvementDetails: string;
}

export interface QueryResult {
  sql: string;
  explanation: string;
  tips?: string[];
  validation?: ValidationResult;
  optimization?: OptimizationAnalysis;
}

export type AppStep = 'connection' | 'builder' | 'preview' | 'results' | 'dashboard' | 'datadiff';

export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface Filter {
  id: string;
  column: string;
  operator: Operator;
  value: string;
}

export type AggregateFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'NONE';

export interface CalculatedColumn {
  id: string;
  alias: string;
  expression: string;
}

export interface ExplicitJoin {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: JoinType;
}

export interface OrderBy {
  id: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface BuilderState {
  selectedTables: string[]; // "schema.table"
  selectedColumns: string[]; // "schema.table.column"
  calculatedColumns?: CalculatedColumn[];
  aggregations: Record<string, AggregateFunction>; // key is "schema.table.column"
  joins: ExplicitJoin[];
  filters: Filter[];
  groupBy: string[];
  orderBy: OrderBy[];
  limit: number;
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  queryResult?: QueryResult;
  isError?: boolean;
  mockData?: any[];
}

export interface AppSettings {
  theme: 'light' | 'dark';
  enableAiGeneration: boolean;
  enableAiValidation: boolean;
  enableAiTips: boolean;
  beginnerMode: boolean; 
  advancedMode: boolean; 
  aiGenerationTimeout: number; // ms
  defaultDbHost: string;
  defaultDbPort: string;
  defaultDbUser: string;
  defaultDbName: string;
  defaultLimit: number;
  defaultRowsPerPage: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  enableAiGeneration: true,
  enableAiValidation: true,
  enableAiTips: true,
  beginnerMode: true, 
  advancedMode: false, 
  aiGenerationTimeout: 3000,
  defaultDbHost: 'localhost',
  defaultDbPort: '5432',
  defaultDbUser: 'postgres',
  defaultDbName: '',
  defaultLimit: 100,
  defaultRowsPerPage: 10
};

export interface DashboardItem {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'area';
  data: any[];
  config: {
    xAxis: string;
    yKeys: string[];
  };
  sql: string;
  createdAt: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  createdAt: number;
  schemaName: string;
  state: BuilderState;
}

export interface QueryTemplate {
  id: string;
  name: string;
  sql: string;
  description?: string;
  parameters: string[]; 
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: number;
  rowCount: number;
  durationMs: number;
  status: 'success' | 'error';
  schemaName: string;
}

export interface ExplainNode {
  type: string;
  relation?: string;
  rows: number;
  width: number;
  cost: {
    startup: number;
    total: number;
  };
  children?: ExplainNode[];
}

export interface DiffRow {
  key: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  dataA?: any;
  dataB?: any;
  diffColumns: string[]; 
}

export interface VirtualRelation {
  id: string;
  sourceTable: string; 
  sourceColumn: string;
  targetTable: string; 
  targetColumn: string;
  confidence?: number; 
}

export const SAMPLE_SCHEMA: DatabaseSchema = {
  name: "ecommerce_super_store",
  connectionSource: "simulated",
  tables: [
    {
      name: "users",
      schema: "public",
      type: "table",
      description: "Usuários da plataforma (Clientes)",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "full_name", type: "VARCHAR(100)" },
        { name: "email", type: "VARCHAR(100)" },
        { name: "country", type: "VARCHAR(50)" },
        { name: "created_at", type: "TIMESTAMP" },
        { name: "is_active", type: "BOOLEAN" }
      ]
    },
    {
      name: "active_orders_view",
      schema: "public",
      type: "view",
      description: "View resumida de pedidos pendentes",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "user_name", type: "VARCHAR(100)" },
        { name: "total", type: "DECIMAL" }
      ]
    }
  ]
};
