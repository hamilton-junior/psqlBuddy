
import { DatabaseSchema, BuilderState, Column } from '../types';

export type SimulationData = Record<string, any[]>;

// Constants for consistent data generation
const COUNTRIES = ['Brasil', 'USA', 'Portugal', 'Argentina', 'Canada'];
const CATEGORIES = ['Eletrônicos', 'Livros', 'Roupas', 'Casa', 'Esportes'];
const NAMES_FIRST = ['Ana', 'Bruno', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena'];
const NAMES_LAST = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Ferreira'];

// Helper to generate realistic-looking data based on column definition
const generateValue = (col: Column, index: number, rowCount: number): any => {
  const name = col.name.toLowerCase();
  const type = col.type.toLowerCase();

  // Handle IDs
  if (name === 'id') {
    return index + 1;
  }

  // Handle Foreign Keys (Simulate relationship to other tables usually size 20)
  if (name.endsWith('_id')) {
    // Return a random ID between 1 and rowCount (assuming 20 rows for other tables)
    return Math.floor(Math.random() * 20) + 1;
  }

  // Handle Boolean
  if (type.includes('bool')) {
    return index % 2 === 0;
  }

  // Handle Numbers
  if (type.includes('int') || type.includes('serial') || type.includes('number')) {
    if (name.includes('stock') || name.includes('qty') || name.includes('quantity')) {
      return Math.floor(Math.random() * 50) + 1;
    }
    return Math.floor(Math.random() * 1000);
  }
  
  if (type.includes('decimal') || type.includes('numeric') || type.includes('float') || name.includes('price') || name.includes('amount')) {
     return parseFloat((Math.random() * 1000).toFixed(2));
  }

  // Handle Dates
  if (type.includes('date') || type.includes('time')) {
    const date = new Date();
    // Spread dates over the last year
    date.setDate(date.getDate() - Math.floor(Math.random() * 365));
    if (type.includes('date') && !type.includes('time')) {
        return date.toISOString().split('T')[0];
    }
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  // Handle Strings (Context-aware based on name)
  if (name.includes('email')) return `user${index + 1}@example.com`;
  if (name.includes('name')) {
    if (name.includes('prod') || name.includes('item')) return `Produto ${String.fromCharCode(65 + (index % 5))} - ${index + 1}`;
    if (name.includes('first')) return NAMES_FIRST[index % NAMES_FIRST.length];
    if (name.includes('last')) return NAMES_LAST[index % NAMES_LAST.length];
    return `${NAMES_FIRST[index % NAMES_FIRST.length]} ${NAMES_LAST[index % NAMES_LAST.length]}`;
  }
  if (name.includes('phone') || name.includes('tel')) return `(11) 9${1000 + index}-${1000 + index}`;
  if (name.includes('address') || name.includes('rua')) return `Rua Exemplo, ${index * 10}`;
  if (name.includes('city') || name.includes('cidade')) return ['São Paulo', 'Rio de Janeiro', 'Curitiba', 'Belo Horizonte'][index % 4];
  if (name.includes('state') || name.includes('estado')) return ['SP', 'RJ', 'PR', 'MG'][index % 4];
  if (name.includes('country')) return COUNTRIES[index % COUNTRIES.length]; // Repeating for Group By
  if (name.includes('status')) return ['Ativo', 'Inativo', 'Pendente', 'Concluído'][index % 4];
  if (name.includes('category') || name.includes('categoria')) return CATEGORIES[index % CATEGORIES.length]; // Repeating for Group By
  if (name.includes('description')) return `Descrição detalhada do item ${index + 1}...`;

  // Default String
  return `Valor ${index + 1}`;
};

export const initializeSimulation = (schema: DatabaseSchema): SimulationData => {
  const data: SimulationData = {};
  
  // Generate ~20 rows for each table
  const rowCount = 20;

  schema.tables.forEach(table => {
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
      const row: any = {};
      table.columns.forEach(col => {
        row[col.name] = generateValue(col, i, rowCount);
      });
      rows.push(row);
    }
    data[table.name] = rows;
  });

  return data;
};

// --- Offline Query Engine Helpers ---

// Check if a row matches the filters
const rowMatchesFilters = (row: any, filters: any[]): boolean => {
  return filters.every(filter => {
    const [tbl, col] = filter.column.split('.');
    const rowVal = row[col] !== undefined ? row[col] : row[`${tbl}.${col}`]; // Handle aliased or flat keys
    
    // Safety check for null/undefined
    if (rowVal === undefined || rowVal === null) {
       return filter.operator === 'IS NULL';
    }

    const filterVal = filter.value;
    
    switch (filter.operator) {
      case '=': return String(rowVal) == String(filterVal);
      case '!=': return String(rowVal) != String(filterVal);
      case '>': return Number(rowVal) > Number(filterVal);
      case '<': return Number(rowVal) < Number(filterVal);
      case '>=': return Number(rowVal) >= Number(filterVal);
      case '<=': return Number(rowVal) <= Number(filterVal);
      case 'IS NULL': return rowVal === null;
      case 'IS NOT NULL': return rowVal !== null;
      case 'LIKE': 
      case 'ILIKE':
        return String(rowVal).toLowerCase().includes(String(filterVal).toLowerCase().replace(/%/g, ''));
      default: return true;
    }
  });
};

export const executeOfflineQuery = (
  schema: DatabaseSchema,
  data: SimulationData,
  state: BuilderState
): any[] => {
  const { selectedTables, selectedColumns, limit, aggregations, filters, groupBy, orderBy } = state;
  
  if (selectedTables.length === 0) return [];

  // 1. Flatten / Join Data
  // Start with primary table rows
  const primaryTable = selectedTables[0];
  let resultRows = data[primaryTable].map(row => {
    // Prefix keys with table name to avoid collisions
    const newRow: any = {};
    Object.keys(row).forEach(k => newRow[`${primaryTable}.${k}`] = row[k]);
    // Also keep short keys for primary table if unique, but prefixing is safer for joins
    return newRow;
  });

  // Simple Nested Loop Join for subsequent tables (Mock Logic)
  // Real implementation would look for FKs. Here we try to find a link.
  for (let i = 1; i < selectedTables.length; i++) {
    const targetTable = selectedTables[i];
    const targetData = data[targetTable] || [];
    
    // Find relationship in schema
    let joinColFrom = '';
    let joinColTo = '';
    
    // Check Forward: Primary (or previous) -> Target
    // Simple check: Look at all schema tables to find a FK link between any already joined table and target
    const joinedTables = selectedTables.slice(0, i);
    
    // Simplified Join Logic: Try to find common ID naming or schema FK definition
    // 1. Look for FK in Target pointing to Joined
    const targetSchema = schema.tables.find(t => t.name === targetTable);
    if (targetSchema) {
       for (const joinedT of joinedTables) {
          const fk = targetSchema.columns.find(c => c.isForeignKey && c.references?.startsWith(`${joinedT}.`));
          if (fk) {
             joinColTo = `${targetTable}.${fk.name}`; // foreign key in target
             joinColFrom = fk.references!; // primary key in source
             break;
          }
       }
    }

    // 2. Look for FK in Joined pointing to Target
    if (!joinColFrom) {
       for (const joinedT of joinedTables) {
          const joinedSchema = schema.tables.find(t => t.name === joinedT);
          if (joinedSchema) {
             const fk = joinedSchema.columns.find(c => c.isForeignKey && c.references?.startsWith(`${targetTable}.`));
             if (fk) {
                joinColFrom = `${joinedT}.${fk.name}`;
                joinColTo = fk.references!;
                break;
             }
          }
       }
    }

    // Perform Join
    if (joinColFrom && joinColTo) {
      const [tblFrom, colFrom] = joinColFrom.split('.');
      const [tblTo, colTo] = joinColTo.split('.');

      // Nested Loop Left Join
      resultRows = resultRows.map(existingRow => {
         const valFrom = existingRow[`${tblFrom}.${colFrom}`];
         const match = targetData.find(r => String(r[colTo]) === String(valFrom));
         
         if (match) {
            const joinedRow = { ...existingRow };
            Object.keys(match).forEach(k => joinedRow[`${targetTable}.${k}`] = match[k]);
            return joinedRow;
         } else {
            // Nulls for left join
            const joinedRow = { ...existingRow };
            const targetCols = targetSchema?.columns || [];
            targetCols.forEach(c => joinedRow[`${targetTable}.${c.name}`] = null);
            return joinedRow;
         }
      });
    } else {
       // Cartesian Product / Index Match Fallback (Simulated)
       // If no relation found, we just zip by index to show *something* rather than exploding results
       resultRows = resultRows.map((existingRow, idx) => {
          const match = targetData[idx % targetData.length]; // Loop around
          const joinedRow = { ...existingRow };
          Object.keys(match).forEach(k => joinedRow[`${targetTable}.${k}`] = match[k]);
          return joinedRow;
       });
    }
  }

  // 2. Filter
  if (filters.length > 0) {
     resultRows = resultRows.filter(row => rowMatchesFilters(row, filters));
  }

  // 3. Grouping & Aggregation
  const hasAggregations = Object.values(aggregations).some(a => a !== 'NONE');
  
  if (hasAggregations || groupBy.length > 0) {
     const groups: Record<string, any[]> = {};
     
     // Bucket rows
     resultRows.forEach(row => {
        const groupKey = groupBy.length > 0 
           ? groupBy.map(g => row[g]).join('::') 
           : 'ALL'; // Aggregate whole set if no group by
        
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(row);
     });

     // Calculate Aggregates per bucket
     resultRows = Object.keys(groups).map(key => {
        const rows = groups[key];
        const resultRow: any = {};
        
        // Add Group By Columns
        groupBy.forEach(g => {
           resultRow[g] = rows[0][g];
        });

        // Add Aggregated Columns OR Non-Aggregated selected columns (take first)
        selectedColumns.forEach(fullCol => {
           const agg = aggregations[fullCol];
           const [tbl, col] = fullCol.split('.');
           const dataKey = `${tbl}.${col}`;

           if (!agg || agg === 'NONE') {
              if (!resultRow[fullCol] && !resultRow[dataKey]) {
                 resultRow[fullCol] = rows[0][dataKey]; // Take first value
              }
           } else {
              const values = rows.map(r => r[dataKey]).filter(v => v !== null && v !== undefined);
              let val: any = 0;
              
              if (agg === 'COUNT') val = values.length;
              else if (agg === 'SUM') val = values.reduce((acc, curr) => acc + Number(curr), 0);
              else if (agg === 'AVG') val = values.length ? (values.reduce((acc, curr) => acc + Number(curr), 0) / values.length) : 0;
              else if (agg === 'MIN') val = values.length ? Math.min(...values.map(Number)) : null;
              else if (agg === 'MAX') val = values.length ? Math.max(...values.map(Number)) : null;
              
              // Format if decimal
              if ((agg === 'AVG' || agg === 'SUM') && val !== null && !Number.isInteger(val)) {
                 val = parseFloat(val.toFixed(2));
              }

              resultRow[`${agg.toLowerCase()}_${col}`] = val;
           }
        });
        
        return resultRow;
     });
  } else {
     // No Aggregation: Map to Output Format
     // If selectedColumns is empty, implies "SELECT *" logic
     let targetCols = selectedColumns;
     if (targetCols.length === 0) {
        // Grab all keys present in resultRows[0]
        if (resultRows.length > 0) targetCols = Object.keys(resultRows[0]);
     }

     resultRows = resultRows.map(row => {
        const cleanRow: any = {};
        targetCols.forEach(fullCol => {
           const [tbl, col] = fullCol.includes('.') ? fullCol.split('.') : [primaryTable, fullCol];
           const dataKey = fullCol.includes('.') ? fullCol : `${primaryTable}.${fullCol}`;
           
           cleanRow[col] = row[dataKey] !== undefined ? row[dataKey] : row[col];
        });
        return cleanRow;
     });
  }
  
  // 4. Order By (Simple)
  if (orderBy.length > 0) {
     const sort = orderBy[0]; // Simple single column sort for offline mode
     const colKey = aggregations[sort.column] 
        ? `${aggregations[sort.column]!.toLowerCase()}_${sort.column.split('.')[1]}` 
        : (sort.column.includes('.') ? sort.column.split('.')[1] : sort.column); // Try to match output key
     
     // Note: If grouping changed keys, sorting might be tricky. This is a best effort.
     resultRows.sort((a, b) => {
        const valA = a[colKey] !== undefined ? a[colKey] : a[sort.column];
        const valB = b[colKey] !== undefined ? b[colKey] : b[sort.column];
        
        if (valA < valB) return sort.direction === 'ASC' ? -1 : 1;
        if (valA > valB) return sort.direction === 'ASC' ? 1 : -1;
        return 0;
     });
  }

  // 5. Limit
  return resultRows.slice(0, limit || 100);
};
