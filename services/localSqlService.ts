
import { BuilderState, DatabaseSchema, QueryResult, ExplicitJoin } from '../types';

export const generateLocalSql = (schema: DatabaseSchema, state: BuilderState): QueryResult => {
  const { selectedTables, selectedColumns, aggregations, joins, filters, groupBy, orderBy, limit } = state;

  if (selectedTables.length === 0) {
    throw new Error("Nenhuma tabela selecionada.");
  }

  // --- 1. SELECT Clause ---
  let selectClause = "*";
  if (selectedColumns.length > 0) {
    selectClause = selectedColumns.map(col => {
      const agg = aggregations[col];
      if (agg && agg !== 'NONE') {
        const alias = `${agg.toLowerCase()}_${col.split('.')[1]}`;
        return `${agg}(${col}) AS ${alias}`;
      }
      return col;
    }).join(',\n  ');
  }

  // --- 2. FROM & JOIN Clause ---
  const primaryTable = selectedTables[0];
  let fromClause = `FROM ${primaryTable}`;
  const joinedTables = new Set<string>([primaryTable]);
  let joinClauses: string[] = [];

  // 2a. Process Explicit Joins first
  joins.forEach(join => {
    // Only process if both tables are in the selection list to avoid weird partial SQL
    if (selectedTables.includes(join.fromTable) && selectedTables.includes(join.toTable)) {
       joinClauses.push(`${join.type} JOIN ${join.toTable} ON ${join.fromTable}.${join.fromColumn} = ${join.toTable}.${join.toColumn}`);
       joinedTables.add(join.fromTable);
       joinedTables.add(join.toTable);
    }
  });

  // 2b. Implicit Auto-Join (Local FK Logic) for tables not yet joined
  // If user didn't specify a join but selected multiple tables, try to find a FK link
  const tablesToAutoJoin = selectedTables.filter(t => !joinedTables.has(t) && t !== primaryTable);
  
  // Also check if any of the "joinedTables" need to be linked to each other but weren't explicit
  // Simple Strategy: Try to link remaining tables to the primary table or already joined tables
  const remainingTables = selectedTables.filter(t => t !== primaryTable);
  
  remainingTables.forEach(targetTable => {
    // Check if we already covered this in explicit joins
    const alreadyExplicitlyJoined = joins.some(j => 
      (j.fromTable === targetTable && joinedTables.has(j.toTable)) || 
      (j.toTable === targetTable && joinedTables.has(j.fromTable))
    );

    if (!alreadyExplicitlyJoined) {
       // Look for FK in Schema
       let foundLink = false;
       
       // Try to find a link from an existing table TO the target table
       for (const existingTable of Array.from(joinedTables)) {
          const tSchema = schema.tables.find(t => t.name === existingTable);
          if (tSchema) {
             const fkCol = tSchema.columns.find(c => c.isForeignKey && c.references?.startsWith(`${targetTable}.`));
             if (fkCol && fkCol.references) {
                joinClauses.push(`LEFT JOIN ${targetTable} ON ${existingTable}.${fkCol.name} = ${fkCol.references}`);
                joinedTables.add(targetTable);
                foundLink = true;
                break;
             }
          }
       }

       // If not found, try to find a link FROM the target table TO an existing table
       if (!foundLink) {
          const targetSchema = schema.tables.find(t => t.name === targetTable);
          if (targetSchema) {
             for (const existingTable of Array.from(joinedTables)) {
                const fkCol = targetSchema.columns.find(c => c.isForeignKey && c.references?.startsWith(`${existingTable}.`));
                if (fkCol && fkCol.references) {
                   joinClauses.push(`LEFT JOIN ${targetTable} ON ${targetTable}.${fkCol.name} = ${fkCol.references}`);
                   joinedTables.add(targetTable);
                   foundLink = true;
                   break;
                }
             }
          }
       }

       // Fallback: Cross Join (Comma) if no relationship found, but usually standard builders prefer explicit Cross Join or leave it for user.
       // We will just append it to FROM if it's completely disconnected, essentially a cross join.
       if (!foundLink) {
          // This creates a Cartesian product, but it's valid SQL behavior for "SELECT * FROM A, B"
          // We'll treat it as a separate FROM entry or CROSS JOIN
          // Using comma notation for simplicity in "Manual Mode"
          // However, to keep standard format:
          fromClause += `, ${targetTable}`;
       }
    }
  });


  // --- 3. WHERE Clause ---
  let whereClause = "";
  if (filters.length > 0) {
    const conditions = filters.map(f => {
      if (f.operator === 'IS NULL' || f.operator === 'IS NOT NULL') {
        return `${f.column} ${f.operator}`;
      }
      const val = !isNaN(Number(f.value)) ? f.value : `'${f.value}'`; // Simple quote logic
      return `${f.column} ${f.operator} ${val}`;
    });
    whereClause = `WHERE ${conditions.join(' AND ')}`;
  }

  // --- 4. GROUP BY ---
  let groupByClause = "";
  if (groupBy.length > 0) {
    groupByClause = `GROUP BY ${groupBy.join(', ')}`;
  }

  // --- 5. ORDER BY ---
  let orderByClause = "";
  if (orderBy.length > 0) {
    const orders = orderBy.map(o => `${o.column} ${o.direction}`);
    orderByClause = `ORDER BY ${orders.join(', ')}`;
  }

  // --- Assembly ---
  const sql = `SELECT ${selectClause}
${fromClause}
${joinClauses.length > 0 ? joinClauses.join('\n') : ''}
${whereClause}
${groupByClause}
${orderByClause}
LIMIT ${limit};`.trim(); // Remove empty lines if logic allows, but strict templates usually ok.

  // Remove multiple newlines
  const cleanSql = sql.replace(/\n\s*\n/g, '\n');

  return {
    sql: cleanSql,
    explanation: "Consulta gerada localmente baseada na sua seleção manual. O modo offline não fornece explicações detalhadas de lógica.",
    tips: [] // No tips in local mode
  };
};
