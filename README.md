# 武汉中秋旅行手册 2026

这是用于 **GitHub → Cloudflare Workers Builds → 自动部署** 的仓库结构。

## 目录

```text
.
├─ public/
│  ├─ index.html
│  ├─ sw.js
│  └─ manifest.webmanifest
├─ wrangler.jsonc
├─ package.json
└─ .gitignore
```

## Cloudflare 推荐部署方式

Cloudflare Dashboard → Workers & Pages → Create application → Import a repository

选择本 GitHub 仓库后：

- Production branch: `main`
- Build command: 留空（本项目无需构建）
- Deploy command: `npx wrangler deploy`

以后只要向 `main` 分支 push，Cloudflare Workers Builds 会自动部署。

## 本地预览

```bash
npm install
npm run dev
```

## 注意

这是纯静态站点，使用 Workers Static Assets。
静态资源请求不需要执行 Worker 脚本。
