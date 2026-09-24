// API 请求封装（Bearer Token 认证）
const Api = (() => {
  const TOKEN_KEY = 'kingdee_pms_token';
  const USER_KEY = 'kingdee_pms_user';

  function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
  function getUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch (e) { return null; }
  }
  function setSession(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  async function request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) {
      // 登录失效：清理会话并跳转登录页
      clearSession();
      location.hash = '#/login';
      throw new Error('登录已失效，请重新登录');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* 非 JSON 响应 */ }
    if (!res.ok) {
      throw new Error((data && data.error) || ('请求失败(' + res.status + ')'));
    }
    return data;
  }

  return {
    getToken, getUser, setSession, clearSession,
    login: (name, password) => request('POST', '/api/auth/login', { name, password }),
    register: (name, password) => request('POST', '/api/auth/register', { name, password }),
    me: () => request('GET', '/api/auth/me'),
    // 成员
    getMembers: () => request('GET', '/api/members'),
    addMember: (name, role) => request('POST', '/api/members', { name, role }),
    updateMember: (id, name, role) => request('PUT', '/api/members/' + id, { name, role }),
    deleteMember: (id) => request('DELETE', '/api/members/' + id),
    // 项目
    getProjects: () => request('GET', '/api/projects'),
    getProject: (id) => request('GET', '/api/projects/' + id),
    addProject: (p) => request('POST', '/api/projects', p),
    updateProject: (id, p) => request('PUT', '/api/projects/' + id, p),
    deleteProject: (id) => request('DELETE', '/api/projects/' + id),
    // 问题
    getIssues: (params) => {
      const qs = new URLSearchParams();
      if (params && params.projectId) qs.set('project_id', params.projectId);
      if (params && params.status) qs.set('status', params.status);
      if (params && params.q) qs.set('q', params.q);
      const s = qs.toString();
      return request('GET', '/api/issues' + (s ? '?' + s : ''));
    },
    getIssue: (id) => request('GET', '/api/issues/' + id),
    addIssue: (i) => request('POST', '/api/issues', i),
    updateIssue: (id, i) => request('PUT', '/api/issues/' + id, i),
    deleteIssue: (id) => request('DELETE', '/api/issues/' + id),
    // 测试管理
    getTestCases: (params) => {
      const qs = new URLSearchParams();
      if (params && params.projectId) qs.set('project_id', params.projectId);
      const s = qs.toString();
      return request('GET', '/api/tests/cases' + (s ? '?' + s : ''));
    },
    addTestCase: (c) => request('POST', '/api/tests/cases', c),
    updateTestCase: (id, c) => request('PUT', '/api/tests/cases/' + id, c),
    deleteTestCase: (id) => request('DELETE', '/api/tests/cases/' + id),
    getTestSuites: () => request('GET', '/api/tests/suites'),
    addTestSuite: (s) => request('POST', '/api/tests/suites', s),
    updateTestSuite: (id, s) => request('PUT', '/api/tests/suites/' + id, s),
    deleteTestSuite: (id) => request('DELETE', '/api/tests/suites/' + id),
    getTestRuns: () => request('GET', '/api/tests/runs'),
    addTestRun: (r) => request('POST', '/api/tests/runs', r),
    updateTestRun: (id, r) => request('PUT', '/api/tests/runs/' + id, r),
    deleteTestRun: (id) => request('DELETE', '/api/tests/runs/' + id),
    getExecutions: (runId) => request('GET', '/api/tests/executions' + (runId ? '?run_id=' + runId : '')),
    setExecution: (id, e) => request('PUT', '/api/tests/executions/' + id, e),
    getReports: () => request('GET', '/api/tests/reports'),
    addReport: (runId, name) => request('POST', '/api/tests/reports', { runId, name }),
    deleteReport: (id) => request('DELETE', '/api/tests/reports/' + id)
  };
})();
