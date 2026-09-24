// 数据迁移：把本地 db.json 的数据导入云端 PostgreSQL
// 用法（在项目目录下）：
//   set DATABASE_URL=postgresql://...
//   node migrate.js
// 可重复执行，会覆盖云端当前数据（以本地 db.json 为准）
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('请先设置 DATABASE_URL 环境变量'); process.exit(1); }
  const dbFile = path.join(__dirname, 'data', 'db.json');
  if (!fs.existsSync(dbFile)) { console.error('未找到 data/db.json'); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pool.query('CREATE TABLE IF NOT EXISTS pms_store (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())');
  await pool.query(
    'INSERT INTO pms_store (key, value, updated_at) VALUES ($1, $2, now()) ' +
    'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
    ['db', JSON.stringify(data)]
  );
  console.log('迁移完成：' + (data.users || []).length + ' 个用户、' + (data.members || []).length + ' 个成员、' +
    (data.projects || []).length + ' 个项目、' + (data.issues || []).length + ' 个问题');
  await pool.end();
})().catch(e => { console.error('迁移失败:', e.message); process.exit(1); });
