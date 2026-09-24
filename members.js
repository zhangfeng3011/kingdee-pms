const express = require('express');
const store = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();

// 全部接口需登录；写操作仅管理员
router.use(requireAuth);

// 成员列表（所有登录用户可看）
router.get('/', (req, res) => {
  res.json({ members: store.listMembers() });
});

// 新增成员（仅管理员）
router.post('/', requireAdmin, (req, res) => {
  const { name, role } = req.body || {};
  const uname = String(name || '').trim();
  if (!uname) return res.status(400).json({ error: '姓名不能为空' });
  const member = store.insertMember({ name: uname, role: String(role || '').trim() });
  res.json({ member });
});

// 编辑成员（仅管理员）
router.put('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, role } = req.body || {};
  const uname = String(name || '').trim();
  if (!uname) return res.status(400).json({ error: '姓名不能为空' });
  const ok = store.updateMember(id, { name: uname, role: String(role || '').trim() });
  if (!ok) return res.status(404).json({ error: '成员不存在' });
  res.json({ ok: true });
});

// 删除成员（仅管理员），并清理项目/问题中对该成员的引用
router.delete('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const member = store.findMemberById(id);
  if (!member) return res.status(404).json({ error: '成员不存在' });

  const removeName = (list, field) => {
    list.forEach(item => {
      const arr = Array.isArray(item[field]) ? item[field] : [];
      const next = arr.filter(n => n !== member.name);
      if (next.length !== arr.length) item[field] = next;
    });
  };

  const projects = store.listProjects();
  projects.forEach(p => {
    removeName([p], 'project_managers');
    removeName([p], 'implementation_consultants');
    removeName([p], 'development_consultants');
  });
  const issues = store.listIssues();
  issues.forEach(i => {
    removeName([i], 'testers');
    removeName([i], 'developers');
  });

  store.deleteMember(id);
  res.json({ ok: true });
});

module.exports = router;
