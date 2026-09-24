const path = require('path');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 云平台（Vercel/Render）serverless 模式下：每个请求前确保数据库初始化完成
let initPromise = null;
app.use(async (req, res, next) => {
  try {
    if (!initPromise) initPromise = db.init();
    await initPromise;
    next();
  } catch (e) {
    res.status(500).json({ error: '数据库初始化失败: ' + e.message });
  }
});

app.use(express.json({ limit: '50mb' })); // 附件 base64 需要较大请求体
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/issues', require('./routes/issues'));
app.use('/api/tests', require('./routes/tests'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// 前端路由回退
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

// 供 Vercel 等 serverless 平台使用
module.exports = app;

// 本地直接运行时才监听端口
if (require.main === module) {
  db.init().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`金蝶项目管理系统已启动: http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('[startup] 数据库初始化失败:', err.message);
    process.exit(1);
  });
}
