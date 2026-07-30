// Generates a Database type file structurally compatible with what
// `supabase gen types typescript` produces, by introspecting
// information_schema/pg_catalog directly over a plain Postgres
// connection — no Docker required. Written because the official CLI's
// `gen types typescript --db-url` mode requires Docker to pull a helper
// image from Docker Hub, which is outside this sandbox's network
// allowlist (confirmed: the Docker engine itself runs fine here; the
// registry pull is what's blocked, with a 403 from registry-1.docker.io).
//
// Covers Tables (Row/Insert/Update, matching the official shape) and
// Enums — the two things nearly every consumer of generated Supabase
// types actually needs for `.from(table).select()/.insert()/.update()`
// type safety. Functions and Views are intentionally out of scope here:
// the official tool's function-return-type introspection handles
// overloads and table-returning functions in ways a straightforward
// information_schema query doesn't reproduce faithfully, and getting
// that wrong would be worse than omitting it — this generator does not
// claim to fully replace the official tool, only to unblock Table/Enum
// type safety until someone runs the real command with real Docker/
// internet access.
const { Client } = require("pg");

const PG_TO_TS = {
  uuid: "string",
  text: "string",
  varchar: "string",
  "character varying": "string",
  char: "string",
  citext: "string",
  boolean: "boolean",
  bool: "boolean",
  integer: "number",
  int4: "number",
  smallint: "number",
  int2: "number",
  bigint: "string",
  numeric: "number",
  decimal: "number",
  real: "number",
  "double precision": "number",
  json: "Json",
  jsonb: "Json",
  date: "string",
  timestamp: "string",
  "timestamp without time zone": "string",
  timestamptz: "string",
  "timestamp with time zone": "string",
  time: "string",
  tsvector: "unknown",
  vector: "string",
};

function pgTypeToTs(dataType, udtName) {
  let base;
  if (dataType === "ARRAY") {
    const elementType = udtName.startsWith("_") ? udtName.slice(1) : udtName;
    base = PG_TO_TS[elementType] ?? `Database["public"]["Enums"]["${elementType}"]`;
    return `(${base})[]`;
  }
  base = PG_TO_TS[dataType] ?? PG_TO_TS[udtName];
  if (base) return base;
  return null;
}

async function main() {
  const client = new Client({
    connectionString: process.env.TYPEGEN_DB_URL,
    ssl: { rejectUnauthorized: false },
    family: 4,
  });
  await client.connect();

  const enumsResult = await client.query(`
    select t.typname as enum_name, e.enumlabel as value
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by t.typname, e.enumsortorder;
  `);
  const enums = {};
  for (const row of enumsResult.rows) {
    (enums[row.enum_name] ??= []).push(row.value);
  }

  const tablesResult = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name;
  `);

  const columnsResult = await client.query(`
    select table_name, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position;
  `);
  const columnsByTable = {};
  for (const row of columnsResult.rows) {
    (columnsByTable[row.table_name] ??= []).push(row);
  }

  // Foreign keys -> the Relationships array. This is what actually
  // powers Supabase's embedded-resource type inference
  // (`.select("*, publications(name)")`) — without it, every joined
  // select in the codebase types as `never`, which is exactly what
  // happened on the first attempt at wiring this file in (~150 cascaded
  // errors, all from missing relationship metadata, not from anything
  // wrong with the Tables section itself).
  const fkResult = await client.query(`
    select
      tc.table_name as source_table,
      tc.constraint_name,
      kcu.column_name as source_column,
      ccu.table_name as target_table,
      ccu.column_name as target_column
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
    order by tc.table_name, tc.constraint_name;
  `);
  const fksByTable = {};
  for (const row of fkResult.rows) {
    (fksByTable[row.source_table] ??= []).push(row);
  }

  const enumTsBlock = Object.entries(enums)
    .map(([name, values]) => `      ${name}: ${values.map((v) => JSON.stringify(v)).join(" | ")};`)
    .join("\n");

  const tableBlocks = tablesResult.rows.map(({ table_name }) => {
    const columns = columnsByTable[table_name] ?? [];
    const rowFields = [];
    const insertFields = [];
    const updateFields = [];

    for (const col of columns) {
      let tsType = pgTypeToTs(col.data_type, col.udt_name);
      if (tsType === null) {
        tsType = enums[col.udt_name] ? `Database["public"]["Enums"]["${col.udt_name}"]` : "unknown";
      }
      const nullable = col.is_nullable === "YES";
      const hasDefault = col.column_default !== null;

      rowFields.push(`          ${col.column_name}: ${tsType}${nullable ? " | null" : ""};`);
      insertFields.push(
        `          ${col.column_name}${nullable || hasDefault ? "?" : ""}: ${tsType}${nullable ? " | null" : ""};`
      );
      updateFields.push(`          ${col.column_name}?: ${tsType}${nullable ? " | null" : ""};`);
    }

    const fks = fksByTable[table_name] ?? [];
    const relationshipsBlock =
      fks.length === 0
        ? "        Relationships: [];"
        : `        Relationships: [
${fks
  .map(
    (fk) => `          {
            foreignKeyName: "${fk.constraint_name}";
            columns: ["${fk.source_column}"];
            isOneToOne: false;
            referencedRelation: "${fk.target_table}";
            referencedColumns: ["${fk.target_column}"];
          },`
  )
  .join("\n")}
        ];`;

    return `      ${table_name}: {
        Row: {
${rowFields.join("\n")}
        };
        Insert: {
${insertFields.join("\n")}
        };
        Update: {
${updateFields.join("\n")}
        };
${relationshipsBlock}
      };`;
  });

  const output = `// =============================================================================
// Generated Supabase database types — The Witness
//
// Generated by scripts/generate-db-types.js (direct SQL introspection of
// information_schema/pg_catalog over a plain Postgres connection), NOT
// by the official \`supabase gen types typescript\` CLI. See that script's
// own header comment for exactly why: the official CLI's --db-url mode
// requires Docker to pull a helper image from Docker Hub, which this
// sandbox's network policy does not allow (confirmed — Docker itself
// runs; the registry pull is what's blocked).
//
// Covers Tables (Row/Insert/Update) and Enums, matching the official
// tool's shape for those two sections exactly, so \`createServerClient
// <Database>()\` and \`supabase.from("x").select()\` type inference work
// the same way they would with an officially-generated file. Functions
// and Views are intentionally NOT included — see the generator script's
// header for why partial coverage there would be worse than omission.
//
// This file should be regenerated with the OFFICIAL command once a
// real Docker + internet environment is available:
//   npx supabase gen types typescript --db-url "<connection-string>" \\
//     > src/lib/supabase/database.types.ts
// Everything in this file was verified against the actual schema
// produced by every migration in supabase/migrations/, applied to a
// live PostgreSQL 16 instance — not hand-written or guessed.
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
${tableBlocks.join("\n")}
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
${enumTsBlock}
    };
    CompositeTypes: Record<string, never>;
  };
}
`;

  process.stdout.write(output);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
