/**
 * Applies src/config/migrations/*.sql in name order, once each (npm run db:migrate).
 * The real base schema comes from the production dump; these files are the changes
 * made since the Node migration. Applied files are recorded in SchemaMigration.
 */
import fs from 'fs';
import path from 'path';
import { pool } from './db';
import type mysql from 'mysql2/promise';

const DIR = path.join(__dirname, 'migrations');

/** Split a file into statements on ";" at line end, skipping "--" comment lines */
function statements(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS SchemaMigration (
    Name VARCHAR(255) NOT NULL PRIMARY KEY,
    AppliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT Name FROM SchemaMigration');
  const applied = new Set(rows.map((r) => r['Name'] as string));

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    console.log(`→ ${file}`);
    for (const stmt of statements(fs.readFileSync(path.join(DIR, file), 'utf8'))) {
      await pool.query(stmt);
    }
    await pool.query('INSERT INTO SchemaMigration (Name) VALUES (?)', [file]);
  }
  console.log(applied.size === files.length ? 'Database is up to date.' : 'Migrations applied.');
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
