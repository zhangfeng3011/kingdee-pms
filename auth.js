const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'kingdee-pms-demo-secret-2026';
const TOKEN_TTL = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, isAdmin: !!user.is_admin },
    SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

// 认证中间件：从 Authorization: Bearer <token> 读取并校验登录态
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已失效，请重新登录' });
  }
}

// 管理员中间件
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: '无权限，仅管理员可操作' });
  }
  next();
}

module.exports = { signToken, verifyToken, requireAuth, requireAdmin };
