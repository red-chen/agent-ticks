# Agent Ticks

Agent Ticks 是一个本地优先的调度器，用于管理和调度 Claude Code、Codex 等 AI 编程助手的任务执行。

## 项目概览

这是一个 Electron + React 应用，提供图形界面和命令行工具，用于配置 AI agent、创建定时任务并查看执行记录。

**核心能力：**
- 管理多个 agent 配置（系统提示词、技能、权限、MCP 服务器）
- 为每个 agent 创建定时或手动触发的任务
- 支持 cron 表达式和预设调度（@daily、@hourly、@weekly）
- 任务并发控制（skip 或 parallel）
- 实时查看任务执行输出和历史记录

## 架构

### 技术栈
- **前端**: React 19 + TypeScript + Vite
- **桌面端**: Electron 42
- **CLI**: Node.js (CommonJS)
- **图标**: Lucide React
- **样式**: 自定义 CSS（支持亮色/暗色/跟随系统主题）
- **国际化**: 内置中英文支持

### 目录结构

```
/Users/red/workspace/agent-ticks
├── src/              # React 前端代码
│   ├── App.tsx       # 主应用组件（agent/task/run 管理界面）
│   ├── types.ts      # TypeScript 类型定义
│   ├── components/   # 主题和语言 Provider
│   └── lib/          # 国际化和主题工具
├── electron/         # Electron 主进程和预加载脚本
│   ├── main.cjs      # Electron 主进程（窗口管理、IPC）
│   └── preload.cjs   # 安全的 API 暴露层
├── lib/              # 核心业务逻辑（Node.js）
│   ├── store.cjs     # 数据持久化（agents.json、tasks.json、runs/）
│   ├── runner.cjs    # 任务执行引擎（spawn 子进程）
│   └── cron.cjs      # Cron 调度器
├── cli/              # 命令行工具
│   └── agent-ticks.cjs
└── index.html        # Vite 入口
```

### 数据存储

所有应用数据默认存储在 `~/.agent-ticks/`：

```
~/.agent-ticks/
├── agents.json       # Agent 配置列表
├── tasks.json        # 任务配置列表
├── runs/             # 任务执行记录（每个 run 一个 JSON 文件）
└── logs/             # 预留的日志目录
```

可通过 `AGENT_TICKS_HOME` 环境变量覆盖默认路径。

## 核心概念

### Agent (src/types.ts)
代表一个 AI 编程助手的配置：
- **kind**: 类型标识（codex, claude, custom）
- **name**: 显示名称
- **description**: 功能描述
- **systemPrompt**: 系统提示词
- **skills**: 启用的技能列表（如 magic-explore, magic-code-review）
- **mcps**: MCP 服务器列表（如 git, node_repl）
- **permissions**: 权限列表（如 workspace-write, read-only）
- **command**: 执行命令模板（可使用环境变量，如 `codex exec "$AGENT_TICKS_PROMPT"`）
- **workingDirectory**: 工作目录

### AgentTask (src/types.ts)
代表一个可调度的任务：
- **agentId**: 关联的 agent ID
- **name**: 任务名称
- **prompt**: 任务提示词（会传递给 agent）
- **schedule**: 调度表达式
  - `manual`: 仅手动触发
  - `@hourly`, `@daily`, `@weekly`: 预设间隔
  - 五字段 cron 表达式（如 `0 10 * * 5` 表示每周五 10:00）
- **enabled**: 是否启用自动调度
- **concurrency**: 并发控制
  - `skip`: 如果上次运行未结束则跳过
  - `parallel`: 允许多个实例同时运行

### AgentRun (src/types.ts)
记录一次任务执行：
- **status**: running | completed | failed | cancelled
- **output**: 捕获的 stdout + stderr
- **exitCode**: 进程退出码
- **error**: 错误信息（如果有）
- **startedAt**, **endedAt**: 时间戳

## 关键实现

### 任务执行 (lib/runner.cjs)

任务执行时会：
1. 根据 agent.command 构建 shell 命令
2. 注入环境变量：
   - `AGENT_TICKS_PROMPT`: 任务提示词
   - `AGENT_TICKS_SYSTEM_PROMPT`: agent 系统提示词
   - `AGENT_TICKS_SKILLS`: JSON 数组
   - `AGENT_TICKS_MCPS`: JSON 数组
   - `AGENT_TICKS_PERMISSIONS`: JSON 数组
   - `AGENT_TICKS_AGENT_ID`, `AGENT_TICKS_TASK_ID` 等元数据
