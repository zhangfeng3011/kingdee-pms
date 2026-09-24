// 数据存储：支持两种模式
// 1) 本地 JSON 文件（默认）：零依赖，便于任意服务器部署
// 2) 云端 PostgreSQL（设置环境变量 DATABASE_URL 即启用）：整库快照持久化，适合免费托管平台（Render/Koyeb 等）
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || '';

// 默认空状态
const EMPTY_STATE = () => ({
  users: [],
  members: [],
  projects: [],
  issues: [],
  test_cases: [],
  test_suites: [],
  test_runs: [],
  test_executions: [],
  test_reports: [],
  seq: { user: 0, member: 0, project: 0, issue: 0, testcase: 0, suite: 0, run: 0, execution: 0, report: 0 }
});

let state = EMPTY_STATE();
let pool = null;

async function load() {
  if (DATABASE_URL) {
    try {
      const { rows } = await pool.query('SELECT value FROM pms_store WHERE key = $1', ['db']);
      if (rows.length && rows[0].value) {
        state = Object.assign(EMPTY_STATE(), rows[0].value);
        if (!state.seq) state.seq = { user: 0, member: 0, project: 0, issue: 0, testcase: 0, suite: 0, run: 0, execution: 0, report: 0 };
        console.log('[store] 已从云端数据库加载数据');
      } else {
        console.log('[store] 云端数据库为空，使用初始状态');
      }
    } catch (e) {
      console.error('[store] 云端读取失败，使用空状态:', e.message);
      state = EMPTY_STATE();
    }
    return;
  }
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state = Object.assign(EMPTY_STATE(), parsed);
      // 兼容旧结构缺字段
      if (!state.seq) state.seq = { user: 0, member: 0, project: 0, issue: 0, testcase: 0, suite: 0, run: 0, execution: 0, report: 0 };
    }
  } catch (e) {
    console.error('[store] 读取数据文件失败，使用空状态:', e.message);
    state = EMPTY_STATE();
  }
}

