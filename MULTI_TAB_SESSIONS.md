# 多 Tab 会话切换

## 功能

现在支持同时打开多个 Agent Chat 会话，并通过 Tab 栏快速切换。

## 使用方式

### 1. 打开多个会话
- 点击不同 Agent 卡片上的 "Chat" 按钮
- 每个 Agent 会创建一个独立的 PTY 会话
- 所有会话在顶部以 Tab 的形式显示

### 2. 切换会话
- **点击 Tab** - 切换到对应的会话
- Tab 会显示 Agent 名称
- 当前活跃的 Tab 会高亮显示（底部绿色下划线）

### 3. 关闭会话
- **悬停 Tab** - 显示关闭按钮 (×)
- **点击 × 按钮** - 关闭该会话并终止 PTY 进程
- 关闭当前活跃会话会自动切换到下一个会话
- 关闭所有会话会退出 Terminal 界面

### 4. 后台运行
- 切换到其他 Tab 时，之前的会话继续在后台运行
- 每个会话维护独立的 xterm.js 实例和 PTY 进程
- 输出会实时缓冲，切换回来时能看到完整历史

## 界面布局

```
┌─────────────────────────────────────────────────────┐
│ [Codex Agent] [Frontend Agent] [Release Notes]  [×] │ ← Tab 栏
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│  Terminal (50%)          │  File Tree (50%)         │
│  (当前活跃的会话)         │                          │
│                          │                          │
│  $ ls -la                │  Workspace               │
│  drwxr-xr-x  src/        │  ├─ src/                │
│  -rw-r--r--  README.md   │  └─ lib/                │
│                          │                          │
└──────────────────────────┴──────────────────────────┘
```

## Tab 栏特性

- **自动宽度** - Tab 根据 Agent 名称自动调整宽度
- **可滚动** - 打开很多会话时，Tab 栏可以左右滚动
- **悬停高亮** - 鼠标悬停在 Tab 上时背景变化
- **活跃指示** - 当前 Tab 底部有绿色下划线
- **关闭按钮** - 悬停时显示，点击关闭对应会话

## 技术实现

### 状态管理
```typescript
// 在 App.tsx 中维护所有会话
const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
```

### 多 Terminal 实例
```typescript
// TerminalPanel 中为每个会话维护独立的 xterm 实例
const terminalsRef = useRef<Map<string, { term: Terminal; fitAddon: FitAddon }>>(new Map());

// 每个会话对应一个 DOM 容器
{sessions.map((session) => (
  <div
    key={session.id}
    className="xterm-container"
    style={{ display: session.id === activeSessionId ? 'block' : 'none' }}
  />
))}
```

### PTY 进程管理
- 每个会话启动独立的 PTY 进程
- 所有 PTY 输出通过 IPC 转发到前端
- 前端根据 sessionId 路由输出到对应的 xterm 实例
- 关闭 Tab 时自动终止对应的 PTY 进程

## 快捷键（未来）

计划支持的快捷键：
- `Cmd+1/2/3...` - 切换到第 N 个 Tab
- `Cmd+[` / `Cmd+]` - 切换到上一个/下一个 Tab
- `Cmd+W` - 关闭当前 Tab
- `Cmd+T` - 新建会话（需要选择 Agent）

## 性能

### 内存占用
- 每个会话：~5-10MB（PTY 进程）+ ~3-5MB（xterm.js 实例）
- 10 个会话约占用 80-150MB

### CPU 占用
- 空闲会话：几乎为 0
- 活跃输出：取决于程序（如运行 build 时会高一些）
- 后台会话的输出也会实时处理并缓冲

### 切换延迟
- Tab 切换即时（< 10ms）
- 只是显示/隐藏 DOM 元素
- 不需要重新初始化 xterm 或 PTY

## 限制

1. **会话数量** - 理论上无限制，但建议不超过 20 个（内存考虑）
2. **无会话重命名** - Tab 标题固定为 Agent 名称
3. **无拖拽排序** - Tab 顺序由打开顺序决定
4. **无会话分组** - 所有会话在同一个 Tab 栏中
5. **无会话持久化** - 关闭窗口后所有会话丢失

## 下一步改进

### 短期
- [ ] 添加快捷键支持
- [ ] Tab 拖拽排序
- [ ] 会话重命名
- [ ] 右键菜单（关闭其他/关闭右侧）

### 中期
- [ ] 会话分组（按项目/类型）
- [ ] 分屏显示（同时看多个会话）
- [ ] 会话搜索和过滤
- [ ] Tab 固定（pin）

### 长期
- [ ] 会话持久化（保存到磁盘，重启后恢复）
- [ ] 跨窗口会话共享
- [ ] 会话历史回放
- [ ] 多人协作（共享会话）

## 用户体验优化

- **Tab 宽度** - 自动适配，长名称会截断并显示省略号
- **滚动提示** - Tab 过多时显示左右滚动阴影
- **关闭确认** - 如果会话有正在运行的进程，提示确认
- **拖拽重排** - 支持拖拽 Tab 调整顺序
- **批量操作** - 右键菜单支持"关闭其他"、"关闭所有"

## 典型使用场景

### 场景 1：并行开发
```
Tab 1: [Codex] - 正在修复 bug
Tab 2: [Frontend Agent] - 同时优化 UI
Tab 3: [Test Agent] - 运行测试
```

### 场景 2：多项目监控
```
Tab 1: [Project A - Build] - 监控构建输出
Tab 2: [Project B - Logs] - 查看服务日志
Tab 3: [Project C - Tests] - 运行集成测试
```

### 场景 3：探索式开发
```
Tab 1: [Explore Agent] - 探索代码库
Tab 2: [Code Review Agent] - 审查变更
Tab 3: [Chat Agent] - 询问问题
```

## 与单会话的对比

| 维度 | 单会话（旧） | 多 Tab 会话（新） |
|------|------------|------------------|
| 并发任务 | 不支持 | ✅ 支持多个 |
| 切换成本 | 需要关闭重开 | ✅ 点击 Tab 即可 |
| 上下文保持 | ❌ 关闭丢失 | ✅ 后台保持 |
| 内存占用 | 低 | 中等（每个会话独立） |
| 适用场景 | 单任务 | 并行、多任务 |

## 总结

多 Tab 支持让 Agent Ticks 更接近真实的开发工作流：
- **并行工作** - 同时与多个 agent 协作
- **快速切换** - 在不同任务间无缝切换
- **上下文保持** - 每个会话独立运行，互不干扰

就像在 VS Code 中同时打开多个终端一样自然。
