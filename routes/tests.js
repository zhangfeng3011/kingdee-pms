const express = require('express');
const store = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const PRIORITY_LIST = ['高', '中', '低'];
const CASE_STATUS_LIST = ['正常', '废弃'];
const RUN_STATUS_LIST = ['未开始', '进行中', '已完成'];
const RESULT_LIST = ['未执行', '通过', '失败', '阻塞'];

// ---------- 测试用例 ----------
router.get('/cases', (req, res) => {
  const { project_id } = req.query;
  let cases = store.listTestCases({ project_id: project_id || undefined });
  const projectMap = new Map(store.listProjects().map(p => [p.id, p.name]));
  res.json({ testCases: cases.map(c => Object.assign({}, c, { projectName: projectMap.get(c.project_id) || '（已删除项目）' })) });
});

router.post('/cases', (req, res) => {
  const b = req.body || {};
  const projectId = Number(b.projectId);
  const title = String(b.title || '').trim();
  if (!projectId) return res.status(400).json({ error: '请选择所属项目' });
  if (!title) return res.status(400).json({ error: '用例名称不能为空' });
  if (!store.findProjectById(projectId)) return res.status(400).json({ error: '所选项目不存在' });
  const c = store.insertTestCase({
    project_id: projectId,
    title,
    preconditions: String(b.preconditions || ''),
    steps: String(b.steps || ''),
    expected: String(b.expected || ''),
    priority: PRIORITY_LIST.includes(b.priority) ? b.priority : '中',
    status: CASE_STATUS_LIST.includes(b.status) ? b.status : '正常',
    created_by: req.user.name
  });
  res.json({ id: c.id });
});

router.put('/cases/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) return res.status(400).json({ error: '用例名称不能为空' });
  const ok = store.updateTestCase(id, {
    title,
    preconditions: String(b.preconditions || ''),
    steps: String(b.steps || ''),
    expected: String(b.expected || ''),
    priority: PRIORITY_LIST.includes(b.priority) ? b.priority : '中',
    status: CASE_STATUS_LIST.includes(b.status) ? b.status : '正常'
  });
  if (!ok) return res.status(404).json({ error: '用例不存在' });
  res.json({ ok: true });
});

router.delete('/cases/:id', (req, res) => {
  const ok = store.deleteTestCase(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: '用例不存在' });
  res.json({ ok: true });
});

// ---------- 测试套件 ----------
router.get('/suites', (req, res) => {
  const suites = store.listTestSuites();
  const projectMap = new Map(store.listProjects().map(p => [p.id, p.name]));
  const caseMap = new Map(store.listTestCases().map(c => [c.id, c.title]));
  res.json({ testSuites: suites.map(s => Object.assign({}, s, {
    projectName: projectMap.get(s.project_id) || '（已删除项目）',
    caseCount: (s.case_ids || []).length,
    caseTitles: (s.case_ids || []).map(cid => caseMap.get(cid) || '用例#' + cid)
  })) });
});

router.post('/suites', (req, res) => {
  const b = req.body || {};
  const projectId = Number(b.projectId);
  const name = String(b.name || '').trim();
  if (!projectId) return res.status(400).json({ error: '请选择所属项目' });
  if (!name) return res.status(400).json({ error: '套件名称不能为空' });
  const s = store.insertTestSuite({
    project_id: projectId,
    name,
    desc: String(b.desc || ''),
    case_ids: Array.isArray(b.caseIds) ? b.caseIds.map(Number).filter(Boolean) : [],
    created_by: req.user.name
  });
  res.json({ id: s.id });
});

router.put('/suites/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: '套件名称不能为空' });
  const ok = store.updateTestSuite(id, {
    name,
    desc: String(b.desc || ''),
    case_ids: Array.isArray(b.caseIds) ? b.caseIds.map(Number).filter(Boolean) : []
  });
  if (!ok) return res.status(404).json({ error: '套件不存在' });
  res.json({ ok: true });
});

router.delete('/suites/:id', (req, res) => {
  const ok = store.deleteTestSuite(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: '套件不存在' });
  res.json({ ok: true });
});

// ---------- 测试单 ----------
router.get('/runs', (req, res) => {
  const runs = store.listTestRuns();
  const projectMap = new Map(store.listProjects().map(p => [p.id, p.name]));
  const suiteMap = new Map(store.listTestSuites().map(s => [s.id, s.name]));
  const caseMap = new Map(store.listTestCases().map(c => [c.id, c.title]));
  res.json({ testRuns: runs.map(r => {
    const exes = store.listExecutions({ run_id: r.id });
    const total = (r.case_ids || []).length;
    const passed = exes.filter(e => e.result === '通过').length;
    const failed = exes.filter(e => e.result === '失败').length;
    const blocked = exes.filter(e => e.result === '阻塞').length;
    const done = passed + failed + blocked;
    return Object.assign({}, r, {
      projectName: projectMap.get(r.project_id) || '（已删除项目）',
      suiteName: r.suite_id ? (suiteMap.get(r.suite_id) || '') : '',
      caseCount: total,
      caseTitles: (r.case_ids || []).map(cid => caseMap.get(cid) || '用例#' + cid),
      executedCount: done,
      progress: total ? Math.round(done / total * 100) : 0,
      passed, failed, blocked
    });
  }) });
});

