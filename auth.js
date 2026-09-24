const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../db');
const { signToken, requireAuth } = require('../auth');

const router = express.Router();

// 注册：姓名 + 密码（姓名至少2字，密码至少6位）
router.post('/register', (req, res) => {
  const { name, password } = req.body || {};
  const uname = String(name || '').trim();
  const upass = String(password || '');
  if (uname.length < 2) return res.status(400).json({ error: '姓名至少2个字符' });
  if (upass.length < 6) return res.status(400).json({ error: '密码至少6位' });

  if (store.findUserByName(uname)) return res.status(409).json({ error: '该姓名已注册，请直接登录' });

  const hash = bcrypt.hashSync(upass, 10);
  const user = store.insertUser({ name: uname, password_hash: hash, is_admin: 0 });
  // 新注册用户自动加入成员列表（同名成员已存在则跳过）
  const memberExists = store.listMembers().some(m => m.name === uname);
  if (!memberExists) store.insertMember({ name: uname, role: '' });
  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, isAdmin: false } });
});

// 登录
router.post('/login', (req, res) => {
  const { name, password } = req.body || {};
  const uname = String(name || '').trim();
  const row = store.findUserByName(uname);
  if (!row || !bcrypt.compareSync(String(password || ''), row.password_hash)) {
    return res.status(401).json({ error: '姓名或密码错误' });
  }
  const token = signToken(row);
  res.json({ token, user: { id: row.id, name: row.name, isAdmin: !!row.is_admin } });
});

// 当前登录用户信息
router.get('/me', requireAuth, (req, res) => {
  const row = store.findUserById(req.user.id);
  if (!row) return res.status(404).json({ error: '用户不存在' });
  res.json({ user: { id: row.id, name: row.name, isAdmin: !!row.is_admin } });
});

module.exports = router;
