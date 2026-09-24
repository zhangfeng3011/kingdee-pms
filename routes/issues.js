const express = require('express');
const store = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.use(requireAuth);

const STATUS_LIST = ['待处理', '进行中', '已完成'];
const MAX_ATTACH = 5;
const MAX_BYTES = 5 * 1024 * 1024;

const toApi = (r) => ({
  id: r.id,
  projectId: r.project_id,
  description: r.description,
  testers: Array.isArray(r.testers) ? r.testers : [],
  developers: Array.isArray(r.developers) ? r.developers : [],
  createdDate: r.created_date,
  status: r.status,
  handledDate: r.handled_date || '',
  hours: Number(r.hours) || 0,
  assignedTo: Array.isArray(r.assigned_to) ? r.assigned_to : [],
  completedDate: r.completed_date || '',
  attachments: (Array.isArray(r.attachments) ? r.attachments : []).map(a => ({ id: a.id, name: a.name, size: a.size, type: a.type })),
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

// 全局问题列表（可选按项目/状态/关键词筛选）
router.get('/', (req, res) => {
  const { project_id, status, q } = req.query;
  let issues = store.listIssues({ project_id: project_id || undefined, status: status || undefined });
  const projectMap = new Map(store.listProjects().map(p => [p.id, p.name]));
  let out = issues.map(r => Object.assign(toApi(r), { projectName: projectMap.get(r.project_id) || '（已删除项目）' }));
  if (q) {
    const kw = String(q).toLowerCase();
    out = out.filter(i =>
      (i.description || '').toLowerCase().includes(kw) ||
      (i.projectName || '').toLowerCase().includes(kw) ||
      i.testers.some(t => String(t).toLowerCase().includes(kw)) ||
      i.developers.some(t => String(t).toLowerCase().includes(kw))
    );
  }
  res.json({ issues: out });
});

// 单个问题详情（含附件完整数据，供预览/下载）
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const r = store.findIssueById(id);
  if (!r) return res.status(404).json({ error: '问题不存在' });
  const project = store.findProjectById(r.project_id);
  res.json({
    issue: Object.assign(toApi(r), {
      projectName: project ? project.name : '（已删除项目）',
      attachments: Array.isArray(r.attachments) ? r.attachments : []
    })
  });
});

// 新增问题
router.post('/', (req, res) => {
  const b = req.body || {};
  const projectId = Number(b.projectId);
  const description = String(b.description || '').trim();
  if (!projectId) return res.status(400).json({ error: '请选择所属项目' });
  if (!description) return res.status(400).json({ error: '问题描述不能为空' });
  if (!store.findProjectById(projectId)) return res.status(400).json({ error: '所选项目不存在' });

  const status = STATUS_LIST.includes(b.status) ? b.status : '待处理';
  const issue = store.insertIssue({
    project_id: projectId,
    description,
    testers: Array.isArray(b.testers) ? b.testers : [],
    developers: Array.isArray(b.developers) ? b.developers : [],
    created_date: String(b.createdDate || store.today()),
    status,
    handled_date: String(b.handledDate || ''),
    hours: Number(b.hours) || 0,
    assigned_to: Array.isArray(b.assignedTo) ? b.assignedTo : [],
    completed_date: status === '已完成' ? String(b.completedDate || store.today()) : '',
    attachments: sanitizeAttachments(b.attachments),
    created_by: req.user.name
  });
  res.json({ id: issue.id });
});

// 编辑问题
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const description = String(b.description || '').trim();
  if (!description) return res.status(400).json({ error: '问题描述不能为空' });
  const status = STATUS_LIST.includes(b.status) ? b.status : '待处理';
  const ok = store.updateIssue(id, {
    description,
    testers: Array.isArray(b.testers) ? b.testers : [],
    developers: Array.isArray(b.developers) ? b.developers : [],
    created_date: String(b.createdDate || ''),
    status,
    handled_date: String(b.handledDate || ''),
    hours: Number(b.hours) || 0,
    assigned_to: Array.isArray(b.assignedTo) ? b.assignedTo : [],
    completed_date: status === '已完成' ? String(b.completedDate || store.today()) : '',
    attachments: sanitizeAttachments(b.attachments)
  });
  if (!ok) return res.status(404).json({ error: '问题不存在' });
  res.json({ ok: true });
});

// 删除问题
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const ok = store.deleteIssue(id);
  if (!ok) return res.status(404).json({ error: '问题不存在' });
  res.json({ ok: true });
});

// 附件校验：每条最多5个，单个不超过5MB
function sanitizeAttachments(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const a of arr.slice(0, MAX_ATTACH)) {
    if (!a || typeof a.data !== 'string') continue;
    const size = Number(a.size) || 0;
    if (size > MAX_BYTES) continue;
    out.push({
      id: a.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      name: String(a.name || '附件'),
      type: String(a.type || ''),
      size,
      data: a.data
    });
  }
  return out;
}

module.exports = router;
