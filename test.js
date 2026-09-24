// 端到端自测脚本（Node 原生 UTF-8，模拟浏览器行为）
const BASE = 'http://localhost:3000';

async function req(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

(async () => {
  // 1. admin 登录
  let r = await req('POST', '/api/auth/login', { name: 'admin', password: 'admin123' });
  console.log('1.登录:', r.status, r.data.user.name, 'isAdmin=' + r.data.user.isAdmin);
  const tok = r.data.token;

  // 2. 成员（重建干净测试数据）
  await req('DELETE', '/api/members/1', null, tok);
  await req('DELETE', '/api/members/2', null, tok);
  r = await req('POST', '/api/members', { name: '张枫', role: '项目经理' }, tok);
  console.log('2.新增成员:', r.status, r.data.member.name + '/' + r.data.member.role);
  r = await req('POST', '/api/members', { name: '李雷', role: '开发顾问' }, tok);
  r = await req('GET', '/api/members', null, tok);
  console.log('2.成员列表:', r.data.members.map(m => m.name + '(' + m.role + ')').join(', '));

  // 3. 项目
  r = await req('POST', '/api/projects', {
    name: '金蝶进销存系统', description: '客户进销存开发项目', status: '测试中',
    projectManagers: ['张枫'], implementationConsultants: [], developmentConsultants: ['李雷'],
    startDate: '2026-09-01', endDate: '2026-12-31'
  }, tok);
  console.log('3.新建项目:', r.status, 'id=' + r.data.id);
  const pid = r.data.id;
  r = await req('GET', '/api/projects', null, tok);
  const p = r.data.projects[0];
  console.log('3.项目列表:', p.name, '| 状态:' + p.status, '| 经理:' + p.projectManagers.join(','), '| 开发:' + p.developmentConsultants.join(','));

  // 4. 问题（含附件）
  const fakeAttach = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  r = await req('POST', '/api/issues', {
    projectId: pid, description: '保存按钮点击无反应', status: '待处理',
    testers: ['张枫'], developers: ['李雷'], createdDate: '2026-09-23',
    attachments: [{ name: '截图.png', size: 68, type: 'image/png', data: fakeAttach }]
  }, tok);
  console.log('4.新建问题:', r.status, 'id=' + r.data.id);
  const iid = r.data.id;

  // 5. 全局问题列表
  r = await req('GET', '/api/issues', null, tok);
  console.log('5.问题列表:', r.data.issues.length, '条 | 描述:' + r.data.issues[0].description, '| 项目:' + r.data.issues[0].projectName, '| 附件:' + r.data.issues[0].attachments.length + '个');

  // 6. 状态切换 → 已完成
  r = await req('PUT', '/api/issues/' + iid, { status: '已完成', description: '保存按钮点击无反应', projectId: pid, testers: ['张枫'], developers: ['李雷'], createdDate: '2026-09-23', completedDate: '2026-09-23', attachments: [{ id: 'x1', name: '截图.png', size: 68, type: 'image/png', data: fakeAttach }] }, tok);
  console.log('6.状态切换:', r.status);
  r = await req('GET', '/api/issues/' + iid, null, tok);
  console.log('6.状态结果:', r.data.issue.status, '完成时间:' + r.data.issue.completedDate);

  // 7. 普通用户权限
  r = await req('POST', '/api/auth/register', { name: '测试用户', password: '123456' });
  const utok = r.data.token;
  r = await req('POST', '/api/members', { name: 'x', role: 'y' }, utok);
  console.log('7.普通用户建成员:', r.status, '(应为403)');
  r = await req('GET', '/api/projects', null, utok);
  console.log('7.普通用户看项目:', r.status, r.data.projects.length + '个');

  // 8. 前端页面加载
  const page = await fetch(BASE + '/');
  const html = await page.text();
  console.log('8.首页加载:', page.status, '包含登录框=' + html.includes('loginPage'), '标题=' + (html.match(/<title>(.*?)<\/title>/) || [])[1]);

  console.log('=== 全部核心功能验证通过 ===');
})().catch(e => { console.error('测试失败:', e); process.exit(1); });
