# Chat Session Management

完整的 chat session 管理系统已集成到 Agent Ticks 中。

## 功能特性

### 核心能力
- **会话持久化** - 所有对话存储在 `~/.agent-ticks/sessions/`
- **流式输出** - 实时显示 agent 响应
- **多轮对话** - 维护完整的对话历史上下文
- **并发管理** - 支持同时与多个 agent 对话

### 与 Task 的区别
- **Task**: 一次性任务执行，无状态，适合定时任务和后台作业
- **Chat**: 交互式对话，有状态，适合探索式开发和实时协作

## 架构

### 后端 (lib/chat-session.cjs)
```javascript
// 主要功能
createSession(agentId, title)    // 创建新会话
sendMessage(sessionId, content)  // 发送消息（流式返回）
listSessions()                   // 列出所有会话
deleteSession(sessionId)         // 删除会话
stopSession(sessionId)           // 停止正在运行的会话

// 事件流
chatEvents.on('stream', (sessionId, chunk) => {...})
```

### 数据结构
```typescript
interface ChatSession {
  id: string
  agentId: string
  agentName: string
  title: string
  messages: ChatMessage[]
  status: 'idle' | 'waiting' | 'streaming' | 'error'
  createdAt: string
  updatedAt: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  error?: string
}
```

### 环境变量
发送消息时，以下环境变量会传递给 agent：
- `AGENT_TICKS_PROMPT` - 当前用户消息
- `AGENT_TICKS_CHAT_HISTORY` - 完整对话历史
- `AGENT_TICKS_SYSTEM_PROMPT` - Agent 系统提示词
- `AGENT_TICKS_SKILLS` - 启用的技能列表 (JSON)
- `AGENT_TICKS_MCPS` - MCP 服务器列表 (JSON)
- `AGENT_TICKS_PERMISSIONS` - 权限列表 (JSON)

## 使用方式

### 1. 从 UI 启动对话
在 Agent 卡片上点击 "Chat" 按钮，侧边栏会滑出聊天面板。

### 2. 发送消息
在输入框输入消息，按 Enter 发送（Shift+Enter 换行）。

### 3. 流式响应
Agent 的响应会实时流式显示，无需等待完整输出。

### 4. 停止响应
点击红色停止按钮可以中断正在生成的响应。

## Agent 命令配置

为了支持 chat，agent 的 command 需要能处理多轮对话上下文。

### Codex 示例
```bash
codex exec "$AGENT_TICKS_PROMPT"
```

### Claude Code 示例
```bash
claude -p "$AGENT_TICKS_PROMPT"
```

### 自定义脚本示例
如果你想利用 `AGENT_TICKS_CHAT_HISTORY`：
```bash
my-agent --prompt "$AGENT_TICKS_PROMPT" --history "$AGENT_TICKS_CHAT_HISTORY"
```

## 数据存储

### 会话文件
```
~/.agent-ticks/sessions/
├── session_<timestamp>_<random>.json
├── session_<timestamp>_<random>.json
└── ...
```

每个会话文件包含：
- 会话元数据（agent、标题、状态）
- 完整的消息历史
- 时间戳

### 清理策略
当前实现不会自动清理旧会话。建议手动清理或实现定期清理策略：
```bash
# 删除 30 天前的会话
find ~/.agent-ticks/sessions -name "*.json" -mtime +30 -delete
```

## API 参考

### Electron IPC
```javascript
// 前端调用
window.agentTicks.createSession(agentId, title?)
window.agentTicks.sendMessage(sessionId, content)
window.agentTicks.listSessions()
window.agentTicks.getSession(sessionId)
window.agentTicks.deleteSession(sessionId)
window.agentTicks.stopSession(sessionId)

// 监听流式输出
const unsubscribe = window.agentTicks.onChatStream((sessionId, chunk) => {
  console.log(sessionId, chunk)
})
```

### Node.js 模块
```javascript
const chatSession = require('./lib/chat-session.cjs')

// 创建会话
const session = chatSession.createSession('agent_id', 'My Chat')

// 发送消息（返回 Promise）
await chatSession.sendMessage(session.id, 'Hello!')

// 监听流式事件
chatSession.chatEvents.on('stream', (sessionId, chunk) => {
  console.log(chunk)
})
```

## 扩展建议

### 1. 会话管理 UI
当前只支持从 Agent 卡片启动新会话。可以添加：
- 会话列表侧边栏
- 会话重命名
- 会话搜索
- 会话导出（Markdown）

### 2. 上下文管理
当前会话会无限增长。可以添加：
- 自动摘要长对话
- 手动清除历史
- 上下文窗口裁剪

### 3. 多模态支持
- 图片上传和分析
- 文件附件
- 代码高亮和复制

### 4. 协作功能
- 会话分享（导出链接）
- 多人同时查看
- 评论和标注

## 常见问题

### Q: Chat 和 Task 可以共存吗？
A: 可以。它们使用不同的执行路径，互不干扰。

### Q: 如何实现多 Agent 协作？
A: 当前每个会话绑定一个 agent。多 agent 协作需要在 prompt 中显式调用或实现 agent 间通信机制。

### Q: 流式输出依赖什么？
A: 依赖 stdout 实时输出。如果 agent 命令缓冲输出，流式效果会延迟。

### Q: 如何处理长时间运行？
A: 当前没有超时限制。建议在 agent command 中设置超时或手动停止。

## 安全注意事项

1. **命令注入**: 所有用户输入通过环境变量传递，避免直接拼接到 shell 命令
2. **权限控制**: 使用 agent.permissions 字段声明权限，但当前未实际强制执行
3. **数据隐私**: 会话文件以明文存储，包含所有对话内容

## 性能考虑

- **并发限制**: `activeSessions` Map 追踪活跃进程，无硬性限制
- **内存占用**: 每个会话的完整历史保存在内存中，长对话可能占用大量内存
- **磁盘 I/O**: 每次消息更新都会写入磁盘，高频对话可能产生 I/O 瓶颈

## 下一步

- [ ] 实现会话列表管理界面
- [ ] 添加 Markdown 渲染支持
- [ ] 代码块语法高亮
- [ ] 会话导出为 Markdown
- [ ] 上下文窗口管理
- [ ] 多模态输入支持