let writeQueue = Promise.resolve();
function save() {
  // 串行原子写入，避免并发写损坏
  const snapshot = JSON.stringify(state, null, 2);
  writeQueue = writeQueue.then(async () => {
    if (DATABASE_URL) {
      await pool.query(
        'INSERT INTO pms_store (key, value, updated_at) VALUES ($1, $2, now()) ' +
        'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
        ['db', JSON.stringify(state)]
      );
      return;
    }
    await new Promise((resolve, reject) => {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFile(tmp, snapshot, (err) => {
        if (err) return reject(err);
        fs.rename(tmp, DATA_FILE, (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  }).catch(err => console.error('[store] 写入失败:', err.message));
  return writeQueue;
}

function nextId(type) {
  state.seq[type] = (state.seq[type] || 0) + 1;
  return state.seq[type];
}

const now = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
};
const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};

// ---------- 用户 ----------
function findUserByName(name) { return state.users.find(u => u.name === name); }
function findUserById(id) { return state.users.find(u => u.id === id); }
function insertUser({ name, password_hash, is_admin }) {
  const u = { id: nextId('user'), name, password_hash, is_admin: is_admin ? 1 : 0, created_at: now() };
  state.users.push(u);
  save();
  return u;
}

// ---------- 成员 ----------
function listMembers() {
  return state.members.slice().sort((a, b) => b.id - a.id);
}
function findMemberById(id) { return state.members.find(m => m.id === id); }
function insertMember({ name, role }) {
  const m = { id: nextId('member'), name, role, created_at: now(), updated_at: now() };
  state.members.push(m);
  save();
  return m;
}
function updateMember(id, { name, role }) {
  const m = findMemberById(id);
  if (!m) return false;
  m.name = name;
  m.role = role;
  m.updated_at = now();
  save();
  return true;
}
function deleteMember(id) {
  const idx = state.members.findIndex(m => m.id === id);
  if (idx < 0) return false;
  state.members.splice(idx, 1);
  save();
  return true;
}

// ---------- 项目 ----------
function listProjects() {
  return state.projects.slice().sort((a, b) => b.id - a.id);
}
function findProjectById(id) { return state.projects.find(p => p.id === id); }
function insertProject(data) {
  const p = Object.assign({
    id: nextId('project'),
    name: '',
    description: '',
    status: '待测试',
    project_managers: [],
    implementation_consultants: [],
    development_consultants: [],
    start_date: '',
    end_date: '',
    created_by: '',
    created_at: now(),
    updated_at: now()
  }, data);
  p.id = nextId('project'); // 确保自增
  state.projects.push(p);
  save();
  return p;
}
function updateProject(id, data) {
  const p = findProjectById(id);
  if (!p) return false;
  Object.assign(p, data, { id, updated_at: now() });
  save();
  return true;
}
function deleteProject(id) {
  const idx = state.projects.findIndex(p => p.id === id);
  if (idx < 0) return false;
  state.projects.splice(idx, 1);
  return true;
}

// ---------- 问题 ----------
function listIssues(filter) {
  let arr = state.issues.slice().sort((a, b) => b.id - a.id);
  if (filter && filter.project_id) arr = arr.filter(i => i.project_id === Number(filter.project_id));
  if (filter && filter.status) arr = arr.filter(i => i.status === filter.status);
  return arr;
}
function findIssueById(id) { return state.issues.find(i => i.id === id); }
function insertIssue(data) {
  const i = Object.assign({
    id: nextId('issue'),
    project_id: 0,
    description: '',
    testers: [],
    developers: [],
    created_date: today(),
    status: '待处理',
    handled_date: '',
    hours: 0,
    assigned_to: [],
    completed_date: '',
    attachments: [],
    created_by: '',
    created_at: now(),
    updated_at: now()
  }, data);
  i.id = nextId('issue');
  state.issues.push(i);
  save();
  return i;
}
function updateIssue(id, data) {
  const i = findIssueById(id);
  if (!i) return false;
  Object.assign(i, data, { id, updated_at: now() });
  save();
  return true;
}
function deleteIssue(id) {
  const idx = state.issues.findIndex(i => i.id === id);
  if (idx < 0) return false;
  state.issues.splice(idx, 1);
  save();
  return true;
}
function deleteIssuesByProject(projectId) {
  state.issues = state.issues.filter(i => i.project_id !== projectId);
  save();
}

// ---------- 测试用例 ----------
function listTestCases(filter) {
  let arr = (state.test_cases || []).slice().sort((a, b) => b.id - a.id);
  if (filter && filter.project_id) arr = arr.filter(c => c.project_id === Number(filter.project_id));
  return arr;
}
function findTestCaseById(id) { return (state.test_cases || []).find(c => c.id === id); }
function insertTestCase(data) {
  const c = Object.assign({
    id: nextId('testcase'),
    project_id: 0,
    title: '',
    preconditions: '',
    steps: '',
    expected: '',
    priority: '中',
    status: '正常',
    created_by: '',
    created_date: today()
  }, data);
  c.id = nextId('testcase');
  state.test_cases.push(c);
  save();
  return c;
}
function updateTestCase(id, data) {
  const c = findTestCaseById(id);
  if (!c) return false;
  Object.assign(c, data, { id });
  save();
  return true;
}
function deleteTestCase(id) {
  const idx = (state.test_cases || []).findIndex(c => c.id === id);
  if (idx < 0) return false;
  state.test_cases.splice(idx, 1);
  save();
  return true;
}

// ---------- 测试套件 ----------
function listTestSuites() {
  return (state.test_suites || []).slice().sort((a, b) => b.id - a.id);
}
function findTestSuiteById(id) { return (state.test_suites || []).find(s => s.id === id); }
function insertTestSuite(data) {
  const s = Object.assign({
    id: nextId('suite'),
    project_id: 0,
    name: '',
    desc: '',
    case_ids: [],
    created_by: '',
    created_date: today()
  }, data);
  s.id = nextId('suite');
  state.test_suites.push(s);
  save();
  return s;
}
function updateTestSuite(id, data) {
  const s = findTestSuiteById(id);
  if (!s) return false;
  Object.assign(s, data, { id });
  save();
  return true;
}
function deleteTestSuite(id) {
  const idx = (state.test_suites || []).findIndex(s => s.id === id);
  if (idx < 0) return false;
  state.test_suites.splice(idx, 1);
  save();
  return true;
}

// ---------- 测试单 ----------
function listTestRuns() {
  return (state.test_runs || []).slice().sort((a, b) => b.id - a.id);
}
function findTestRunById(id) { return (state.test_runs || []).find(r => r.id === id); }
function insertTestRun(data) {
  const r = Object.assign({
    id: nextId('run'),
    project_id: 0,
    name: '',
    desc: '',
    suite_id: 0,
    case_ids: [],
    executor: '',
    status: '未开始',
    created_by: '',
    created_date: today(),
    completed_date: ''
  }, data);
  r.id = nextId('run');
  state.test_runs.push(r);
  save();
  return r;
}
function updateTestRun(id, data) {
  const r = findTestRunById(id);
  if (!r) return false;
  Object.assign(r, data, { id });
  save();
  return true;
}
function deleteTestRun(id) {
  const idx = (state.test_runs || []).findIndex(r => r.id === id);
  if (idx < 0) return false;
  state.test_runs.splice(idx, 1);
  state.test_executions = (state.test_executions || []).filter(e => e.run_id !== id);
  save();
  return true;
}

// ---------- 测试执行 ----------
function listExecutions(filter) {
  let arr = (state.test_executions || []).slice().sort((a, b) => a.id - b.id);
  if (filter && filter.run_id) arr = arr.filter(e => e.run_id === Number(filter.run_id));
  return arr;
}
function findExecutionById(id) { return (state.test_executions || []).find(e => e.id === id); }
function upsertExecution({ run_id, case_id, case_title, result, note }) {
  let e = (state.test_executions || []).find(x => x.run_id === run_id && x.case_id === case_id);
  if (e) {
    e.result = result;
    e.note = note || '';
    save();
    return e;
  }
  e = { id: nextId('execution'), run_id, case_id, case_title: case_title || '', result: result || '未执行', note: note || '', executed_date: '' };
  state.test_executions.push(e);
  save();
  return e;
}
function initExecutionsForRun(run) {
  (run.case_ids || []).forEach(cid => {
    const exists = (state.test_executions || []).some(e => e.run_id === run.id && e.case_id === cid);
    if (!exists) {
      const c = findTestCaseById(cid);
      state.test_executions.push({
        id: nextId('execution'),
        run_id: run.id,
        case_id: cid,
        case_title: c ? c.title : ('用例#' + cid),
        result: '未执行',
        note: '',
        executed_date: ''
      });
    }
  });
  save();
  return (state.test_executions || []).filter(e => e.run_id === run.id);
}

// ---------- 测试报告 ----------
function listReports() {
  return (state.test_reports || []).slice().sort((a, b) => b.id - a.id);
}
function findReportById(id) { return (state.test_reports || []).find(r => r.id === id); }
function insertReport(data) {
  const r = Object.assign({
    id: nextId('report'),
    run_id: 0,
    project_id: 0,
    name: '',
    total: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    pass_rate: 0,
    summary: '',
    created_by: '',
    created_date: today()
  }, data);
  r.id = nextId('report');
  state.test_reports.push(r);
  save();
  return r;
}
function deleteReport(id) {
  const idx = (state.test_reports || []).findIndex(r => r.id === id);
  if (idx < 0) return false;
  state.test_reports.splice(idx, 1);
  save();
  return true;
}

// ---------- 初始化 ----------
async function init() {
  if (DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 10000
    });
    await pool.query('CREATE TABLE IF NOT EXISTS pms_store (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())');
  }
  await load();

  // 确保内置管理员账号存在（admin / admin123）
  const bcrypt = require('bcryptjs');
  if (!findUserByName('admin')) {
    const hash = bcrypt.hashSync('admin123', 10);
    insertUser({ name: 'admin', password_hash: hash, is_admin: 1 });
    console.log('[init] 内置管理员账号已创建: admin / admin123');
  }
  console.log('[store] 存储模式: ' + (DATABASE_URL ? 'PostgreSQL（云端）' : '本地 JSON 文件'));
}

module.exports = {
  init,
  now, today,
  findUserByName, findUserById, insertUser,
  listMembers, findMemberById, insertMember, updateMember, deleteMember,
  listProjects, findProjectById, insertProject, updateProject, deleteProject,
  listIssues, findIssueById, insertIssue, updateIssue, deleteIssue, deleteIssuesByProject,
  listTestCases, findTestCaseById, insertTestCase, updateTestCase, deleteTestCase,
  listTestSuites, findTestSuiteById, insertTestSuite, updateTestSuite, deleteTestSuite,
  listTestRuns, findTestRunById, insertTestRun, updateTestRun, deleteTestRun,
  listExecutions, findExecutionById, upsertExecution, initExecutionsForRun,
  listReports, findReportById, insertReport, deleteReport
};