3. 在 agent.workingDirectory 中启动子进程
4. 实时捕获输出并保存到 `runs/<runId>.json`

**并发控制**: 如果 task.concurrency === 'skip' 且已有运行中的实例，则返回 null 不执行。

### Cron 调度 (lib/cron.cjs)

调度器会：
- 解析 schedule 字段（支持 cron 表达式和 @presets）
- 定期检查哪些任务应该触发
- 调用 runner.runTask() 执行任务
- 更新 task.lastRunAt 时间戳

### Electron IPC (electron/main.cjs + preload.cjs)

主进程暴露的 API（通过 `window.agentTicks`）：
- `getHome()`: 获取数据目录路径
- `getState()`: 获取完整状态（agents, tasks, runs, running）
- `saveAgent(agent)`: 保存或更新 agent
- `deleteAgent(agentId)`: 删除 agent 及其所有任务
- `saveTask(task)`: 保存或更新任务
- `deleteTask(taskId)`: 删除任务
- `runTask(taskId)`: 手动触发任务
- `stopRun(runId)`: 停止运行中的任务
- `onStateChange(callback)`: 订阅状态变化

## 开发工作流

### 启动开发环境

```bash
npm install
npm run electron:dev
```

这会：
1. 启动 Vite 开发服务器（http://127.0.0.1:5173）
2. 等待 Vite 就绪后启动 Electron
3. 支持热重载

### 构建生产版本

```bash
npm run build          # 构建 React 前端到 dist/
npm run electron:preview  # 预览生产版本（不启动 Vite）
```

### 使用 CLI

```bash
npm run cli -- home                        # 显示数据目录
npm run cli -- agents                      # 列出所有 agents
npm run cli -- agent:add <name> <command>  # 添加 agent
npm run cli -- tasks                       # 列出所有任务
npm run cli -- task:add <agentId> <name> <schedule> <prompt>
npm run cli -- task:run <taskId>          # 手动运行任务
npm run cli -- runs                        # 查看执行历史
```

## 样式和主题

- CSS 变量定义在 `src/lib/theme.ts`
- 支持三种主题：light, dark, system
- 颜色方案基于 HSL，使用语义化变量名（`--bg`, `--fg`, `--primary` 等）
- 主题切换通过 `ThemeProvider` 实现，持久化到 localStorage

## 国际化

- 当前支持中文（zh）和英文（en）
- 翻译定义在 `src/lib/i18n.ts`
- 通过 `LanguageProvider` 提供 `t()` 函数
- 语言偏好持久化到 localStorage

## 测试

```bash
npm test  # 运行 Vitest 测试
```

当前项目尚未配置测试用例，需要后续补充。

## 打包和分发

配置在 package.json 的 `build` 字段：
- **appId**: com.agentticks.app
- **target**: macOS ARM64（可扩展到其他平台）
- **输出**: release/ 目录

建议使用 electron-builder 打包：
```bash
npm install -g electron-builder
electron-builder
```

## 已知限制和未来改进

1. **错误处理**: 当前错误展示较简单，需要更友好的错误提示
2. **日志系统**: logs/ 目录已预留但未实现日志轮转
3. **任务历史清理**: runs/ 目录会无限增长，需要清理策略
4. **权限验证**: permissions 字段当前仅用于传递，未实际执行权限检查
5. **多语言扩展**: 可添加更多语言支持
6. **测试覆盖**: 需要为核心逻辑添加单元测试和集成测试
7. **任务依赖**: 当前不支持任务间的依赖关系
8. **通知系统**: 任务失败或完成时可发送系统通知

## 贡献指南

当添加新功能时：
1. **类型定义**: 先在 src/types.ts 更新接口
2. **后端逻辑**: 在 lib/ 中实现核心逻辑
3. **IPC 层**: 在 electron/main.cjs 暴露 API
4. **前端集成**: 在 src/App.tsx 调用 API 并更新 UI
5. **国际化**: 在 src/lib/i18n.ts 添加翻译 key

保持前后端分离，lib/ 中的代码应独立于 Electron 可运行。
