# 多设备同步配置（Cloudflare Pages + D1）

本项目的前端页面部署在 Cloudflare Pages，动态状态通过同域 `/api/state` Pages Function 写入 D1。

## Cloudflare 一次性配置

1. 在 Cloudflare 控制台创建一个 D1 数据库，例如：`wuhan-midautumn-2026-db`。
2. 打开 Pages 项目 `wuhan-midautumn-2026` → Settings → Bindings → D1 database bindings。
3. 添加绑定，变量名必须填写：`DB`，数据库选择刚创建的 D1。
4. 保存后重新部署一次最新生产版本（或在 GitHub 提交任意改动触发自动部署）。
5. 打开 `https://wuhan-midautumn-2026.pages.dev`。首次会提示设置 4—12 位数字同步 PIN。
6. 第一台设备设置 PIN 时，本机已有的行程勾选、自定义准备事项会自动写入云端。其他设备输入相同 PIN 即可同步。

数据库表会由 Pages Function 首次请求时自动创建，不需要手工执行 SQL。
