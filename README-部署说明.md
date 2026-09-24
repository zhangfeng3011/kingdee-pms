# 金蝶项目管理系统 - 服务器部署说明

本系统为 Node.js 全栈应用（无数据库依赖，数据保存在 data/db.json），部署非常简单。

## 一、服务器要求

- 操作系统：Windows Server / Linux（CentOS / Ubuntu）均可
- 需要安装 Node.js 18 及以上版本（推荐 LTS，如 20 或 22）
- 1 核 1G 内存即可流畅运行

## 二、安装 Node.js（如果没有）

**Windows Server：**
到 https://nodejs.org 下载 LTS 版 .msi 安装包，一路下一步即可。
安装完成后在命令行验证：`node -v` 应显示 v20.x 或 v22.x

**Linux（Ubuntu/CentOS）：**
```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs

# CentOS / RHEL
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && yum install -y nodejs
```

## 三、上传并解压

把 `kingdee-pms-deploy.zip` 上传到服务器任意目录（如 /opt/kingdee-pms 或 C:\kingdee-pms），解压。

## 四、安装依赖

在解压后的目录里执行：

```bash
# 国内服务器（推荐用国内镜像，速度快）
npm install --registry=https://registry.npmmirror.com

# 海外服务器
npm install
```

> 依赖全部为纯 JS 包（express / bcryptjs / jsonwebtoken），无需编译，安装很快。

## 五、启动服务

```bash
node server.js
```

- 默认监听 **3000 端口**，访问地址：`http://服务器IP:3000`
- 如服务器 80 端口空闲且已备案，可指定 80 端口：
  ```bash
  # Linux
  PORT=80 node server.js
  # Windows PowerShell
  $env:PORT=80; node server.js
  ```

**生产环境建议用 PM2 守护进程（Linux）：**
```bash
npm install -g pm2
pm2 start server.js --name kingdee-pms
pm2 save
pm2 startup   # 开机自启
```

## 六、域名配置（可选）

如有域名且已备案，用 Nginx 反向代理：

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 七、数据说明

- 所有数据保存在 `data/db.json`，**备份/迁移只需拷贝这一个文件**
- 内置管理员账号：**admin / admin123**（首次登录后建议改密码——目前版本暂未提供改密功能，可在 db.json 中手动修改或注册新管理员）
- 成员、项目、问题、附件（base64 存储）全部在该文件中

## 八、验证

启动后访问 `http://服务器IP:3000`，应看到登录页：
1. 用 admin / admin123 登录
2. 在"成员管理"里添加成员（如 张枫）
3. 在"项目管理"里新建项目
4. 换一台电脑访问同一地址，能看到相同数据 → 多人共享成功

## 常见问题

| 问题 | 解决 |
|---|---|
| 外网访问不了 3000 端口 | 云服务器安全组/防火墙放行 3000 端口（或改用 80 端口） |
| npm install 很慢 | 加 `--registry=https://registry.npmmirror.com` |
| 页面能开但接口报错 | 确认服务在运行、端口未被占用 |
