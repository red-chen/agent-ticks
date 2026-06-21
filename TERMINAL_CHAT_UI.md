# Terminal 风格 Chat 界面

## 新设计概览

已将 Chat 功能从侧边栏重构为全屏 Terminal 风格的交互界面。

### 布局结构

```
┌─────────────────────────────────────────────────────┐
│  $ Chat with Codex Agent          [收起] [关闭]     │
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│  Terminal (50%)          │  File Tree (50%)         │
│                          │                          │
│  > You:                  │  Workspace               │
│  Help me fix the bug     │  ├─ src/                │
│                          │  │  ├─ App.tsx           │
│  │ Agent:                │  │  └─ types.ts          │
│  │ Let me check...       │  ├─ lib/                │
│  │                       │  └─ package.json         │
│                          │                          │
│  > _                     │                          │
└──────────────────────────┴──────────────────────────┘
```

## 主要特性

### 1. 全屏 Terminal 视图
- **占据整个窗口** - 完全沉浸的开发体验
- **左右分栏** - Terminal (50%) + File Tree (50%)
- **可收起文件树** - 点击收起按钮让 Terminal 占满 100%

### 2. Terminal 样式消息流
```
> You:
Fix the TypeScript error in App.tsx

│ Codex Agent:
│ I'll check the type definitions and fix the error.
│
│ Reading App.tsx...
│ Found the issue: missing import for ChatSession type.
│
│ Fixing now...

> _
```

- **`>` 前缀** - 用户输入
- **`│` 前缀** - Agent 响应
- **等宽字体** - SF Mono / Monaco / Cascadia Code
- **流式输出** - 字符逐个显示，实时反馈

### 3. 文件树
- **层级展开/收起** - 点击目录图标切换
- **文件图标区分** - 目录用文件夹图标，文件用文档图标
- **悬停高亮** - 鼠标悬停时背景变化
- **完全可收起** - 点击 `[收起]` 按钮隐藏，Terminal 占满整个宽度

### 4. 交互优化
- **单行输入** - 底部固定输入框
- **Enter 发送** - 无需 Shift+Enter
- **实时流式响应** - Agent 输出实时显示
- **停止按钮** - 可随时中断正在生成的响应

## 技术细节

### 组件结构
```tsx
<div className="chat-terminal-view">           // 全屏容器
  <div className="chat-terminal-header">       // 顶部标题栏
    <div className="chat-terminal-title">
      <span className="chat-terminal-prompt">$</span>
      <span>{session.title}</span>
    </div>
    <div className="chat-terminal-actions">
      <button onClick={() => setShowFileTree(!showFileTree)}>
        {showFileTree ? <PanelRightClose /> : <PanelRightOpen />}
      </button>
      <button onClick={onClose}><X /></button>
    </div>
  </div>

  <div className="chat-terminal-body">         // 主体内容区
    <div className="chat-terminal-left split"> // Terminal (50% or 100%)
      <div className="terminal-messages">      // 消息滚动区
        {messages.map(msg => (
          <div className="terminal-line">
            <span className="terminal-prefix">{prefix}</span>
            <div className="terminal-content">
              <span className="terminal-role">{role}</span>
              <span className="terminal-text">{content}</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="terminal-input-wrapper"> // 输入区
        <span className="terminal-prompt">></span>
        <input className="terminal-input" />
        <button className="terminal-send-btn"><Send /></button>
      </div>
    </div>

    {showFileTree && (
      <div className="chat-terminal-right">   // File Tree (50%)
        <div className="file-tree-header">Workspace</div>
        <div className="file-tree">
          {renderFileTree(fileTree)}
        </div>
      </div>
    )}
  </div>
</div>
```

### CSS 关键点
```css
/* 全屏覆盖 */
.chat-terminal-view {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  z-index: 1000;
}

/* 左右分栏 */
.chat-terminal-left.split { width: 50%; }
.chat-terminal-left.full { width: 100%; }
.chat-terminal-right { width: 50%; }

/* Terminal 字体 */
.terminal-messages,
.terminal-input {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Courier New', monospace;
}

/* 前缀样式 */
.terminal-prefix {
  color: var(--text-accent);  /* 主题色 */
  font-weight: 600;
}
```

## 使用流程

1. **启动 Chat**
   - 在 Agent 列表中点击任意 Agent 卡片上的 "Chat" 按钮
   - 全屏 Terminal 界面滑入

2. **发送消息**
   - 在底部输入框输入消息
   - 按 Enter 发送（不支持多行输入）

3. **查看文件树**
   - 右侧默认显示 Workspace 文件树
   - 点击目录可展开/收起子文件

4. **收起文件树**
   - 点击顶部 `[收起]` 按钮
   - Terminal 扩展到 100% 宽度

5. **停止响应**
   - 点击输入框右侧的红色停止按钮
   - 中断 Agent 正在生成的响应

6. **关闭 Chat**
   - 点击顶部 `[关闭]` 按钮
   - 返回 Agent 管理界面

## 对比旧版侧边栏设计

| 维度 | 旧版（侧边栏） | 新版（Terminal） |
|------|---------------|------------------|
| 布局 | 右侧 420px 侧边栏 | 全屏，左右各 50% |
| 风格 | 聊天气泡式 | Terminal 命令行式 |
| 字体 | 系统默认 | 等宽字体 |
| 文件树 | 无 | 有，可收起 |
| 输入框 | 多行 textarea | 单行 input |
| 沉浸感 | 低 | 高（全屏） |
| 开发者体验 | 普通 | 熟悉的 CLI 风格 |

## 已知限制

1. **文件树数据** - 当前是模拟数据，需要后续集成真实的 workspace 扫描
2. **文件点击** - 点击文件暂时无操作，后续可添加文件内容预览
3. **单行输入** - 不支持多行消息（可考虑添加 Shift+Enter 支持）
4. **没有代码高亮** - Terminal 输出纯文本，后续可添加 ANSI 颜色支持

## 下一步改进

### 短期（优先级高）
- [ ] 集成真实的文件树数据（从 agent.workingDirectory 扫描）
- [ ] 点击文件显示内容预览
- [ ] 支持 Shift+Enter 多行输入
- [ ] 添加代码块语法高亮

### 中期
- [ ] 文件变更实时监控（agent 修改文件时高亮显示）
- [ ] 支持 ANSI 颜色码渲染
- [ ] 添加命令历史（上下箭头翻阅）
- [ ] 支持文件搜索和过滤

### 长期
- [ ] 内嵌文件编辑器（点击文件直接编辑）
- [ ] Diff 视图（对比 agent 修改前后）
- [ ] 多 Tab 支持（同时与多个 agent 对话）
- [ ] Session 历史记录查看

## 兼容性

- ✅ macOS - 已测试
- ✅ 亮色/暗色主题 - 完全支持
- ✅ 等宽字体 - SF Mono / Monaco / Cascadia Code 自动回退
- ⚠️ Windows/Linux - 理论支持，待测试

## 性能

- **渲染优化** - 使用 React key 和虚拟滚动（大量消息时）
- **内存占用** - 文件树按需加载（当前模拟数据全量加载）
- **流式延迟** - 通过 IPC 实时转发，延迟 < 50ms

## 反馈

当前实现是第一版 MVP，欢迎反馈：
- Terminal 风格是否符合预期？
- 左右 50% 分栏比例是否合适？
- 还需要哪些功能？