router.post('/runs', (req, res) => {
  const b = req.body || {};
  const projectId = Number(b.projectId);
  const name = String(b.name || '').trim();
  if (!projectId) return res.status(400).json({ error: '请选择所属项目' });
  if (!name) return res.status(400).json({ error: '测试单名称不能为空' });
  let caseIds = [];
  if (b.suiteId) {
    const s = store.findTestSuiteById(Number(b.suiteId));
    if (s) caseIds = (s.case_ids || []).slice();
  }
  if (Array.isArray(b.caseIds) && b.caseIds.length) caseIds = b.caseIds.map(Number).filter(Boolean);
  if (!caseIds.length) return res.status(400).json({ error: '请选择测试套件或用例' });
  const r = store.insertTestRun({
    project_id: projectId,
    name,
    desc: String(b.desc || ''),
    suite_id: Number(b.suiteId) || 0,
    case_ids: caseIds,
    executor: String(b.executor || ''),
    status: RUN_STATUS_LIST.includes(b.status) ? b.status : '未开始',
    created_by: req.user.name
  });
  store.initExecutionsForRun(r);
  res.json({ id: r.id });
});

router.put('/runs/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: '测试单名称不能为空' });
  let caseIds = [];
  if (b.suiteId) {
    const s = store.findTestSuiteById(Number(b.suiteId));
    if (s) caseIds = (s.case_ids || []).slice();
  }
  if (Array.isArray(b.caseIds) && b.caseIds.length) caseIds = b.caseIds.map(Number).filter(Boolean);
  if (!caseIds.length) return res.status(400).json({ error: '请选择测试套件或用例' });
  const status = RUN_STATUS_LIST.includes(b.status) ? b.status : '未开始';
  const ok = store.updateTestRun(id, {
    name,
    desc: String(b.desc || ''),
    suite_id: Number(b.suiteId) || 0,
    case_ids: caseIds,
    executor: String(b.executor || ''),
    status,
    completed_date: status === '已完成' ? store.today() : ''
  });
  if (!ok) return res.status(404).json({ error: '测试单不存在' });
  store.initExecutionsForRun(store.findTestRunById(id));
  res.json({ ok: true });
});

router.delete('/runs/:id', (req, res) => {
  const ok = store.deleteTestRun(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: '测试单不存在' });
  res.json({ ok: true });
});

// ---------- 测试执行 ----------
router.get('/executions', (req, res) => {
  const { run_id } = req.query;
  const list = run_id ? store.listExecutions({ run_id: Number(run_id) }) : store.listExecutions();
  const caseMap = new Map(store.listTestCases().map(c => [c.id, c]));
  res.json({ executions: list.map(e => Object.assign({}, e, {
    caseInfo: e.case_id ? (caseMap.get(e.case_id) || null) : null
  })) });
});

router.put('/executions/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const e = store.findExecutionById(id);
  if (!e) return res.status(404).json({ error: '执行记录不存在' });
  const result = RESULT_LIST.includes(b.result) ? b.result : e.result;
  const run = store.findTestRunById(e.run_id);
  if (run && result !== '未执行' && run.status === '未开始') {
    store.updateTestRun(run.id, { status: '进行中' });
  }
  store.upsertExecution({ run_id: e.run_id, case_id: e.case_id, case_title: e.case_title, result, note: String(b.note || '') });
  if (run) {
    const exes = store.listExecutions({ run_id: run.id });
    const done = exes.filter(x => x.result !== '未执行').length;
    if (exes.length && done === exes.length && run.status !== '已完成') {
      store.updateTestRun(run.id, { status: '已完成', completed_date: store.today() });
    }
  }
  res.json({ ok: true });
});

// ---------- 测试报告 ----------
router.get('/reports', (req, res) => {
  const reports = store.listReports();
  const projectMap = new Map(store.listProjects().map(p => [p.id, p.name]));
  const runMap = new Map(store.listTestRuns().map(r => [r.id, r.name]));
  res.json({ reports: reports.map(r => Object.assign({}, r, {
    projectName: projectMap.get(r.project_id) || '（已删除项目）',
    runName: r.run_id ? (runMap.get(r.run_id) || '') : ''
  })) });
});

router.post('/reports', (req, res) => {
  const b = req.body || {};
  const runId = Number(b.runId);
  const run = store.findTestRunById(runId);
  if (!run) return res.status(400).json({ error: '测试单不存在' });
  const exes = store.listExecutions({ run_id: runId });
  const total = exes.length;
  const passed = exes.filter(e => e.result === '通过').length;
  const failed = exes.filter(e => e.result === '失败').length;
  const blocked = exes.filter(e => e.result === '阻塞').length;
  const passRate = total ? Math.round(passed / total * 100) : 0;
  const summary = '测试单「' + run.name + '」共 ' + total + ' 条用例：通过 ' + passed + '，失败 ' + failed + '，阻塞 ' + blocked + '，通过率 ' + passRate + '%。';
  const r = store.insertReport({
    run_id: runId,
    project_id: run.project_id,
    name: b.name ? String(b.name).trim() : ('报告-' + run.name),
    total, passed, failed, blocked, pass_rate: passRate, summary,
    created_by: req.user.name
  });
  res.json({ id: r.id, report: r });
});

router.delete('/reports/:id', (req, res) => {
  const ok = store.deleteReport(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: '报告不存在' });
  res.json({ ok: true });
});

module.exports = router;
