# Sentinel Web

一个基于 Vite + React + TypeScript + Tailwind 的查询型前端页面，内置两个 TAB：
- Machine State
- RMS Report

## 开发

```bash
npm install
npm run dev
```

## 环境变量

在项目根目录创建 `.env`：

```bash
VITE_API_BASE=http://localhost:3000
VITE_MACHINE_STATE_PATH=/machine-state
VITE_RMS_REPORT_PATH=/rms-report
```

## 查询参数

- `sn` 可为空
- `page_size` 默认 20
- `curr_page` 默认 1
