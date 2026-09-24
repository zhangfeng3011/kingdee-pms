/* 金蝶项目管理系统 - 前端主逻辑 */
(function () {
  'use strict';

  // ---------- 工具 ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = (n) => { n = Number(n) || 0; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  let toastTimer = null;
  function toast(msg, type) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  function openModal(html) { $('#modalBox').innerHTML = html; $('#modalMask').classList.remove('hidden'); }
  function closeModal() { $('#modalMask').classList.add('hidden'); }

  function confirmBox(text) {
    return new Promise((resolve) => {
      $('#confirmText').textContent = text;
      $('#confirmMask').classList.remove('hidden');
      const ok = $('#confirmOk'), cancel = $('#confirmCancel');
      const clean = () => { $('#confirmMask').classList.add('hidden'); ok.onclick = null; cancel.onclick = null; };
      ok.onclick = () => { clean(); resolve(true); };
      cancel.onclick = () => { clean(); resolve(false); };
    });
  }

  // ---------- 全局状态 ----------
  let membersCache = [];
  let myIssuesCache = [];
  async function loadMembers() {
    try { const d = await Api.getMembers(); membersCache = d.members || []; } catch (e) { membersCache = []; }
  }

  const PROJ_STATUS = ['待测试', '测试中', '已完成'];
  const ISSUE_STATUS = ['待处理', '进行中', '已完成'];
  const PROJ_COLORS = { '待测试': '#f08c00', '测试中': '#1f4fd8', '已完成': '#0ca678' };
  const ISSUE_COLORS = { '待处理': '#f08c00', '进行中': '#1f4fd8', '已完成': '#0ca678' };

  function statusBadge(status, map) {
    const colors = map || ISSUE_COLORS;
    const cls = status === '已完成' ? 'badge-green' : status === '待处理' ? 'badge-orange' : 'badge-blue';
    return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
  }

  // ---------- 登录 / 注册 ----------
  function initLogin() {
    const switchTab = (mode) => {
      $('#tabLogin').classList.toggle('active', mode === 'login');
      $('#tabRegister').classList.toggle('active', mode === 'register');
      $('#loginBtn').textContent = mode === 'login' ? '登 录' : '注 册';
      $('#loginMsg').textContent = '';
    };
    $('#tabLogin').onclick = () => switchTab('login');
    $('#tabRegister').onclick = () => switchTab('register');

    $('#loginBtn').onclick = async () => {
      const name = $('#loginName').value.trim();
      const password = $('#loginPassword').value;
      if (!name) { $('#loginMsg').textContent = '请输入姓名'; return; }
      if (!password) { $('#loginMsg').textContent = '请输入密码'; return; }
      const isLogin = $('#tabLogin').classList.contains('active');
      try {
        const d = isLogin ? await Api.login(name, password) : await Api.register(name, password);
        Api.setSession(d.token, d.user);
        toast(isLogin ? '登录成功' : '注册成功，已自动登录', 'success');
        enterApp();
      } catch (e) {
        $('#loginMsg').textContent = e.message;
      }
    };
    $('#loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#loginBtn').click(); });
  }

  function showLogin() {
    $('#app').classList.add('hidden');
    $('#loginPage').classList.remove('hidden');
  }

  function enterApp() {
    $('#loginPage').classList.add('hidden');
    $('#app').classList.remove('hidden');
    const user = Api.getUser();
    $('#currentUser').textContent = user ? user.name : '';
    renderNav();
    route();
    updateBell();
  }

  $('#bellBtn').onclick = showMyIssues;
  $('#logoutBtn').onclick = () => { Api.clearSession(); showLogin(); };

  // ---------- 导航 ----------
  function renderNav() {
    const user = Api.getUser();
    const isAdmin = !!(user && user.isAdmin);
    const nav = $('#sidebarNav');
    const current = location.hash.split('?')[0];
    const active = (p) => current === p ? 'active' : '';

    let html = '';
    html += '<button class="nav-item nav-parent ' + (current === '#/board/project' || current === '#/board/issue' ? 'active' : '') + '" data-toggle="board">项目看板<span class="arrow">▶</span></button>';
    html += '<div class="nav-sub' + ((current === '#/board/project' || current === '#/board/issue') ? ' open' : '') + '">';
    html += '<button class="nav-item ' + active('#/board/project') + '" data-route="#/board/project"><span>项目状态看板</span></button>';
    html += '<button class="nav-item ' + active('#/board/issue') + '" data-route="#/board/issue"><span>问题处理看板</span></button>';
    html += '</div>';
    html += '<button class="nav-item ' + active('#/projects') + '" data-route="#/projects">项目管理</button>';

    // 测试管理（父级：用例管理[三级] / 问题列表 / 测试单 / 测试执行 / 测试报告）
    const testsRoutes = ['#/tests/cases', '#/tests/lib', '#/tests/suites', '#/tests/runs', '#/tests/executions', '#/tests/reports'];
    const testsOpen = testsRoutes.indexOf(current) >= 0;
    const caseLibRoutes = ['#/tests/cases', '#/tests/lib', '#/tests/suites'];
    const caseLibOpen = caseLibRoutes.indexOf(current) >= 0;
    html += '<button class="nav-item nav-parent ' + (testsOpen ? 'open' : '') + '" data-toggle="tests">测试管理<span class="arrow">▶</span></button>';
    html += '<div class="nav-sub' + (testsOpen ? ' open' : '') + '">';
    html += '<button class="nav-item nav-parent2 ' + (caseLibOpen ? 'open' : '') + '" data-toggle="caseLib">用例管理<span class="arrow">▶</span></button>';
    html += '<div class="nav-sub2' + (caseLibOpen ? ' open' : '') + '">';
    html += '<button class="nav-item ' + active('#/tests/cases') + '" data-route="#/tests/cases"><span>测试用例</span></button>';
    html += '<button class="nav-item ' + active('#/tests/lib') + '" data-route="#/tests/lib"><span>用例库</span></button>';
    html += '<button class="nav-item ' + active('#/tests/suites') + '" data-route="#/tests/suites"><span>测试套件</span></button>';
    html += '</div>';
    html += '<button class="nav-item ' + active('#/tests/runs') + '" data-route="#/tests/runs"><span>测试单</span></button>';
    html += '<button class="nav-item ' + active('#/tests/executions') + '" data-route="#/tests/executions"><span>测试执行</span></button>';
    html += '<button class="nav-item ' + active('#/tests/reports') + '" data-route="#/tests/reports"><span>测试报告</span></button>';
    html += '</div>';

    html += '<button class="nav-item ' + active('#/issues') + '" data-route="#/issues">问题管理</button>';
    html += '<button class="nav-item ' + active('#/hours') + '" data-route="#/hours">工时统计</button>';
    html += '<button class="nav-item ' + active('#/warn') + '" data-route="#/warn">风险项目预警</button>';
    if (isAdmin) {
      html += '<button class="nav-item ' + active('#/members') + '" data-route="#/members">成员管理</button>';
    }
    nav.innerHTML = html;

    nav.querySelectorAll('[data-route]').forEach(btn => {
      btn.onclick = () => { location.hash = btn.dataset.route; };
    });
    nav.querySelectorAll('[data-toggle]').forEach(t => {
      t.onclick = () => {
        const sub = t.nextElementSibling;
        if (sub && (sub.classList.contains('nav-sub') || sub.classList.contains('nav-sub2'))) {
          sub.classList.toggle('open');
          t.classList.toggle('open');
        }
      };
    });
  }

  // ---------- 工时统计 ----------
  let hFilter = { range: 'all', projectId: 'all' };

  async function renderHours() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dp = await Api.getProjects();
      const di = await Api.getIssues();
      const projects = dp.projects || [];
      const issues = di.issues || [];

      // 时间过滤
      let startD = null;
      if (hFilter.range === 'month') startD = today().slice(0, 8) + '01';
      else if (hFilter.range === '30d') {
        const d30 = new Date(); d30.setDate(d30.getDate() - 30);
        startD = d30.getFullYear() + '-' + String(d30.getMonth() + 1).padStart(2, '0') + '-' + String(d30.getDate()).padStart(2, '0');
      }
      let list = issues.filter(i => Number(i.hours) > 0);
      if (hFilter.projectId !== 'all') list = list.filter(i => i.projectId === Number(hFilter.projectId));
      if (startD) list = list.filter(i => (i.createdDate || '') >= startD);

      const projName = id => { const p = projects.find(x => x.id === id); return p ? p.name : ('#' + id); };
      const hourBy = new Map();      // dev -> Map(projectId -> hours)
      const projHours = new Map();   // projectId -> hours
      const devIssueCnt = new Map(); // dev -> 问题数
      let totalHours = 0;
      list.forEach(i => {
        const devs = (i.developers && i.developers.length) ? i.developers : ['未指派'];
        const h = Number(i.hours) || 0;
        totalHours += h;
        projHours.set(i.projectId, (projHours.get(i.projectId) || 0) + h);
        devs.forEach(d => {
          if (!hourBy.has(d)) hourBy.set(d, new Map());
          hourBy.get(d).set(i.projectId, (hourBy.get(d).get(i.projectId) || 0) + h);
          devIssueCnt.set(d, (devIssueCnt.get(d) || 0) + 1);
        });
      });

      const projIds = Array.from(projHours.keys()).sort((a, b) => (projHours.get(b) || 0) - (projHours.get(a) || 0));
      const devs = Array.from(hourBy.keys());
      const devTotal = d => Array.from(hourBy.get(d).values()).reduce((s, v) => s + v, 0);
      const devsSorted = devs.slice().sort((a, b) => devTotal(b) - devTotal(a));
      const avg = devs.length ? Math.round(totalHours / devs.length * 10) / 10 : 0;

      // 缓存当前统计供导出
      window.hCache = { devs: devsSorted, projIds: projIds, hourBy: hourBy, projHours: projHours,
        devIssueCnt: devIssueCnt, projName: projName, devTotal: devTotal, totalHours: totalHours, listLen: list.length };

      const empty = !devs.length;
      const unassigned = issues.filter(i => Number(i.hours) > 0 && (!i.developers || !i.developers.length)).length;

      let html = '';
      html += '<div class="page-head"><div class="page-title">工时统计</div></div>';
      html += '<div class="hours-bar">' +
        '<select id="hRange">' +
        '<option value="all"' + (hFilter.range === 'all' ? ' selected' : '') + '>全部时间</option>' +
        '<option value="month"' + (hFilter.range === 'month' ? ' selected' : '') + '>本月</option>' +
        '<option value="30d"' + (hFilter.range === '30d' ? ' selected' : '') + '>近30天</option>' +
        '</select>' +
        '<select id="hProject">' +
        '<option value="all"' + (hFilter.projectId === 'all' ? ' selected' : '') + '>全部项目</option>' +
        projects.map(p => '<option value="' + p.id + '"' + (hFilter.projectId === String(p.id) ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') +
        '</select>' +
        '<button class="btn primary" onclick="exportHoursCsv()">导出CSV</button>' +
        '</div>';

      html += '<div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-num">' + totalHours + '</div><div class="stat-label">总工时（小时）</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + list.length + '</div><div class="stat-label">计入工时的问题</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + devs.length + '</div><div class="stat-label">参与开发人员</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + avg + '</div><div class="stat-label">人均工时（小时）</div></div>' +
        '</div>';

      if (empty) {
        html += '<div class="card card-pad"><div class="empty">暂无工时数据。在「问题管理」中为问题填写工时后，这里会自动按开发人员与项目汇总。</div></div>';
      } else {
        html += '<div class="card card-pad"><div class="chart-title">开发人员 × 项目工时明细（小时）</div><div class="table-wrap">';
        html += '<table class="table hours-table"><thead><tr><th>开发人员</th>' +
          projIds.map(id => '<th>' + esc(projName(id)) + '</th>').join('') +
          '<th>合计</th><th>问题数</th></tr></thead><tbody>';
        devsSorted.forEach(d => {
          html += '<tr><td class="h-name">' + esc(d) + '</td>';
          projIds.forEach(id => {
            const v = hourBy.get(d).get(id) || 0;
            html += '<td>' + (v ? Math.round(v * 10) / 10 : '—') + '</td>';
          });
          html += '<td class="h-total">' + Math.round(devTotal(d) * 10) / 10 + '</td><td>' + (devIssueCnt.get(d) || 0) + '</td></tr>';
        });
        html += '<tr class="h-row-total"><td>项目合计</td>' +
          projIds.map(id => '<td class="h-total">' + Math.round((projHours.get(id) || 0) * 10) / 10 + '</td>').join('') +
          '<td class="h-total">' + totalHours + '</td><td>' + list.length + '</td></tr>';
        html += '</tbody></table></div></div>';

        const maxH = Math.max.apply(null, devsSorted.map(devTotal));
        let bars = '';
        devsSorted.forEach(d => {
          const v = devTotal(d);
          const w = maxH ? Math.round(v / maxH * 100) : 0;
          bars += '<div class="hbar-row"><div class="hbar-name">' + esc(d) + '</div><div class="hbar-track"><div class="hbar-fill" style="width:' + w + '%"></div></div><div class="hbar-val">' + Math.round(v * 10) / 10 + 'h</div></div>';
        });
        html += '<div class="card card-pad"><div class="chart-title">开发人员工时排行</div>' + bars + '</div>';

        const segColors = ['#1f4fd8', '#0ca678', '#f08c00', '#845ef7', '#e03131', '#12b886', '#f59f00', '#1971c2', '#cc5de8', '#2f9e44'];
        const projSegs = projIds.map((id, idx) => ({ value: Math.round((projHours.get(id) || 0) * 10) / 10, color: segColors[idx % segColors.length] }));
        html += '<div class="card card-pad"><div class="chart-title">项目工时占比</div><div class="donut-wrap">' + donut(projSegs, 200) + '</div><div class="donut-legend">' +
          projSegs.map((s, i) => '<div class="legend-item"><span class="legend-dot" style="background:' + s.color + '"></span>' + esc(projName(projIds[i])) + '：' + s.value + 'h</div>').join('') +
          '</div></div>';

        if (unassigned > 0) {
          html += '<div class="card card-pad"><div class="tip-warn">⚠ 有 ' + unassigned + ' 条工时记录未填写开发人员，已按「未指派」计入统计，建议在问题管理中补充。</div></div>';
        }
      }

      ph.innerHTML = html;
      const rSel = document.getElementById('hRange');
      const pSel = document.getElementById('hProject');
      if (rSel) rSel.onchange = function () { hFilter.range = this.value; renderHours(); };
      if (pSel) pSel.onchange = function () { hFilter.projectId = this.value; renderHours(); };
    } catch (e) {
      ph.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  function exportHoursCsv() {
    const c = window.hCache;
    if (!c || !c.devs.length) { toast('暂无可导出的工时数据', 'error'); return; }
    const rows = [];
    rows.push(['开发人员'].concat(c.projIds.map(id => c.projName(id))).concat(['合计', '问题数']).join(','));
    c.devs.forEach(d => {
      const cells = [d];
      c.projIds.forEach(id => cells.push(c.hourBy.get(d).get(id) || 0));
      cells.push(c.devTotal(d), c.devIssueCnt.get(d) || 0);
      rows.push(cells.join(','));
    });
    rows.push(['项目合计'].concat(c.projIds.map(id => Math.round((c.projHours.get(id) || 0) * 10) / 10)).concat([c.totalHours, c.listLen]).join(','));
    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '工时统计.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('已导出工时统计 CSV', 'success');
  }

  // ---------- 风险项目预警 ----------
  function daysSince(dateStr) {
    if (!dateStr) return 0;
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return 0;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  }

  async function renderWarn() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dp = await Api.getProjects();
      const di = await Api.getIssues();
      const projects = dp.projects || [];
      const issues = di.issues || [];

      const rows = projects.map(p => {
        const its = issues.filter(i => i.projectId === p.id);
        const open = its.filter(i => i.status !== '已完成');
        const overdue = open.filter(i => daysSince(i.createdDate) >= 7);
        let level = 'normal', levelLabel = '正常', levelColor = '#0ca678';
        if (overdue.length > 0) { level = 'high'; levelLabel = '高风险'; levelColor = '#e03131'; }
        else if (open.length > 0) { level = 'mid'; levelLabel = '中风险'; levelColor = '#f08c00'; }
        const overdueMax = overdue.length ? Math.max.apply(null, overdue.map(i => daysSince(i.createdDate))) : 0;
        return { p, open: open.length, overdue: overdue.length, overdueMax, level, levelLabel, levelColor };
      });
      const rank = { high: 0, mid: 1, normal: 2 };
      const sorted = rows.slice().sort((a, b) => (rank[a.level] - rank[b.level]) || (b.open - a.open));
      const high = rows.filter(r => r.level === 'high').length;
      const mid = rows.filter(r => r.level === 'mid').length;
      const safe = rows.length - high - mid;

      let html = '<div class="page-head"><div class="page-title">风险项目预警</div></div>';
      html += '<div class="kpi-grid">';
      html += kpi('项目总数', projects.length);
      html += kpi('高风险', high, '#e03131');
      html += kpi('中风险', mid, '#f08c00');
      html += kpi('正常', safe, '#0ca678');
      html += '</div>';

      html += '<div class="card card-pad"><div class="chart-title">风险项目清单</div>';
      if (projects.length === 0) {
        html += '<div class="empty"><div class="empty-text">暂无项目，去「项目管理」创建第一个项目吧</div></div>';
      } else {
        html += '<table class="table"><thead><tr><th>项目名称</th><th>项目状态</th><th>未解决问题</th><th>超期问题（≥7天）</th><th>风险等级</th><th>操作</th></tr></thead><tbody>';
        sorted.forEach(r => {
          const badgeHtml = r.level === 'high'
            ? '<span class="badge" style="background:#ffe3e3;color:#e03131">高风险</span>'
            : r.level === 'mid'
              ? '<span class="badge badge-orange">中风险</span>'
              : '<span class="badge badge-green">正常</span>';
          html += '<tr>' +
            '<td><a class="link-btn" href="#/projects/' + r.p.id + '">' + esc(r.p.name) + '</a></td>' +
            '<td>' + statusBadge(r.p.status, PROJ_COLORS) + '</td>' +
            '<td>' + (r.open ? '<span style="color:#e03131;font-weight:700">' + r.open + '</span>' : '—') + '</td>' +
            '<td>' + (r.overdue ? '<span style="color:#e03131;font-weight:700">' + r.overdue + ' 个（最长 ' + r.overdueMax + ' 天）</span>' : '—') + '</td>' +
            '<td>' + badgeHtml + '</td>' +
            '<td><a class="link-btn" href="#/projects/' + r.p.id + '">查看项目 →</a></td>' +
            '</tr>';
        });
        html += '</tbody></table>';
        html += '<div style="margin-top:12px;color:#6b7280;font-size:13px">风险规则：项目存在「待处理/进行中」问题 = 中风险；其中创建超过 7 天仍未完成 = 高风险。请及时到「问题列表」处理超期问题。</div>';
      }
      html += '</div>';

      ph.innerHTML = html;
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  // ---------- 路由 ----------
  function route() {
    const user = Api.getUser();
    if (!user) { showLogin(); return; }
    const hash = location.hash || '#/board/project';
    renderNav();
    updateBell();
    if (hash === '#/login') { showLogin(); return; }
    if (hash.startsWith('#/projects/')) { renderProjectDetail(hash); return; }
    switch (hash) {
      case '#/board/project': renderProjectBoard(); break;
      case '#/board/issue': renderIssueBoard(); break;
      case '#/projects': renderProjects(); break;
      case '#/issues': renderIssues(); break;
      case '#/tests/cases': renderTestCases(); break;
      case '#/tests/lib': renderCaseLib(); break;
      case '#/tests/suites': renderTestSuites(); break;
      case '#/tests/runs': renderTestRuns(); break;
      case '#/tests/executions': renderTestExecutions(); break;
      case '#/tests/reports': renderTestReports(); break;
      case '#/hours': renderHours(); break;
      case '#/warn': renderWarn(); break;
      case '#/members':
        if (user.isAdmin) renderMembers();
        else { toast('无权限访问成员管理', 'error'); location.hash = '#/projects'; }
        break;
      default: renderProjectBoard();
    }
  }

  window.addEventListener('hashchange', route);

  // ---------- SVG 环形图 ----------
  function donut(segments, size) {
    // segments: [{value, color, label}]
    const total = segments.reduce((s, x) => s + x.value, 0);
    const r = 54, cx = size / 2, cy = size / 2;
    const C = 2 * Math.PI * r;
    if (total <= 0) {
      return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#f1f3f5" stroke-width="18"/>' +
        '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" fill="#adb3bd" font-size="14">暂无数据</text></svg>';
    }
    let offset = 0;
    let arcs = '';
    segments.forEach(seg => {
      const frac = seg.value / total;
      const dash = frac * C;
      arcs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + seg.color + '" stroke-width="18" stroke-dasharray="' + dash + ' ' + (C - dash) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      offset += dash;
    });
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + arcs +
      '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="700" fill="#1e2430">' + total + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#adb3bd">总计</text></svg>';
  }

  // ---------- 项目状态看板 ----------
  async function renderProjectBoard() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dp = await Api.getProjects();
      const di = await Api.getIssues();
      const projects = dp.projects || [];
      const issues = di.issues || [];

      const count = (s) => projects.filter(p => p.status === s).length;
      const total = projects.length;

      // 各项目进度：按问题完成率
      const projProgress = projects.map(p => {
        const its = issues.filter(i => i.projectId === p.id);
        const done = its.filter(i => i.status === '已完成').length;
        const rate = its.length ? Math.round(done / its.length * 100) : 0;
        return { p, total: its.length, done, rate };
      }).sort((a, b) => b.rate - a.rate).slice(0, 6);

      // 风险项目：存在未解决问题的项目
      const riskMap = new Map();
      issues.forEach(i => {
        if (i.status !== '已完成') {
          if (!riskMap.has(i.projectId)) riskMap.set(i.projectId, 0);
          riskMap.set(i.projectId, riskMap.get(i.projectId) + 1);
        }
      });
      const riskProjects = projects.filter(p => riskMap.has(p.id))
        .map(p => ({ p, n: riskMap.get(p.id) })).sort((a, b) => b.n - a.n).slice(0, 5);

      const recent = projects.slice(0, 5);

      let html = '<div class="page-head"><div class="page-title">项目状态看板</div></div>';
      html += '<div class="kpi-grid">';
      html += kpi('项目总数', total);
      html += kpi('待测试', count('待测试'), '#f08c00');
      html += kpi('测试中', count('测试中'), '#1f4fd8');
      html += kpi('已完成', count('已完成'), '#0ca678');
      html += '</div>';

      html += '<div class="chart-grid">';
      html += '<div class="chart-card"><div class="chart-title">项目状态分布</div><div style="text-align:center">' +
        donut([{ value: count('待测试'), color: '#f08c00' }, { value: count('测试中'), color: '#1f4fd8' }, { value: count('已完成'), color: '#0ca678' }], 180) +
        '</div><div class="legend"><span><i style="background:#f08c00"></i>待测试</span><span><i style="background:#1f4fd8"></i>测试中</span><span><i style="background:#0ca678"></i>已完成</span></div></div>';

      html += '<div class="chart-card"><div class="chart-title">各项目开发进度（按问题完成率）</div>';
      if (projProgress.length === 0) html += '<div class="empty"><div class="empty-text">暂无项目数据</div></div>';
      else projProgress.forEach(x => {
        html += '<div class="bar-row"><div class="bar-label" title="' + esc(x.p.name) + '">' + esc(x.p.name) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + x.rate + '%"></div></div><div class="bar-val">' + x.rate + '%</div></div>';
      });
      html += '</div>';
      html += '</div>';

      // 近期新增项目
      html += '<div class="card card-pad" style="margin-bottom:16px"><div class="chart-title">近期新增项目</div>';
      if (recent.length === 0) html += '<div class="empty"><div class="empty-text">暂无项目，去「项目管理」创建第一个项目吧</div></div>';
      else {
        html += '<table class="table"><thead><tr><th>项目名称</th><th>状态</th><th>项目经理</th><th>开发顾问</th><th>进度</th><th></th></tr></thead><tbody>';
        recent.forEach(x => {
          const its = issues.filter(i => i.projectId === x.id);
          const done = its.filter(i => i.status === '已完成').length;
          const rate = its.length ? Math.round(done / its.length * 100) : 0;
          html += '<tr><td><a class="link-btn" href="#/projects/' + x.id + '">' + esc(x.name) + '</a></td>' +
            '<td>' + statusBadge(x.status, PROJ_COLORS) + '</td>' +
            '<td>' + (x.projectManagers.length ? esc(x.projectManagers.join('、')) : '—') + '</td>' +
            '<td>' + (x.developmentConsultants.length ? esc(x.developmentConsultants.join('、')) : '—') + '</td>' +
            '<td><div class="progress-bar" style="width:120px"><div class="progress-fill" style="width:' + rate + '%"></div></div></td>' +
            '<td><span style="font-size:12px;color:#6b7280">' + rate + '%</span></td></tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';

      // 风险预警
      html += '<div class="card card-pad"><div class="chart-title">⚠ 风险项目预警（存在未解决问题）</div>';
      if (riskProjects.length === 0) html += '<div class="empty"><div class="empty-text">所有项目均无未解决问题 🎉</div></div>';
      else {
        html += '<table class="table"><thead><tr><th>项目名称</th><th>状态</th><th>未解决问题数</th><th></th></tr></thead><tbody>';
        riskProjects.forEach(x => {
          html += '<tr><td><a class="link-btn" href="#/projects/' + x.p.id + '">' + esc(x.p.name) + '</a></td><td>' + statusBadge(x.p.status, PROJ_COLORS) + '</td><td><span style="color:#e03131;font-weight:700">' + x.n + '</span></td><td><a class="link-btn" href="#/issues">去处理 →</a></td></tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';

      ph.innerHTML = html;
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  function kpi(label, num, color) {
    return '<div class="kpi-card"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-num" style="' + (color ? 'color:' + color : '') + '">' + num + '</div></div>';
  }

  // ---------- 问题处理看板 ----------
  async function renderIssueBoard() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dp = await Api.getProjects();
      const di = await Api.getIssues();
      const projects = dp.projects || [];
      const issues = di.issues || [];
      const total = issues.length;
      const cnt = (s) => issues.filter(i => i.status === s).length;
      const unresolved = issues.filter(i => i.status !== '已完成').length;

      // 各项目已解决 vs 未解决
      const projStats = projects.map(p => {
        const its = issues.filter(i => i.projectId === p.id);
        const done = its.filter(i => i.status === '已完成').length;
        return { p, done, undo: its.length - done, total: its.length };
      });

      const unresolvedList = issues.filter(i => i.status !== '已完成').slice(0, 10);

      let html = '<div class="page-head"><div class="page-title">问题处理看板</div></div>';
      html += '<div class="kpi-grid">';
      html += kpi('问题总数', total);
      html += kpi('待处理', cnt('待处理'), '#f08c00');
      html += kpi('进行中', cnt('进行中'), '#1f4fd8');
      html += kpi('已解决', cnt('已完成'), '#0ca678');
      html += '</div>';

      html += '<div class="chart-grid">';
      html += '<div class="chart-card"><div class="chart-title">问题状态分布</div><div style="text-align:center">' +
        donut([{ value: cnt('待处理'), color: '#f08c00' }, { value: cnt('进行中'), color: '#1f4fd8' }, { value: cnt('已完成'), color: '#0ca678' }], 180) +
        '</div><div class="legend"><span><i style="background:#f08c00"></i>待处理</span><span><i style="background:#1f4fd8"></i>进行中</span><span><i style="background:#0ca678"></i>已完成</span></div></div>';

      html += '<div class="chart-card"><div class="chart-title">各项目问题数量对比（已解决 vs 未解决）</div>';
      if (projStats.length === 0) html += '<div class="empty"><div class="empty-text">暂无问题数据</div></div>';
      else projStats.forEach(x => {
        const max = Math.max(1, ...projStats.map(s => s.total));
        html += '<div class="bar-row"><div class="bar-label" title="' + esc(x.p.name) + '">' + esc(x.p.name) + '</div>';
        html += '<div class="bar-track" style="display:flex;height:16px"><div class="bar-fill" style="width:' + (x.done / max * 100) + '%;background:#0ca678"></div><div class="bar-fill" style="width:' + (x.undo / max * 100) + '%;background:#f03e3e"></div></div>';
        html += '<div class="bar-val" style="width:auto;font-size:12px;color:#6b7280">' + x.done + '/' + x.undo + '</div></div>';
      });
      html += '<div class="legend"><span><i style="background:#0ca678"></i>已解决</span><span><i style="background:#f03e3e"></i>未解决</span></div>';
      html += '</div>';
      html += '</div>';

      html += '<div class="card card-pad"><div class="chart-title">未解决问题明细（最近 ' + unresolvedList.length + ' 条）</div>';
      if (unresolvedList.length === 0) html += '<div class="empty"><div class="empty-text">所有问题都已解决 🎉</div></div>';
      else {
        html += '<table class="table"><thead><tr><th>问题描述</th><th>所属项目</th><th>状态</th><th>创建时间</th><th>测试/开发</th><th></th></tr></thead><tbody>';
        unresolvedList.forEach(i => {
          html += '<tr><td class="desc-cell">' + esc(i.description.length > 40 ? i.description.slice(0, 40) + '…' : i.description) + '</td>' +
            '<td><a class="link-btn" href="#/projects/' + i.projectId + '">' + esc(i.projectName) + '</a></td>' +
            '<td>' + statusBadge(i.status) + '</td>' +
            '<td>' + esc(i.createdDate) + '</td>' +
            '<td><span style="font-size:12px;color:#6b7280">' + (i.testers.length ? esc(i.testers.join('、')) : '—') + ' / ' + (i.developers.length ? esc(i.developers.join('、')) : '—') + '</span></td>' +
            '<td><a class="link-btn" href="#/issues">去处理 →</a></td></tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';

      ph.innerHTML = html;
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  // ---------- 项目管理 ----------
  async function renderProjects() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dp = await Api.getProjects();
      const projects = dp.projects || [];
      const di = await Api.getIssues();
      const allIssues = di.issues || [];
      const issueCountMap = {};
      allIssues.forEach(i => { issueCountMap[i.projectId] = (issueCountMap[i.projectId] || 0) + 1; });
      let html = '<div class="page-head"><div class="page-title">项目管理</div>';
      html += '<button class="btn btn-primary" id="addProjectBtn">＋ 新建项目</button></div>';
      html += '<div class="toolbar"><input type="text" id="projSearch" placeholder="搜索项目名称/项目经理…" style="width:240px"><span style="color:#6b7280;font-size:13px">共 ' + projects.length + ' 个项目</span></div>';

      html += '<div class="card card-pad"><div class="table-wrap"><table class="table"><thead><tr><th>项目名称</th><th>状态</th><th>项目经理</th><th>实施顾问</th><th>开发顾问</th><th>计划周期</th><th>问题</th><th>操作</th></tr></thead><tbody id="projTbody">';
      html += '</tbody></table></div><div id="projEmpty" class="empty hidden"><div class="empty-icon">📁</div><div class="empty-text">暂无项目，点击右上角「新建项目」创建</div></div></div>';

      ph.innerHTML = html;

      const renderRows = (list) => {
        const tb = $('#projTbody');
        const empty = $('#projEmpty');
        if (!list.length) { tb.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');
        tb.innerHTML = list.map(p => {
          const cycle = (p.startDate || p.endDate) ? ((p.startDate || '?') + ' ~ ' + (p.endDate || '?')) : '—';
          return '<tr><td><a class="link-btn" href="#/projects/' + p.id + '">' + esc(p.name) + '</a>' + (p.description ? '<div style="font-size:12px;color:#adb3bd;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.description) + '</div>' : '') + '</td>' +
            '<td>' + statusBadge(p.status, PROJ_COLORS) + '</td>' +
            '<td>' + (p.projectManagers.length ? esc(p.projectManagers.join('、')) : '—') + '</td>' +
            '<td>' + (p.implementationConsultants.length ? esc(p.implementationConsultants.join('、')) : '—') + '</td>' +
            '<td>' + (p.developmentConsultants.length ? esc(p.developmentConsultants.join('、')) : '—') + '</td>' +
            '<td>' + esc(cycle) + '</td>' +
            '<td><a class="link-btn" href="#/projects/' + p.id + '">❗ ' + (issueCountMap[p.id] || 0) + ' 个问题</a></td>' +
            '<td class="row-actions"><button class="btn btn-sm" data-edit="' + p.id + '">编辑</button><button class="btn btn-sm btn-danger" data-del="' + p.id + '">删除</button></td></tr>';
        }).join('');
        tb.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openProjectModal(Number(b.dataset.edit)));
        tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (await confirmBox('确定删除该项目及其全部问题记录？')) {
            try { await Api.deleteProject(Number(b.dataset.del)); toast('已删除', 'success'); renderProjects(); } catch (e) { toast(e.message, 'error'); }
          }
        });
      };
      renderRows(projects);

      $('#addProjectBtn').onclick = () => openProjectModal(null);
      $('#projSearch').addEventListener('input', (e) => {
        const kw = e.target.value.trim().toLowerCase();
        renderRows(projects.filter(p =>
          !kw || p.name.toLowerCase().includes(kw) || (p.description || '').toLowerCase().includes(kw) ||
          p.projectManagers.some(m => m.toLowerCase().includes(kw)) ||
          p.developmentConsultants.some(m => m.toLowerCase().includes(kw)) ||
          p.implementationConsultants.some(m => m.toLowerCase().includes(kw))
        ));
      });
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  async function openProjectModal(id) {
    await loadMembers();
    let p = null;
    if (id) {
      try { const d = await Api.getProject(id); p = d.project; } catch (e) { toast(e.message, 'error'); return; }
    }
    openModal(
      '<div class="modal-title">' + (id ? '编辑项目' : '新建项目') + '</div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>项目名称 <span class="req">*</span><span class="opt">必填</span></label><input id="pmName" type="text" value="' + esc(p ? p.name : '') + '" placeholder="请输入项目名称"></div>' +
      '<div class="field"><label>项目描述 <span class="opt">（可选）</span></label><textarea id="pmDesc" placeholder="请输入项目描述">' + esc(p ? p.description : '') + '</textarea></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>项目状态 <span class="req">*</span></label><select id="pmStatus">' + PROJ_STATUS.map(s => '<option ' + ((p && p.status === s) ? 'selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>计划周期 <span class="opt">（可选）</span></label><div style="display:flex;gap:6px"><input type="date" id="pmStart" value="' + esc(p ? p.startDate : '') + '"><span style="line-height:36px;color:#adb3bd">~</span><input type="date" id="pmEnd" value="' + esc(p ? p.endDate : '') + '"></div></div>' +
      '</div>' +
      memberSelectHtml('pm', '项目经理', p ? p.projectManagers : []) +
      memberSelectHtml('pi', '实施顾问', p ? p.implementationConsultants : []) +
      memberSelectHtml('pd', '开发顾问', p ? p.developmentConsultants : []) +
      '</div>' +
      '<div class="modal-footer"><button class="btn" id="pmCancel">取消</button><button class="btn btn-primary" id="pmSave">保存</button></div>'
    );
    initMemberSelects();
    $('#pmCancel').onclick = closeModal;
    $('#pmSave').onclick = async () => {
      const name = $('#pmName').value.trim();
      if (!name) { toast('项目名称不能为空', 'error'); return; }
      if (!membersCache.length) { toast('请先在成员管理中添成员，再选择负责人', 'error'); return; }
      const data = {
        name,
        description: $('#pmDesc').value.trim(),
        status: $('#pmStatus').value,
        startDate: $('#pmStart').value,
        endDate: $('#pmEnd').value,
        projectManagers: getSel('pm'),
        implementationConsultants: getSel('pi'),
        developmentConsultants: getSel('pd')
      };
      try {
        if (id) { await Api.updateProject(id, data); toast('已保存', 'success'); }
        else { await Api.addProject(data); toast('项目已创建', 'success'); }
        closeModal(); renderProjects();
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  // ---------- 成员多选组件 ----------
  function memberSelectHtml(prefix, label, selected) {
    const sel = selected || [];
    return '<div class="field"><label>' + label + ' <span class="opt">（可选，可多选）</span></label>' +
      '<div class="member-select">' +
      '<div class="member-input-wrap" data-wrap="' + prefix + '">' +
      sel.map(n => '<span class="tag" data-name="' + esc(n) + '">' + esc(n) + '<span style="cursor:pointer;margin-left:4px" data-remove="' + prefix + '">×</span></span>').join('') +
      '<input type="text" style="border:none;outline:none;flex:1;min-width:80px;padding:2px" placeholder="' + (sel.length ? '' : '搜索选择成员') + '" data-search="' + prefix + '"></div>' +
      '<div class="member-list hidden" data-list="' + prefix + '"></div>' +
      '</div></div>';
  }

  function initMemberSelects() {
    $$('.member-input-wrap').forEach(wrap => {
      const prefix = wrap.dataset.wrap;
      const input = wrap.querySelector('[data-search]');
      const list = document.querySelector('[data-list="' + prefix + '"]');
      const selNames = () => Array.from(wrap.querySelectorAll('.tag')).map(t => t.dataset.name).filter(Boolean);

      const renderList = (kw) => {
        const sel = selNames();
        const items = membersCache.filter(m => !kw || m.name.toLowerCase().includes(kw.toLowerCase()));
        if (!items.length) { list.innerHTML = '<div class="member-option" style="color:#adb3bd">暂无成员</div>'; return; }
        list.innerHTML = items.map(m => {
          const checked = sel.includes(m.name);
          return '<div class="member-option" data-pick="' + prefix + '" data-name="' + esc(m.name) + '">' + esc(m.name) +
            (m.role ? ' <span style="font-size:12px;color:#adb3bd">' + esc(m.role) + '</span>' : '') +
            (checked ? '<span class="checked-mark">✓</span>' : '') + '</div>';
        }).join('');
      };

      input.addEventListener('focus', () => { renderList(''); list.classList.remove('hidden'); });
      input.addEventListener('input', () => renderList(input.value.trim()));
      document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) list.classList.add('hidden');
      });

      list.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-pick]');
        if (!opt) return;
        const name = opt.dataset.name;
        const exists = wrap.querySelector('.tag[data-name="' + CSS.escape(name) + '"]');
        if (exists) { exists.remove(); }
        else {
          const t = document.createElement('span');
          t.className = 'tag';
          t.dataset.name = name;
          t.innerHTML = esc(name) + '<span style="cursor:pointer;margin-left:4px" data-remove="' + prefix + '">×</span>';
          wrap.insertBefore(t, input);
        }
        // 指派给（ia）同步到开发人员（idv）
        if (prefix === 'ia') {
          const devWrap = document.querySelector('[data-wrap="idv"]');
          if (devWrap) {
            const devTag = devWrap.querySelector('.tag[data-name="' + CSS.escape(name) + '"]');
            if (exists && devTag) devTag.remove();
            if (!exists && !devTag) {
              const dt = document.createElement('span');
              dt.className = 'tag';
              dt.dataset.name = name;
              dt.innerHTML = esc(name) + '<span style="cursor:pointer;margin-left:4px" data-remove="idv">×</span>';
              devWrap.insertBefore(dt, devWrap.querySelector('[data-search]'));
            }
          }
        }
        renderList(input.value.trim());
      });

      wrap.addEventListener('click', (e) => {
        const rm = e.target.closest('[data-remove]');
        if (rm) {
          const name = rm.closest('.tag').dataset.name;
          rm.closest('.tag').remove();
          if (prefix === 'ia') {
            const devWrap = document.querySelector('[data-wrap="idv"]');
            if (devWrap) {
              const devTag = devWrap.querySelector('.tag[data-name="' + CSS.escape(name) + '"]');
              if (devTag) devTag.remove();
            }
          }
          if (input.value.trim()) renderList(input.value.trim());
        }
        else if (e.target === wrap) input.focus();
      });
    });
  }

  function getSel(prefix) {
    const wrap = document.querySelector('[data-wrap="' + prefix + '"]');
    if (!wrap) return [];
    return Array.from(wrap.querySelectorAll('.tag')).map(t => t.dataset.name).filter(Boolean);
  }

  // ---------- 项目详情 ----------
  async function renderProjectDetail(hash) {
    const id = Number(hash.split('/')[2]);
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dp = await Api.getProject(id);
      const di = await Api.getIssues({ projectId: id });
      const p = dp.project;
      const issues = di.issues || [];

      let html = '<div class="page-head"><div class="page-title"><a class="link-btn" href="#/projects">← 返回项目列表</a>　' + esc(p.name) + ' ' + statusBadge(p.status, PROJ_COLORS) + '</div>';
      html += '<button class="btn btn-primary" id="pdAddIssue">＋ 新增问题</button></div>';

      html += '<div class="card card-pad" style="margin-bottom:16px"><div class="chart-title">项目信息</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:13px">' +
        '<div>项目描述：' + (p.description ? esc(p.description) : '—') + '</div>' +
        '<div>计划周期：' + ((p.startDate || p.endDate) ? esc(p.startDate + ' ~ ' + p.endDate) : '—') + '</div>' +
        '<div>项目经理：' + (p.projectManagers.length ? esc(p.projectManagers.join('、')) : '—') + '</div>' +
        '<div>实施顾问：' + (p.implementationConsultants.length ? esc(p.implementationConsultants.join('、')) : '—') + '</div>' +
        '<div>开发顾问：' + (p.developmentConsultants.length ? esc(p.developmentConsultants.join('、')) : '—') + '</div>' +
        '<div>问题总数：' + issues.length + ' ｜ 已完成：' + p.doneCount + '</div>' +
        '</div></div>';

      html += '<div class="card card-pad"><div class="chart-title">开发问题记录（' + issues.length + '）</div><div class="table-wrap"><table class="table"><thead><tr><th>问题描述</th><th>状态</th><th>创建时间</th><th>处理时间</th><th>完成时间</th><th>工时</th><th>测试人员</th><th>开发人员</th><th>指派给</th><th>附件</th><th>操作</th></tr></thead><tbody>';
      if (!issues.length) html += '<tr><td colspan="11"><div class="empty"><div class="empty-text">暂无问题记录，点击「新增问题」添加</div></div></td></tr>';
      issues.forEach(i => {
        html += '<tr><td class="desc-cell ' + (i.status === '已完成' ? 'done-text' : '') + '">' + esc(i.description) + '</td>' +
          '<td>' + statusBadge(i.status) + '</td>' +
          '<td>' + esc(i.createdDate) + '</td>' +
          '<td>' + (i.handledDate ? esc(i.handledDate) : '—') + '</td>' +
          '<td>' + (i.completedDate ? esc(i.completedDate) : '—') + '</td>' +
          '<td>' + (i.hours ? i.hours + ' h' : '—') + '</td>' +
          '<td>' + (i.testers.length ? esc(i.testers.join('、')) : '—') + '</td>' +
          '<td>' + (i.developers.length ? esc(i.developers.join('、')) : '—') + '</td>' +
          '<td>' + (i.assignedTo && i.assignedTo.length ? esc(i.assignedTo.join('、')) : '—') + '</td>' +
          '<td>' + (i.attachments.length ? '<button class="link-btn" data-attach="' + i.id + '">📎 ' + i.attachments.length + '</button>' : '—') + '</td>' +
          '<td class="row-actions"><button class="btn btn-sm" data-edit="' + i.id + '">编辑</button><button class="btn btn-sm btn-danger" data-del="' + i.id + '">删除</button></td></tr>';
      });
      html += '</tbody></table></div></div>';

      ph.innerHTML = html;

      $('#pdAddIssue').onclick = () => openIssueModal(id, null);
      ph.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openIssueModal(id, Number(b.dataset.edit)));
      ph.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        if (await confirmBox('确定删除该问题记录？')) {
          try { await Api.deleteIssue(Number(b.dataset.del)); toast('已删除', 'success'); renderProjectDetail(hash); } catch (e) { toast(e.message, 'error'); }
        }
      });
      ph.querySelectorAll('[data-attach]').forEach(b => b.onclick = () => showAttachments(Number(b.dataset.attach)));
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  // ---------- 问题列表（全局） ----------
  async function renderIssues() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      await loadMembers();
      const dp = await Api.getProjects();
      const projects = dp.projects || [];
      const di = await Api.getIssues();
      let issues = di.issues || [];

      let html = '<div class="page-head"><div class="page-title">问题管理</div>';
      html += '<button class="btn btn-primary" id="addIssueBtn">＋ 新增问题</button></div>';
      html += '<div class="toolbar">' +
        '<input type="text" id="issueQ" placeholder="搜索问题描述/项目/人员…" style="width:220px">' +
        '<select id="issueProjFilter"><option value="">全部项目</option>' + projects.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('') + '</select>' +
        '<select id="issueStatusFilter"><option value="">全部状态</option><option>待处理</option><option>进行中</option><option>已完成</option></select>' +
        '<span style="color:#6b7280;font-size:13px">共 ' + issues.length + ' 条</span></div>';

      html += '<div class="card card-pad"><div class="table-wrap"><table class="table"><thead><tr><th>问题描述</th><th>所属项目</th><th>状态</th><th>创建时间</th><th>处理时间</th><th>工时</th><th>测试人员</th><th>开发人员</th><th>指派给</th><th>附件</th><th>关闭</th><th>操作</th></tr></thead><tbody id="issueTbody">';
      html += '</tbody></table></div><div id="issueEmpty" class="empty hidden"><div class="empty-icon">📝</div><div class="empty-text">暂无问题记录</div></div></div>';

      ph.innerHTML = html;

      const renderRows = (list) => {
        const tb = $('#issueTbody');
        const empty = $('#issueEmpty');
        if (!list.length) { tb.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');
        tb.innerHTML = list.map(i =>
          '<tr><td class="desc-cell ' + (i.status === '已完成' ? 'done-text' : '') + '">' + esc(i.description.length > 50 ? i.description.slice(0, 50) + '…' : i.description) + '</td>' +
          '<td><a class="link-btn" href="#/projects/' + i.projectId + '">' + esc(i.projectName) + '</a></td>' +
          '<td><button class="link-btn" data-status="' + i.id + '" data-cur="' + i.status + '" style="padding:0">' + statusBadge(i.status) + '</button></td>' +
          '<td>' + esc(i.createdDate) + '</td>' +
          '<td><input type="date" class="inline-ctrl" data-handle="' + i.id + '" value="' + esc(i.handledDate || '') + '"></td>' +
          '<td><input type="number" class="inline-ctrl inline-hours" data-hours="' + i.id + '" value="' + (i.hours || '') + '" min="0" step="0.5" placeholder="—"></td>' +
          '<td>' + (i.testers.length ? esc(i.testers.join('、')) : '—') + '</td>' +
          '<td data-dev>' + (i.developers.length ? esc(i.developers.join('、')) : '—') + '</td>' +
          '<td><div class="member-select assign-inline">' +
          '<div class="member-input-wrap" data-wrap="ai' + i.id + '" style="min-height:30px">' +
          (i.assignedTo && i.assignedTo.length ? i.assignedTo.map(n => '<span class="tag" data-name="' + esc(n) + '">' + esc(n) + '<span style="cursor:pointer;margin-left:4px" data-remove="ai' + i.id + '">×</span></span>').join('') : '') +
          '<input type="text" style="border:none;outline:none;flex:1;min-width:64px;padding:2px" placeholder="指派…" data-search="ai' + i.id + '"></div>' +
          '<div class="member-list hidden" data-list="ai' + i.id + '"></div>' +
          '</div></td>' +
          '<td>' + (i.attachments.length ? '<button class="link-btn" data-attach="' + i.id + '">📎 ' + i.attachments.length + '</button>' : '—') + '</td>' +
          '<td><input type="checkbox" data-close="' + i.id + '" ' + (i.status === '已完成' ? 'checked' : '') + '></td>' +
          '<td class="row-actions"><button class="btn btn-sm" data-edit="' + i.id + '">编辑</button><button class="btn btn-sm btn-danger" data-del="' + i.id + '">删除</button></td></tr>'
        ).join('');

        tb.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openIssueModal(null, Number(b.dataset.edit)));
        tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (await confirmBox('确定删除该问题？')) {
            try { await Api.deleteIssue(Number(b.dataset.del)); toast('已删除', 'success'); renderIssues(); } catch (e) { toast(e.message, 'error'); }
          }
        });
        tb.querySelectorAll('[data-attach]').forEach(b => b.onclick = () => showAttachments(Number(b.dataset.attach)));
        tb.querySelectorAll('[data-handle]').forEach(inp => inp.onchange = async () => {
          const id = Number(inp.dataset.handle);
          try {
            const d = await Api.getIssue(id);
            const i = d.issue;
            i.handledDate = inp.value;
            await Api.updateIssue(id, i);
            const c = issues.find(x => x.id === id);
            if (c) c.handledDate = inp.value;
            toast('处理时间已保存', 'success');
          } catch (e) { toast(e.message, 'error'); }
        });
        tb.querySelectorAll('[data-hours]').forEach(inp => inp.onchange = async () => {
          const id = Number(inp.dataset.hours);
          const val = Number(inp.value) || 0;
          try {
            const d = await Api.getIssue(id);
            const i = d.issue;
            i.hours = val;
            await Api.updateIssue(id, i);
            const c = issues.find(x => x.id === id);
            if (c) c.hours = val;
            toast('工时已保存', 'success');
          } catch (e) { toast(e.message, 'error'); }
        });
        tb.querySelectorAll('[data-close]').forEach(cb => cb.onchange = async () => {
          const id = Number(cb.dataset.close);
          try {
            const d = await Api.getIssue(id);
            const i = d.issue;
            i.status = cb.checked ? '已完成' : '待处理';
            if (cb.checked && !i.completedDate) i.completedDate = today();
            if (cb.checked && !i.handledDate) i.handledDate = today();
            if (!cb.checked) { i.completedDate = ''; i.handledDate = ''; }
            await Api.updateIssue(id, i);
            toast(cb.checked ? '问题已关闭' : '问题已重新开启', 'success');
            renderIssues();
          } catch (e) { toast(e.message, 'error'); cb.checked = !cb.checked; }
        });
        tb.querySelectorAll('[data-status]').forEach(btn => btn.onclick = async () => {
          const id = Number(btn.dataset.status);
          const cur = btn.dataset.cur;
          const next = cur === '待处理' ? '进行中' : cur === '进行中' ? '已完成' : '待处理';
          try {
            const d = await Api.getIssue(id);
            const i = d.issue;
            i.status = next;
            i.completedDate = next === '已完成' ? (i.completedDate || today()) : '';
            i.handledDate = next === '已完成' ? (i.handledDate || today()) : '';
            await Api.updateIssue(id, i);
            toast('状态已切换为：' + next, 'success');
            renderIssues();
          } catch (e) { toast(e.message, 'error'); }
        });
        initRowAssign(tb, issues);
      };
      renderRows(issues);

      $('#addIssueBtn').onclick = () => openIssueModal(null, null);

      const applyFilter = () => {
        const q = $('#issueQ').value.trim().toLowerCase();
        const pid = $('#issueProjFilter').value;
        const st = $('#issueStatusFilter').value;
        let list = issues;
        if (pid) list = list.filter(i => String(i.projectId) === pid);
        if (st) list = list.filter(i => i.status === st);
        if (q) list = list.filter(i =>
          i.description.toLowerCase().includes(q) ||
          (i.projectName || '').toLowerCase().includes(q) ||
          i.testers.some(t => t.toLowerCase().includes(q)) ||
          i.developers.some(t => t.toLowerCase().includes(q)));
        renderRows(list);
      };
      $('#issueQ').addEventListener('input', applyFilter);
      $('#issueProjFilter').addEventListener('change', applyFilter);
      $('#issueStatusFilter').addEventListener('change', applyFilter);
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  // ---------- 列表行内指派（指派给=开发人员） ----------
  function initRowAssign(tb, issuesList) {
    tb.querySelectorAll('.assign-inline').forEach(box => {
      const wrap = box.querySelector('[data-wrap]');
      const prefix = wrap.dataset.wrap;
      const id = Number(prefix.slice(2));
      const input = wrap.querySelector('[data-search]');
      const list = box.querySelector('[data-list]');
      const selNames = () => Array.from(wrap.querySelectorAll('.tag')).map(t => t.dataset.name).filter(Boolean);

      const renderList = (kw) => {
        const sel = selNames();
        const items = membersCache.filter(m => !kw || m.name.toLowerCase().includes(kw.toLowerCase()));
        if (!items.length) { list.innerHTML = '<div class="member-option" style="color:#adb3bd">暂无成员</div>'; return; }
        list.innerHTML = items.map(m => {
          const checked = sel.includes(m.name);
          return '<div class="member-option" data-name="' + esc(m.name) + '">' + esc(m.name) +
            (m.role ? ' <span style="font-size:12px;color:#adb3bd">' + esc(m.role) + '</span>' : '') +
            (checked ? '<span class="checked-mark">✓</span>' : '') + '</div>';
        }).join('');
      };

      const saveAssign = async () => {
        const names = selNames();
        try {
          const d = await Api.getIssue(id);
          const i = d.issue;
          i.assignedTo = names;
          i.developers = names;
          await Api.updateIssue(id, i);
          const c = issuesList.find(x => x.id === id);
          if (c) { c.assignedTo = names.slice(); c.developers = names.slice(); }
          const row = box.closest('tr');
          const devCell = row.querySelector('[data-dev]');
          if (devCell) devCell.textContent = names.length ? names.join('、') : '—';
          toast('已指派：' + (names.length ? names.join('、') : '未指派'), 'success');
        } catch (e) { toast(e.message, 'error'); }
      };

      input.addEventListener('focus', () => { renderList(''); list.classList.remove('hidden'); });
      input.addEventListener('input', () => renderList(input.value.trim()));
      document.addEventListener('click', (e) => {
        if (!box.contains(e.target)) list.classList.add('hidden');
      });
      list.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-name]');
        if (!opt) return;
        const name = opt.dataset.name;
        const tag = wrap.querySelector('.tag[data-name="' + CSS.escape(name) + '"]');
        if (tag) tag.remove();
        else {
          const t = document.createElement('span');
          t.className = 'tag';
          t.dataset.name = name;
          t.innerHTML = esc(name) + '<span style="cursor:pointer;margin-left:4px" data-remove="' + prefix + '">×</span>';
          wrap.insertBefore(t, input);
        }
        renderList(input.value.trim());
        saveAssign();
      });
      wrap.addEventListener('click', (e) => {
        const rm = e.target.closest('[data-remove]');
        if (rm) { rm.closest('.tag').remove(); saveAssign(); }
        else if (e.target === wrap) input.focus();
      });
    });
  }

  // ---------- 问题表单（含附件上传） ----------
  async function openIssueModal(projectId, id) {
    await loadMembers();
    let issue = null;
    let projects = [];
    try {
      const dp = await Api.getProjects();
      projects = dp.projects || [];
      if (id) {
        const d = await Api.getIssue(id);
        issue = d.issue;
      }
    } catch (e) { toast(e.message, 'error'); return; }
    if (!projects.length) { toast('请先创建项目，再添加问题', 'error'); return; }

    const defaultPid = issue ? issue.projectId : (projectId || '');
    openModal(
      '<div class="modal-title">' + (id ? '编辑问题' : '新增问题') + '</div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>所属项目 <span class="req">*</span><span class="opt">必填</span></label><select id="isProject">' +
      projects.map(p => '<option value="' + p.id + '" ' + (String(p.id) === String(defaultPid) ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>问题描述 <span class="req">*</span><span class="opt">必填</span></label><textarea id="isDesc" placeholder="请输入问题描述，可拖动右下角调整高度">' + esc(issue ? issue.description : '') + '</textarea></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>创建时间 <span class="req">*</span></label><input type="date" id="isDate" value="' + esc(issue ? issue.createdDate : today()) + '"></div>' +
      '<div class="field"><label>完成状态 <span class="req">*</span></label><select id="isStatus">' + ISSUE_STATUS.map(s => '<option ' + ((issue && issue.status === s) ? 'selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
      '</div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>处理时间</label><input type="date" id="isHandle" value="' + esc(issue && issue.handledDate ? issue.handledDate : '') + '"></div>' +
      '<div class="field"><label>工时（小时）</label><input type="number" id="isHours" min="0" step="0.5" value="' + (issue && issue.hours ? issue.hours : '') + '" placeholder="如：4"></div>' +
      '</div>' +
      memberSelectHtml('it', '测试人员', issue ? issue.testers : []) +
      memberSelectHtml('idv', '开发人员', issue ? issue.developers : []) +
      memberSelectHtml('ia', '指派给', issue && issue.assignedTo ? issue.assignedTo : []) +
      '<div class="field"><label>附件 <span class="opt">（可选，最多5个，单个≤5MB）</span></label>' +
      '<input type="file" id="isAttachFile" multiple style="display:none">' +
      '<div class="attach-list" id="isAttachList"></div>' +
      '<button class="btn btn-sm" id="isAttachBtn">＋ 上传附件</button></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn" id="isCancel">取消</button><button class="btn btn-primary" id="isSave">保存</button></div>'
    );
    initMemberSelects();

    let attachments = (issue && issue.attachments) ? issue.attachments.map(a => ({ id: a.id, name: a.name, size: a.size, type: a.type, data: a.data || '' })) : [];

    const renderAttachList = () => {
      const box = $('#isAttachList');
      if (!attachments.length) { box.innerHTML = ''; return; }
      box.innerHTML = attachments.map((a, idx) =>
        '<div class="attach-item"><span>📄</span><span class="att-name">' + esc(a.name) + '</span><span style="color:#adb3bd;font-size:12px">' + fmtSize(a.size) + '</span>' +
        '<button class="link-btn danger" data-rmatt="' + idx + '">移除</button></div>'
      ).join('');
      box.querySelectorAll('[data-rmatt]').forEach(b => b.onclick = () => { attachments.splice(Number(b.dataset.rmatt), 1); renderAttachList(); });
    };
    renderAttachList();

    $('#isAttachBtn').onclick = () => $('#isAttachFile').click();
    $('#isAttachFile').onchange = (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) {
        if (attachments.length >= 5) { toast('最多上传5个附件', 'error'); break; }
        if (f.size > 5 * 1024 * 1024) { toast('附件「' + f.name + '」超过5MB', 'error'); continue; }
        const reader = new FileReader();
        reader.onload = () => {
          attachments.push({ id: '', name: f.name, size: f.size, type: f.type, data: reader.result });
          renderAttachList();
        };
        reader.readAsDataURL(f);
      }
      e.target.value = '';
    };

    $('#isCancel').onclick = closeModal;
    $('#isSave').onclick = async () => {
      const desc = $('#isDesc').value.trim();
      if (!$('#isProject').value) { toast('请选择所属项目', 'error'); return; }
      if (!desc) { toast('问题描述不能为空', 'error'); return; }
      const data = {
        projectId: Number($('#isProject').value),
        description: desc,
        createdDate: $('#isDate').value || today(),
        status: $('#isStatus').value,
        handledDate: $('#isHandle').value,
        hours: Number($('#isHours').value) || 0,
        testers: getSel('it'),
        developers: getSel('idv'),
        assignedTo: getSel('ia'),
        attachments
      };
      try {
        if (id) { await Api.updateIssue(id, data); toast('已保存', 'success'); }
        else { await Api.addIssue(data); toast('问题已添加', 'success'); }
        closeModal();
        if (location.hash.startsWith('#/projects/')) renderProjectDetail(location.hash);
        else renderIssues();
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  // ---------- 附件查看 ----------
  async function showAttachments(issueId) {
    try {
      const d = await Api.getIssue(issueId);
      const atts = d.issue.attachments || [];
      if (!atts.length) { toast('无附件', 'error'); return; }
      $('#attachBox').innerHTML =
        '<div class="modal-title">附件列表（' + esc(d.issue.description.slice(0, 20)) + '…）</div>' +
        '<div class="modal-body">' + atts.map((a, idx) =>
          '<div class="attach-item"><span>📄</span><span class="att-name">' + esc(a.name) + '</span>' +
          '<span style="color:#adb3bd;font-size:12px">' + fmtSize(a.size) + '</span>' +
          '<button class="link-btn" data-preview="' + idx + '">预览</button>' +
          '<button class="link-btn" data-download="' + idx + '">下载</button></div>'
        ).join('') + '</div>' +
        '<div class="modal-footer"><button class="btn" id="attachClose">关闭</button></div>';
      $('#attachMask').classList.remove('hidden');
      $('#attachClose').onclick = () => $('#attachMask').classList.add('hidden');
      $('#attachBox').querySelectorAll('[data-preview]').forEach(b => b.onclick = () => {
        const a = atts[Number(b.dataset.preview)];
        window.open(a.data, '_blank');
      });
      $('#attachBox').querySelectorAll('[data-download]').forEach(b => b.onclick = () => {
        const a = atts[Number(b.dataset.download)];
        const link = document.createElement('a');
        link.href = a.data;
        link.download = a.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
    } catch (e) { toast(e.message, 'error'); }
  }

  // ---------- 成员管理 ----------
  async function renderMembers() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const d = await Api.getMembers();
      const members = d.members || [];
      let html = '<div class="page-head"><div class="page-title">成员管理</div>';
      html += '<button class="btn btn-primary" id="addMemberBtn">＋ 新增成员</button></div>';
      html += '<div class="toolbar"><input type="text" id="memberQ" placeholder="搜索姓名/角色…" style="width:220px"><span style="color:#6b7280;font-size:13px">共 ' + members.length + ' 名成员</span></div>';
      html += '<div class="card card-pad"><div class="table-wrap"><table class="table"><thead><tr><th>序号</th><th>姓名</th><th>职位/角色</th><th>创建时间</th><th>更新时间</th><th>操作</th></tr></thead><tbody id="memberTbody">';
      html += '</tbody></table></div><div id="memberEmpty" class="empty hidden"><div class="empty-icon">👥</div><div class="empty-text">暂无成员，点击「新增成员」添加</div></div></div>';
      ph.innerHTML = html;

      const renderRows = (list) => {
        const tb = $('#memberTbody');
        const empty = $('#memberEmpty');
        if (!list.length) { tb.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');
        tb.innerHTML = list.map((m, i) =>
          '<tr><td>' + (i + 1) + '</td><td><span class="tag">' + esc(m.name) + '</span></td>' +
          '<td>' + (m.role ? '<span class="badge badge-blue">' + esc(m.role) + '</span>' : '—') + '</td>' +
          '<td>' + esc(m.created_at) + '</td><td>' + esc(m.updated_at) + '</td>' +
          '<td class="row-actions"><button class="btn btn-sm" data-edit="' + m.id + '">编辑</button><button class="btn btn-sm btn-danger" data-del="' + m.id + '">删除</button></td></tr>'
        ).join('');
        tb.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openMemberModal(Number(b.dataset.edit), members));
        tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (await confirmBox('删除该成员后，其已分配的项目/问题中的名字会同步移除，确定删除？')) {
            try { await Api.deleteMember(Number(b.dataset.del)); toast('已删除', 'success'); renderMembers(); } catch (e) { toast(e.message, 'error'); }
          }
        });
      };
      renderRows(members);

      $('#addMemberBtn').onclick = () => openMemberModal(null, members);
      $('#memberQ').addEventListener('input', (e) => {
        const kw = e.target.value.trim().toLowerCase();
        renderRows(members.filter(m => !kw || m.name.toLowerCase().includes(kw) || (m.role || '').toLowerCase().includes(kw)));
      });
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  function openMemberModal(id, members) {
    const m = id ? members.find(x => x.id === id) : null;
    openModal(
      '<div class="modal-title">' + (id ? '编辑成员' : '新增成员') + '</div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>姓名 <span class="req">*</span><span class="opt">必填</span></label><input id="mbName" type="text" value="' + esc(m ? m.name : '') + '" placeholder="请输入姓名"></div>' +
      '<div class="field"><label>职位/角色 <span class="req">*</span><span class="opt">必选</span></label><select id="mbRole"><option value="">请选择职位</option>' +'<option value="项目经理"' + (m && m.role === '项目经理' ? ' selected' : '') + '>项目经理</option>' +'<option value="实施顾问"' + (m && m.role === '实施顾问' ? ' selected' : '') + '>实施顾问</option>' +'<option value="开发顾问"' + (m && m.role === '开发顾问' ? ' selected' : '') + '>开发顾问</option></select></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn" id="mbCancel">取消</button><button class="btn btn-primary" id="mbSave">保存</button></div>'
    );
    $('#mbCancel').onclick = closeModal;
    $('#mbSave').onclick = async () => {
      const name = $('#mbName').value.trim();
      const role = $('#mbRole').value;
      if (!name) { toast('姓名不能为空', 'error'); return; }
      if (!role) { toast('请选择职位/角色', 'error'); return; }
      try {
        if (id) { await Api.updateMember(id, name, role); toast('已保存', 'success'); }
        else { await Api.addMember(name, role); toast('成员已添加', 'success'); }
        closeModal(); renderMembers();
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  // ================= 测试管理 =================

  function priBadge(p) {
    if (p === '高') return '<span class="badge badge-red">高</span>';
    if (p === '低') return '<span class="badge badge-gray">低</span>';
    return '<span class="badge badge-orange">中</span>';
  }

  // ---------- 测试用例 ----------
  async function renderTestCases() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dp = await Api.getProjects();
      const projects = dp.projects || [];
      const dc = await Api.getTestCases();
      let cases = dc.testCases || [];

      let html = '<div class="page-head"><div class="page-title">测试用例</div>';
      html += '<button class="btn btn-primary" id="tcAdd">＋ 新增用例</button></div>';
      html += '<div class="toolbar">' +
        '<input type="text" id="tcQ" placeholder="搜索用例名称…" style="width:200px">' +
        '<select id="tcProj"><option value="">全部项目</option>' + projects.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('') + '</select>' +
        '<select id="tcPri"><option value="">全部优先级</option><option>高</option><option>中</option><option>低</option></select>' +
        '<span style="color:#6b7280;font-size:13px">共 ' + cases.length + ' 条</span></div>';

      html += '<div class="card card-pad"><div class="table-wrap"><table class="table"><thead><tr><th>用例名称</th><th>所属项目</th><th>优先级</th><th>状态</th><th>创建日期</th><th>操作</th></tr></thead><tbody id="tcTbody">';
      html += '</tbody></table></div><div id="tcEmpty" class="empty hidden"><div class="empty-icon">🧪</div><div class="empty-text">暂无测试用例，点击右上角新增</div></div></div>';
      ph.innerHTML = html;

      const renderRows = (list) => {
        const tb = $('#tcTbody');
        const empty = $('#tcEmpty');
        if (!list.length) { tb.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');
        tb.innerHTML = list.map(c =>
          '<tr><td><a class="link-btn" data-detail="' + c.id + '">' + esc(c.title) + '</a></td>' +
          '<td>' + esc(c.projectName) + '</td>' +
          '<td>' + priBadge(c.priority) + '</td>' +
          '<td>' + (c.status === '废弃' ? '<span class="badge badge-gray">废弃</span>' : '<span class="badge badge-green">正常</span>') + '</td>' +
          '<td>' + esc(c.created_date) + '</td>' +
          '<td class="row-actions"><button class="btn btn-sm" data-edit="' + c.id + '">编辑</button><button class="btn btn-sm btn-danger" data-del="' + c.id + '">删除</button></td></tr>'
        ).join('');
        tb.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openTestCaseModal(Number(b.dataset.edit)));
        tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (await confirmBox('确定删除该用例？')) {
            try { await Api.deleteTestCase(Number(b.dataset.del)); toast('已删除', 'success'); renderTestCases(); } catch (e) { toast(e.message, 'error'); }
          }
        });
        tb.querySelectorAll('[data-detail]').forEach(b => b.onclick = () => showCaseDetail(Number(b.dataset.detail)));
      };
      renderRows(cases);

      $('#tcAdd').onclick = () => openTestCaseModal(null);
      const applyFilter = () => {
        const q = $('#tcQ').value.trim().toLowerCase();
        const pid = $('#tcProj').value;
        const pri = $('#tcPri').value;
        let list = cases;
        if (pid) list = list.filter(c => String(c.project_id) === pid);
        if (pri) list = list.filter(c => c.priority === pri);
        if (q) list = list.filter(c => c.title.toLowerCase().includes(q));
        renderRows(list);
      };
      $('#tcQ').addEventListener('input', applyFilter);
      $('#tcProj').addEventListener('change', applyFilter);
      $('#tcPri').addEventListener('change', applyFilter);
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  function showCaseDetail(id) {
    Api.getTestCases().then(dc => {
      const c = (dc.testCases || []).find(x => x.id === id);
      if (!c) return;
      openModal(
        '<div class="modal-title">用例详情</div>' +
        '<div class="modal-body">' +
        '<div class="field"><label>用例名称</label><div>' + esc(c.title) + '</div></div>' +
        '<div class="field"><label>所属项目</label><div>' + esc(c.projectName) + '</div></div>' +
        '<div class="field"><label>优先级 / 状态</label><div>' + priBadge(c.priority) + ' ' + (c.status === '废弃' ? '<span class="badge badge-gray">废弃</span>' : '<span class="badge badge-green">正常</span>') + '</div></div>' +
        '<div class="field"><label>前置条件</label><div>' + esc(c.preconditions || '—') + '</div></div>' +
        '<div class="field"><label>操作步骤</label><div style="white-space:pre-wrap">' + esc(c.steps || '—') + '</div></div>' +
        '<div class="field"><label>预期结果</label><div style="white-space:pre-wrap">' + esc(c.expected || '—') + '</div></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn" id="cdClose">关闭</button></div>'
      );
      $('#cdClose').onclick = closeModal;
    }).catch(e => toast(e.message, 'error'));
  }

  async function openTestCaseModal(id) {
    let c = null;
    let projects = [];
    try {
      const dp = await Api.getProjects();
      projects = dp.projects || [];
      if (id) {
        const dc = await Api.getTestCases();
        c = (dc.testCases || []).find(x => x.id === id) || null;
      }
    } catch (e) { toast(e.message, 'error'); return; }
    if (!projects.length) { toast('请先创建项目，再添加用例', 'error'); return; }

    openModal(
      '<div class="modal-title">' + (id ? '编辑用例' : '新增用例') + '</div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>所属项目 <span class="req">*</span></label><select id="tcProjSel">' + projects.map(p => '<option value="' + p.id + '" ' + (c && c.project_id === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>用例名称 <span class="req">*</span></label><input id="tcTitle" value="' + (c ? esc(c.title) : '') + '" placeholder="如：登录功能校验"></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>优先级</label><select id="tcPriSel"><option>高</option><option selected>中</option><option>低</option></select></div>' +
      '<div class="field"><label>状态</label><select id="tcStatusSel"><option>正常</option><option>废弃</option></select></div>' +
      '</div>' +
      '<div class="field"><label>前置条件</label><textarea id="tcPre" placeholder="如：已注册账号、系统已部署">' + (c ? esc(c.preconditions || '') : '') + '</textarea></div>' +
      '<div class="field"><label>操作步骤</label><textarea id="tcSteps" placeholder="1. 打开登录页&#10;2. 输入账号密码&#10;3. 点击登录">' + (c ? esc(c.steps || '') : '') + '</textarea></div>' +
      '<div class="field"><label>预期结果</label><textarea id="tcExp" placeholder="如：登录成功，跳转首页">' + (c ? esc(c.expected || '') : '') + '</textarea></div>' +
      '<div class="form-msg" id="tcMsg"></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn" id="tcCancel">取消</button><button class="btn btn-primary" id="tcSave">保存</button></div>'
    );
    if (c) { $('#tcPriSel').value = c.priority; $('#tcStatusSel').value = c.status; }
    $('#tcCancel').onclick = closeModal;
    $('#tcSave').onclick = async () => {
      const body = {
        projectId: Number($('#tcProjSel').value),
        title: $('#tcTitle').value.trim(),
        priority: $('#tcPriSel').value,
        status: $('#tcStatusSel').value,
        preconditions: $('#tcPre').value,
        steps: $('#tcSteps').value,
        expected: $('#tcExp').value
      };
      if (!body.title) { $('#tcMsg').textContent = '请输入用例名称'; return; }
      try {
        if (id) await Api.updateTestCase(id, body);
        else await Api.addTestCase(body);
        toast('保存成功', 'success');
        closeModal();
        renderTestCases();
      } catch (e) { $('#tcMsg').textContent = e.message; }
    };
  }

  // ---------- 用例库 ----------
  async function renderCaseLib() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dp = await Api.getProjects();
      const projects = dp.projects || [];
      const dc = await Api.getTestCases();
      const cases = dc.testCases || [];

      const activeCases = cases.filter(c => c.status !== '废弃');
      const projGroups = projects.map(p => ({
        p,
        list: cases.filter(c => c.project_id === p.id && c.status !== '废弃')
      })).filter(g => g.list.length > 0);

      let html = '<div class="page-head"><div class="page-title">用例库</div></div>';
      html += '<div class="kpi-grid">';
      html += kpi('用例总数', cases.length);
      html += kpi('有效用例', activeCases.length);
      html += kpi('涉及项目', projGroups.length);
      html += '</div>';

      html += '<div class="card card-pad"><div class="chart-title">按项目浏览用例库</div>';
      if (!projGroups.length) html += '<div class="empty"><div class="empty-icon">📚</div><div class="empty-text">用例库为空，请先在「测试用例」中创建用例</div></div>';
      else projGroups.forEach(g => {
        html += '<div style="margin-bottom:16px"><div style="font-weight:600;margin-bottom:8px">📁 ' + esc(g.p.name) + '（' + g.list.length + ' 条）</div>';
        html += '<div class="table-wrap"><table class="table"><thead><tr><th>用例名称</th><th>优先级</th><th>前置条件</th><th>预期结果</th><th>创建日期</th></tr></thead><tbody>';
        g.list.forEach(c => {
          html += '<tr><td>' + esc(c.title) + '</td><td>' + priBadge(c.priority) + '</td><td>' + esc((c.preconditions || '—').slice(0, 30)) + '</td><td>' + esc((c.expected || '—').slice(0, 40)) + '</td><td>' + esc(c.created_date) + '</td></tr>';
        });
        html += '</tbody></table></div></div>';
      });
      html += '</div>';
      ph.innerHTML = html;
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  // ---------- 测试套件 ----------
  async function renderTestSuites() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const ds = await Api.getTestSuites();
      const suites = ds.testSuites || [];
      let html = '<div class="page-head"><div class="page-title">测试套件</div>';
      html += '<button class="btn btn-primary" id="tsAdd">＋ 新建套件</button></div>';
      html += '<div class="card card-pad"><div class="table-wrap"><table class="table"><thead><tr><th>套件名称</th><th>所属项目</th><th>用例数</th><th>描述</th><th>创建日期</th><th>操作</th></tr></thead><tbody>';
      if (!suites.length) html += '</tbody></table></div><div class="empty"><div class="empty-icon">📚</div><div class="empty-text">暂无测试套件，点击右上角新建</div></div></div>';
      else {
        suites.forEach(s => {
          html += '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.projectName) + '</td>' +
            '<td><button class="link-btn" data-cases="' + s.id + '">' + s.caseCount + ' 条</button></td>' +
            '<td>' + esc((s.desc || '—').slice(0, 40)) + '</td><td>' + esc(s.created_date) + '</td>' +
            '<td class="row-actions"><button class="btn btn-sm" data-edit="' + s.id + '">编辑</button><button class="btn btn-sm btn-danger" data-del="' + s.id + '">删除</button></td></tr>';
        });
        html += '</tbody></table></div></div>';
      }
      ph.innerHTML = html;
      $('#tsAdd').onclick = () => openSuiteModal(null);
      ph.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openSuiteModal(Number(b.dataset.edit)));
      ph.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        if (await confirmBox('确定删除该套件？')) {
          try { await Api.deleteTestSuite(Number(b.dataset.del)); toast('已删除', 'success'); renderTestSuites(); } catch (e) { toast(e.message, 'error'); }
        }
      });
      ph.querySelectorAll('[data-cases]').forEach(b => b.onclick = () => {
        const s = suites.find(x => x.id === Number(b.dataset.cases));
        if (!s) return;
        openModal('<div class="modal-title">套件用例（' + esc(s.name) + '）</div><div class="modal-body">' +
          (s.caseTitles && s.caseTitles.length ? s.caseTitles.map(tt => '<div style="padding:4px 0;border-bottom:1px solid #f1f3f5">• ' + esc(tt) + '</div>').join('') : '<div class="empty-text">该套件暂无用例</div>') +
          '</div><div class="modal-footer"><button class="btn" id="scClose">关闭</button></div>');
        $('#scClose').onclick = closeModal;
      });
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  async function openSuiteModal(id) {
    let s = null;
    let projects = [];
    let cases = [];
    try {
      const dp = await Api.getProjects();
      projects = dp.projects || [];
      const dc = await Api.getTestCases();
      cases = dc.testCases || [];
      if (id) {
        const ds = await Api.getTestSuites();
        s = (ds.testSuites || []).find(x => x.id === id) || null;
      }
    } catch (e) { toast(e.message, 'error'); return; }
    if (!projects.length) { toast('请先创建项目，再新建套件', 'error'); return; }
    const projCases = cases.filter(c => c.status !== '废弃');
    const selected = s ? (s.case_ids || []).map(Number) : [];

    openModal(
      '<div class="modal-title">' + (id ? '编辑套件' : '新建套件') + '</div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>所属项目 <span class="req">*</span></label><select id="suProj">' + projects.map(p => '<option value="' + p.id + '" ' + (s && s.project_id === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>套件名称 <span class="req">*</span></label><input id="suName" value="' + (s ? esc(s.name) : '') + '" placeholder="如：登录模块回归套件"></div>' +
      '<div class="field"><label>描述</label><textarea id="suDesc">' + (s ? esc(s.desc || '') : '') + '</textarea></div>' +
      '<div class="field"><label>选择用例（多选）</label><div class="member-input-wrap" id="suCases" style="cursor:default;max-height:170px;overflow-y:auto;display:block">' +
      (projCases.length ? projCases.map(c => '<label style="display:flex;align-items:center;gap:6px;padding:5px 4px;cursor:pointer"><input type="checkbox" value="' + c.id + '" ' + (selected.indexOf(c.id) >= 0 ? 'checked' : '') + '> ' + esc(c.title) + '</label>').join('') : '<div class="empty-text" style="padding:12px">暂无可用用例，请先在「测试用例」中创建</div>') +
      '</div></div>' +
      '<div class="form-msg" id="suMsg"></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn" id="suCancel">取消</button><button class="btn btn-primary" id="suSave">保存</button></div>'
    );
    $('#suCancel').onclick = closeModal;
    $('#suSave').onclick = async () => {
      const body = {
        projectId: Number($('#suProj').value),
        name: $('#suName').value.trim(),
        desc: $('#suDesc').value,
        caseIds: $$('#suCases input:checked').map(cb => Number(cb.value))
      };
      if (!body.name) { $('#suMsg').textContent = '请输入套件名称'; return; }
      if (!body.caseIds.length) { $('#suMsg').textContent = '请至少选择一条用例'; return; }
      try {
        if (id) await Api.updateTestSuite(id, body);
        else await Api.addTestSuite(body);
        toast('保存成功', 'success');
        closeModal();
        renderTestSuites();
      } catch (e) { $('#suMsg').textContent = e.message; }
    };
  }

  // ---------- 测试单 ----------
  async function renderTestRuns() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dr = await Api.getTestRuns();
      const runs = dr.testRuns || [];
      let html = '<div class="page-head"><div class="page-title">测试单</div>';
      html += '<button class="btn btn-primary" id="trAdd">＋ 新建测试单</button></div>';
      html += '<div class="card card-pad"><div class="table-wrap"><table class="table"><thead><tr><th>测试单名称</th><th>所属项目</th><th>关联套件</th><th>用例数</th><th>执行人</th><th>状态</th><th>进度</th><th>操作</th></tr></thead><tbody>';
      if (!runs.length) html += '</tbody></table></div><div class="empty"><div class="empty-icon">🧾</div><div class="empty-text">暂无测试单，点击右上角新建</div></div></div>';
      else {
        runs.forEach(r => {
          const statusBadgeHtml = r.status === '已完成' ? '<span class="badge badge-green">已完成</span>' : r.status === '进行中' ? '<span class="badge badge-blue">进行中</span>' : '<span class="badge badge-gray">未开始</span>';
          html += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.projectName) + '</td>' +
            '<td>' + (r.suiteName ? esc(r.suiteName) : '—') + '</td>' +
            '<td>' + r.caseCount + '</td>' +
            '<td>' + (r.executor ? esc(r.executor) : '—') + '</td>' +
            '<td>' + statusBadgeHtml + '</td>' +
            '<td><div style="display:flex;align-items:center;gap:6px"><div class="progress-bar" style="width:90px"><div class="progress-fill" style="width:' + r.progress + '%"></div></div><span style="font-size:12px;color:#6b7280">' + r.progress + '%</span></div></td>' +
            '<td class="row-actions"><button class="btn btn-sm" data-exec="' + r.id + '">执行</button><button class="btn btn-sm" data-edit="' + r.id + '">编辑</button><button class="btn btn-sm btn-danger" data-del="' + r.id + '">删除</button></td></tr>';
        });
        html += '</tbody></table></div></div>';
      }
      ph.innerHTML = html;
      $('#trAdd').onclick = () => openRunModal(null);
      ph.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openRunModal(Number(b.dataset.edit)));
      ph.querySelectorAll('[data-exec]').forEach(b => b.onclick = () => {
        localStorage.setItem('kingdee_run_id', b.dataset.exec);
        location.hash = '#/tests/executions';
      });
      ph.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        if (await confirmBox('确定删除该测试单？相关执行记录将一并删除')) {
          try { await Api.deleteTestRun(Number(b.dataset.del)); toast('已删除', 'success'); renderTestRuns(); } catch (e) { toast(e.message, 'error'); }
        }
      });
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  async function openRunModal(id) {
    let r = null;
    let projects = [];
    let suites = [];
    let cases = [];
    try {
      const dp = await Api.getProjects();
      projects = dp.projects || [];
      const ds = await Api.getTestSuites();
      suites = ds.testSuites || [];
      const dc = await Api.getTestCases();
      cases = dc.testCases || [];
      if (id) {
        const dr = await Api.getTestRuns();
        r = (dr.testRuns || []).find(x => x.id === id) || null;
      }
    } catch (e) { toast(e.message, 'error'); return; }
    if (!projects.length) { toast('请先创建项目，再新建测试单', 'error'); return; }
    const validCases = cases.filter(c => c.status !== '废弃');
    const selected = r ? (r.case_ids || []).map(Number) : [];
    const selSuite = r ? r.suite_id : 0;

    openModal(
      '<div class="modal-title">' + (id ? '编辑测试单' : '新建测试单') + '</div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>所属项目 <span class="req">*</span></label><select id="rnProj">' + projects.map(p => '<option value="' + p.id + '" ' + (r && r.project_id === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>测试单名称 <span class="req">*</span></label><input id="rnName" value="' + (r ? esc(r.name) : '') + '" placeholder="如：第一轮功能测试"></div>' +
      '<div class="field"><label>关联测试套件（选填）</label><select id="rnSuite"><option value="0">不使用套件</option>' + suites.map(s => '<option value="' + s.id + '" ' + (selSuite === s.id ? 'selected' : '') + '>' + esc(s.name) + '（' + s.caseCount + '条）</option>').join('') + '</select></div>' +
      '<div class="field"><label>执行人</label><input id="rnExec" value="' + (r ? esc(r.executor || '') : '') + '" placeholder="多个姓名用、分隔"></div>' +
      '<div class="field"><label>选择用例（多选，可覆盖套件）</label><div class="member-input-wrap" id="rnCasesBox" style="cursor:default;max-height:170px;overflow-y:auto;display:block">' +
      (validCases.length ? validCases.map(c => '<label style="display:flex;align-items:center;gap:6px;padding:5px 4px;cursor:pointer"><input type="checkbox" class="rnCase" value="' + c.id + '" ' + (selected.indexOf(c.id) >= 0 ? 'checked' : '') + '> ' + esc(c.title) + '</label>').join('') : '<div class="empty-text" style="padding:12px">暂无可用用例，请先在「测试用例」中创建</div>') +
      '</div></div>' +
      '<div class="field"><label>状态</label><select id="rnStatus"><option>未开始</option><option>进行中</option><option>已完成</option></select></div>' +
      '<div class="field"><label>描述</label><textarea id="rnDesc">' + (r ? esc(r.desc || '') : '') + '</textarea></div>' +
      '<div class="form-msg" id="rnMsg"></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn" id="rnCancel">取消</button><button class="btn btn-primary" id="rnSave">保存</button></div>'
    );
    if (r) $('#rnStatus').value = r.status;
    $('#rnCancel').onclick = closeModal;
    $('#rnSuite').onchange = () => {
      const sid = Number($('#rnSuite').value);
      if (!sid) return;
      const s = suites.find(x => x.id === sid);
      if (!s) return;
      $$('.rnCase').forEach(cb => { cb.checked = (s.case_ids || []).indexOf(Number(cb.value)) >= 0; });
    };
    $('#rnSave').onclick = async () => {
      const body = {
        projectId: Number($('#rnProj').value),
        name: $('#rnName').value.trim(),
        desc: $('#rnDesc').value,
        suiteId: Number($('#rnSuite').value),
        executor: $('#rnExec').value.trim(),
        status: $('#rnStatus').value,
        caseIds: $$('.rnCase:checked').map(cb => Number(cb.value))
      };
      if (!body.name) { $('#rnMsg').textContent = '请输入测试单名称'; return; }
      if (!body.caseIds.length) { $('#rnMsg').textContent = '请选择测试套件或至少一条用例'; return; }
      try {
        if (id) await Api.updateTestRun(id, body);
        else await Api.addTestRun(body);
        toast('保存成功', 'success');
        closeModal();
        renderTestRuns();
      } catch (e) { $('#rnMsg').textContent = e.message; }
    };
  }

  // ---------- 测试执行 ----------
  async function renderTestExecutions() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dr = await Api.getTestRuns();
      const runs = dr.testRuns || [];
      const savedRun = Number(localStorage.getItem('kingdee_run_id')) || 0;
      const runId = runs.some(x => x.id === savedRun) ? savedRun : (runs.length ? runs[0].id : 0);

      let html = '<div class="page-head"><div class="page-title">测试执行</div></div>';
      if (!runs.length) {
        html += '<div class="card card-pad"><div class="empty"><div class="empty-icon">▶️</div><div class="empty-text">暂无测试单，请先到「测试单」创建</div></div></div>';
        ph.innerHTML = html;
        return;
      }
      html += '<div class="toolbar"><select id="exRun">' + runs.map(r => '<option value="' + r.id + '" ' + (r.id === runId ? 'selected' : '') + '>' + esc(r.name) + '（' + esc(r.projectName) + '）</option>').join('') + '</select>' +
        '<button class="btn" id="exRefresh">刷新</button></div>';
      html += '<div id="exBody"></div>';
      ph.innerHTML = html;

      const loadExec = async (rid) => {
        const body = $('#exBody');
        body.innerHTML = '<div class="empty">加载中…</div>';
        try {
          const run = runs.find(x => x.id === rid);
          const de = await Api.getExecutions(rid);
          const exes = de.executions || [];
          const done = exes.filter(e => e.result !== '未执行').length;
          const progress = exes.length ? Math.round(done / exes.length * 100) : 0;

          let h = '<div class="card card-pad" style="margin-bottom:14px"><div class="chart-title">' + esc(run.name) + '（' + esc(run.projectName) + '）</div>' +
            '<div style="font-size:13px;color:#6b7280;margin-bottom:10px">用例 ' + exes.length + ' 条 · 已完成 ' + done + ' 条 · 进度 ' + progress + '% · 状态 ' + esc(run.status) + (run.executor ? ' · 执行人 ' + esc(run.executor) : '') + '</div>' +
            '<div class="progress-bar" style="width:260px"><div class="progress-fill" style="width:' + progress + '%"></div></div></div>';

          h += '<div class="card card-pad"><div class="chart-title">用例执行</div><div class="table-wrap"><table class="table"><thead><tr><th>用例名称</th><th>执行结果</th><th>备注</th><th></th></tr></thead><tbody>';
          if (!exes.length) h += '<tr><td colspan="4"><div class="empty-text">该测试单暂无用例</div></td></tr>';
          exes.forEach(e => {
            const resBadge = e.result === '通过' ? '<span class="badge badge-green">通过</span>' : e.result === '失败' ? '<span class="badge badge-red">失败</span>' : e.result === '阻塞' ? '<span class="badge badge-orange">阻塞</span>' : '<span class="badge badge-gray">未执行</span>';
            h += '<tr><td style="max-width:280px">' + esc(e.case_title) + '</td>' +
              '<td>' + resBadge + ' <div style="margin-top:6px;display:flex;gap:4px">' +
              ['通过', '失败', '阻塞'].map(r2 => '<button class="btn btn-sm ' + (e.result === r2 ? 'btn-primary' : '') + '" data-res="' + e.id + '" data-val="' + r2 + '">' + r2 + '</button>').join('') +
              '</div></td>' +
              '<td><input type="text" class="exNote" data-note="' + e.id + '" value="' + esc(e.note || '') + '" placeholder="备注（可选）" style="width:180px;padding:6px 10px;border:1px solid #e9ecef;border-radius:6px"></td>' +
              '<td><button class="btn btn-sm" data-save="' + e.id + '">保存备注</button></td></tr>';
          });
          h += '</tbody></table></div></div>';
          body.innerHTML = h;

          body.querySelectorAll('[data-res]').forEach(btn => btn.onclick = async () => {
            const id = Number(btn.dataset.res);
            const val = btn.dataset.val;
            try { await Api.setExecution(id, { result: val }); toast('已标记：' + val, 'success'); loadExec(rid); } catch (e) { toast(e.message, 'error'); }
          });
          body.querySelectorAll('[data-save]').forEach(btn => btn.onclick = async () => {
            const id = Number(btn.dataset.save);
            const note = body.querySelector('[data-note="' + id + '"]').value;
            try { await Api.setExecution(id, { note: note }); toast('备注已保存', 'success'); } catch (e) { toast(e.message, 'error'); }
          });
        } catch (e) {
          body.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
        }
      };
      $('#exRun').onchange = () => { localStorage.setItem('kingdee_run_id', $('#exRun').value); loadExec(Number($('#exRun').value)); };
      $('#exRefresh').onclick = () => loadExec(Number($('#exRun').value));
      loadExec(runId);
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  // ---------- 测试报告 ----------
  async function renderTestReports() {
    const ph = $('#pageContent');
    ph.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const dr = await Api.getTestRuns();
      const runs = dr.testRuns || [];
      const drp = await Api.getReports();
      const reports = drp.reports || [];

      let html = '<div class="page-head"><div class="page-title">测试报告</div>';
      html += '<button class="btn btn-primary" id="rpAdd">＋ 生成报告</button></div>';
      html += '<div class="card card-pad"><div class="table-wrap"><table class="table"><thead><tr><th>报告名称</th><th>关联测试单</th><th>所属项目</th><th>用例数</th><th>通过</th><th>失败</th><th>阻塞</th><th>通过率</th><th>创建日期</th><th>操作</th></tr></thead><tbody>';
      if (!reports.length) html += '</tbody></table></div><div class="empty"><div class="empty-icon">📊</div><div class="empty-text">暂无测试报告，点击右上角生成</div></div></div>';
      else {
        reports.forEach(r => {
          const rateColor = r.pass_rate >= 90 ? '#0ca678' : r.pass_rate >= 60 ? '#f08c00' : '#e03131';
          html += '<tr><td><button class="link-btn" data-detail="' + r.id + '">' + esc(r.name) + '</button></td>' +
            '<td>' + esc(r.runName) + '</td><td>' + esc(r.projectName) + '</td>' +
            '<td>' + r.total + '</td><td style="color:#0ca678;font-weight:600">' + r.passed + '</td>' +
            '<td style="color:#e03131;font-weight:600">' + r.failed + '</td><td style="color:#f08c00;font-weight:600">' + r.blocked + '</td>' +
            '<td><span style="color:' + rateColor + ';font-weight:700">' + r.pass_rate + '%</span></td>' +
            '<td>' + esc(r.created_date) + '</td>' +
            '<td class="row-actions"><button class="btn btn-sm btn-danger" data-del="' + r.id + '">删除</button></td></tr>';
        });
        html += '</tbody></table></div></div>';
      }
      ph.innerHTML = html;

      $('#rpAdd').onclick = () => {
        if (!runs.length) { toast('请先创建测试单', 'error'); return; }
        openModal(
          '<div class="modal-title">生成测试报告</div>' +
          '<div class="modal-body">' +
          '<div class="field"><label>选择测试单 <span class="req">*</span></label><select id="rpRun">' + runs.map(r => '<option value="' + r.id + '">' + esc(r.name) + '（' + esc(r.projectName) + '）</option>').join('') + '</select></div>' +
          '<div class="field"><label>报告名称</label><input id="rpName" placeholder="留空自动生成"></div>' +
          '<div class="form-msg" id="rpMsg"></div>' +
          '</div>' +
          '<div class="modal-footer"><button class="btn" id="rpCancel">取消</button><button class="btn btn-primary" id="rpSave">生成</button></div>'
        );
        $('#rpCancel').onclick = closeModal;
        $('#rpSave').onclick = async () => {
          try {
            await Api.addReport(Number($('#rpRun').value), $('#rpName').value.trim());
            toast('报告已生成', 'success');
            closeModal();
            renderTestReports();
          } catch (e) { $('#rpMsg').textContent = e.message; }
        };
      };
      ph.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        if (await confirmBox('确定删除该报告？')) {
          try { await Api.deleteReport(Number(b.dataset.del)); toast('已删除', 'success'); renderTestReports(); } catch (e) { toast(e.message, 'error'); }
        }
      });
      ph.querySelectorAll('[data-detail]').forEach(b => b.onclick = () => {
        const r = reports.find(x => x.id === Number(b.dataset.detail));
        if (!r) return;
        openModal('<div class="modal-title">报告详情</div><div class="modal-body">' +
          '<div class="field"><label>报告名称</label><div>' + esc(r.name) + '</div></div>' +
          '<div class="field"><label>关联测试单</label><div>' + esc(r.runName) + '</div></div>' +
          '<div class="field"><label>所属项目</label><div>' + esc(r.projectName) + '</div></div>' +
          '<div class="field"><label>统计</label><div>总用例 ' + r.total + ' · 通过 <span style="color:#0ca678">' + r.passed + '</span> · 失败 <span style="color:#e03131">' + r.failed + '</span> · 阻塞 <span style="color:#f08c00">' + r.blocked + '</span> · 通过率 <b style="color:' + (r.pass_rate >= 90 ? '#0ca678' : r.pass_rate >= 60 ? '#f08c00' : '#e03131') + '">' + r.pass_rate + '%</b></div></div>' +
          '<div class="field"><label>摘要</label><div>' + esc(r.summary) + '</div></div>' +
          '</div><div class="modal-footer"><button class="btn" id="rpClose">关闭</button></div>');
        $('#rpClose').onclick = closeModal;
      });
    } catch (e) {
      ph.innerHTML = '<div class="card card-pad"><div class="empty"><div class="empty-text">加载失败：' + esc(e.message) + '</div></div></div>';
    }
  }

  // ---------- 铃铛提醒：分配给我的问题 ----------
  async function updateBell() {
    const user = Api.getUser();
    if (!user) return;
    const badge = $('#bellBadge');
    try {
      // 仅“开发顾问”角色接收提醒，其他职位不接收
      let isDevConsultant = false;
      try {
        const dm = await Api.getMembers();
        const me = (dm.members || []).find(m => m.name === user.name);
        isDevConsultant = !!(me && me.role === '开发顾问');
      } catch (e) { /* 忽略 */ }
      if (!isDevConsultant) {
        myIssuesCache = [];
        if (badge) badge.classList.add('hidden');
        return;
      }
      const di = await Api.getIssues();
      const name = user.name;
      myIssuesCache = (di.issues || []).filter(i =>
        i.status !== '已完成' && (i.developers || []).indexOf(name) >= 0
      );
      const n = myIssuesCache.length;
      if (n > 0) { badge.textContent = n > 99 ? '99+' : n; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    } catch (e) { /* 静默失败，不打扰使用 */ }
  }

  function showMyIssues() {
    const user = Api.getUser();
    if (!myIssuesCache.length) { toast('暂无分配给您的待办问题', 'success'); return; }
    openModal(
      '<div class="modal-title">🔔 我的待办问题（' + myIssuesCache.length + '）</div>' +
      '<div class="modal-body" style="max-height:60vh;overflow-y:auto">' +
      myIssuesCache.map(i =>
        '<div class="bell-item">' +
        '<div class="bi-main">' +
        '<div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(i.description) + '</div>' +
        '<div style="font-size:12px;color:#6b7280;margin-top:3px">' + esc(i.projectName) + ' · ' + statusBadge(i.status) +
        ' · 我是开发人员</div>' +
        '</div>' +
        '<button class="btn btn-sm" data-go="' + i.id + '">处理</button>' +
        '</div>'
      ).join('') +
      '</div>' +
      '<div class="modal-footer"><button class="btn" id="bellClose">关闭</button></div>'
    );
    $('#bellClose').onclick = closeModal;
    $('#modalBox').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { closeModal(); location.hash = '#/issues'; });
  }

  // ---------- 启动 ----------
  function boot() {
    initLogin();
    if (Api.getUser() && Api.getToken()) {
      // 校验登录态
      Api.me().then(() => enterApp()).catch(() => { Api.clearSession(); showLogin(); });
    } else {
      showLogin();
    }
  }

  boot();
})();
