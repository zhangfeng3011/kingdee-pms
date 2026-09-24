const express = require('express');
const store = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.use(requireAuth);

const toApi = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  status: r.status,
  projectManagers: Array.isArray(r.project_managers) ? r.project_managers : [],
  implementationConsultants: Array.isArray(r.implementation_consultants) ? r.implementation_consultants : [],
  developmentConsultants: Array.isArray(r.development_consultants) ? r.development_consultants : [],
  startDate: r.start_date || '',
  endDate: r.end_date || '',
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

const STATUS_LIST = ['待测试', '测试中', '已完成'];

// 项目列表
router.get('/', (req, res) => {
  const projects = store.listProjects().map(toApi);
  res.json({ projects });
});

// 项目详情 + 其下问题统计
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const r = store.findProjectById(id);
  if (!r) return res.status(404).json({ error: '项目不存在' });
  const issues = store.listIssues({ project_id: id });
  const issueCount = issues.length;
  const doneCount = issues.filter(i => i.status === '已完成').length;
  res.json({ project: Object.assign(toApi(r), { issueCount, doneCount }) });
});

// 新建项目
router.post('/', (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: '项目名称不能为空' });
  const p = store.insertProject({
    name,
    description: String(b.description || ''),
    status: STATUS_LIST.includes(b.status) ? b.status : '待测试',
    project_managers: Array.isArray(b.projectManagers) ? b.projectManagers : [],
    implementation_consultants: Array.isArray(b.implementationConsultants) ? b.implementationConsultants : [],
    development_consultants: Array.isArray(b.developmentConsultants) ? b.developmentConsultants : [],
    start_date: String(b.startDate || ''),
    end_date: String(b.endDate || ''),
    created_by: req.user.name
  });
  res.json({ id: p.id });
});

// 编辑项目
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: '项目名称不能为空' });
  const ok = store.updateProject(id, {
    name,
    description: String(b.description || ''),
    status: STATUS_LIST.includes(b.status) ? b.status : '待测试',
    project_managers: Array.isArray(b.projectManagers) ? b.projectManagers : [],
    implementation_consultants: Array.isArray(b.implementationConsultants) ? b.implementationConsultants : [],
    development_consultants: Array.isArray(b.developmentConsultants) ? b.developmentConsultants : [],
    start_date: String(b.startDate || ''),
    end_date: String(b.endDate || '')
  });
  if (!ok) return res.status(404).json({ error: '项目不存在' });
  res.json({ ok: true });
});

// 删除项目（级联删除其下问题）
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const ok = store.deleteProject(id);
  if (!ok) return res.status(404).json({ error: '项目不存在' });
  store.deleteIssuesByProject(id);
  res.json({ ok: true });
});

module.exports = router;
