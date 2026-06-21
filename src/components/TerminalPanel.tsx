import { useState, useEffect, useRef } from 'react';
import { X, PanelRightClose, PanelRightOpen, ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import type { ChatSession, FileNode } from '../types';

interface TerminalPanelProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionChange: (sessionId: string) => void;
  onSessionClose: (sessionId: string) => void;
  onNewSession: () => void;
  onClose: () => void;
  isFullScreen?: boolean;
}

export function TerminalPanel({ sessions, activeSessionId, onSessionChange, onSessionClose, onNewSession, onClose, isFullScreen = false }: TerminalPanelProps) {
  const [showFileTree, setShowFileTree] = useState(true);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [workingDirectory, setWorkingDirectory] = useState<string>('');

  console.log('[TerminalPanel] Render - sessions:', sessions.length, sessions.map(s => ({ id: s.id, name: s.agentName })));
  console.log('[TerminalPanel] Render - activeSessionId:', activeSessionId);

  // 为每个会话维护独立的 terminal 实例
  const terminalsRef = useRef<Map<string, { term: Terminal; fitAddon: FitAddon }>>(new Map());
  const terminalContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // 为每个会话初始化 xterm.js
  useEffect(() => {
    sessions.forEach((session) => {
      // 如果已经初始化过，跳过
      if (terminalsRef.current.has(session.id)) return;

      const container = terminalContainersRef.current.get(session.id);
      if (!container) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'SF Mono', Monaco, 'Cascadia Code', 'Courier New', monospace",
        theme: {
          background: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim(),
          foreground: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
          cursor: getComputedStyle(document.documentElement).getPropertyValue('--text-accent').trim(),
        },
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);

      setTimeout(() => {
        try {
          fitAddon.fit();
        } catch (err) {
          console.warn('fitAddon.fit() failed:', err);
        }
      }, 100);

      terminalsRef.current.set(session.id, { term, fitAddon });

      // 启动 PTY 会话
      window.agentTicks?.startPty(session.id).then(({ cols, rows }) => {
        console.log(`PTY started for ${session.id}: ${cols}x${rows}`);
      }).catch((err) => {
        console.error('Failed to start PTY:', err);
      });

      // 监听用户输入并发送到 PTY
      term.onData((data) => {
        window.agentTicks?.writeToPty(session.id, data);
      });
    });

    // 清理已关闭的会话
    const sessionIds = new Set(sessions.map((s) => s.id));
    for (const [id, { term }] of terminalsRef.current.entries()) {
      if (!sessionIds.has(id)) {
        term.dispose();
        terminalsRef.current.delete(id);
        terminalContainersRef.current.delete(id);
      }
    }
  }, [sessions]);

  // 监听所有会话的 PTY 输出
  useEffect(() => {
    const unsubscribeData = window.agentTicks?.onPtyData((sessionId, data) => {
      const terminal = terminalsRef.current.get(sessionId);
      if (terminal) {
        terminal.term.write(data);
      }
    });

    const unsubscribeExit = window.agentTicks?.onPtyExit((sessionId, exitCode) => {
      const terminal = terminalsRef.current.get(sessionId);
      if (terminal) {
        terminal.term.write(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
      }
    });

    return () => {
      unsubscribeData?.();
      unsubscribeExit?.();
    };
  }, []);

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (!activeSessionId) return;

      const terminal = terminalsRef.current.get(activeSessionId);
      if (terminal) {
        try {
          terminal.fitAddon.fit();
          const dims = terminal.fitAddon.proposeDimensions();
          if (dims) {
            window.agentTicks?.resizePty(activeSessionId, dims.cols, dims.rows).catch(() => {
              // PTY 可能还未启动，忽略错误
            });
          }
        } catch (err) {
          // 忽略 fit 错误
        }
      }
    };

    window.addEventListener('resize', handleResize);
    // 延迟初始 fit，等待 PTY 启动
    setTimeout(handleResize, 1000);

    return () => window.removeEventListener('resize', handleResize);
  }, [activeSessionId, showFileTree, isFullScreen]);

  // 当文件树切换时重新 fit
  useEffect(() => {
    if (!activeSessionId) return;

    setTimeout(() => {
      const terminal = terminalsRef.current.get(activeSessionId);
      if (terminal) {
        try {
          terminal.fitAddon.fit();
          const dims = terminal.fitAddon.proposeDimensions();
          if (dims) {
            window.agentTicks?.resizePty(activeSessionId, dims.cols, dims.rows).catch(() => {
              // 忽略错误
            });
          }
        } catch (err) {
          // 忽略错误
        }
      }
    }, 100);
  }, [showFileTree, activeSessionId]);

  // 加载真实的文件树
  useEffect(() => {
    if (!activeSession) return;

    const loadFileTree = async () => {
      try {
        const state = await window.agentTicks?.getState();
        const agent = state?.agents.find((a) => a.id === activeSession.agentId);

        // 如果没设置 workingDirectory，回退到 home 目录
        const dir = agent?.workingDirectory || state?.home || '';
        if (!dir) {
          setWorkingDirectory('');
          setFileTree([]);
          return;
        }

        setWorkingDirectory(dir);
        const tree = await window.agentTicks?.getFileTree(dir);
        setFileTree(tree || []);
      } catch (err) {
        console.error('Failed to load file tree:', err);
        setFileTree([]);
      }
    };

    loadFileTree();
  }, [activeSession]);

  const toggleDirectory = (node: FileNode) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((n) => {
        if (n.path === node.path) {
          return { ...n, expanded: !n.expanded };
        }
        if (n.children) {
          return { ...n, children: updateNode(n.children) };
        }
        return n;
      });
    };
    setFileTree(updateNode(fileTree));
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className="file-tree-item"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => node.type === 'directory' && toggleDirectory(node)}
        >
          {node.type === 'directory' ? (
            <>
              {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {node.expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
            </>
          ) : (
            <>
              <span style={{ width: '14px' }} />
              <FileText size={14} />
            </>
          )}
          <span className="file-tree-name">{node.name}</span>
        </div>
        {node.type === 'directory' && node.expanded && node.children && (
          <div>{renderFileTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  if (sessions.length === 0) return null;

  return (
    <div className="chat-terminal-view">
      {!isFullScreen && (
        <div className="chat-terminal-header">
          <span className="chat-terminal-title">Agent Chat</span>
        </div>
      )}

      <div className="chat-terminal-tabbar">
        <div className="terminal-tabs">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`terminal-tab ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => onSessionChange(session.id)}
            >
              <span className="terminal-tab-title">{session.agentName}</span>
              <button
                className="terminal-tab-close"
                onClick={(e) => {
                  console.log('[TerminalPanel] Close tab clicked for session:', session.id);
                  console.log('[TerminalPanel] Event:', e);
                  e.stopPropagation();
                  console.log('[TerminalPanel] Calling onSessionClose');
                  onSessionClose(session.id);
                  console.log('[TerminalPanel] onSessionClose called');
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            className="terminal-tab-new"
            onClick={(e) => {
              console.log('[TerminalPanel] New session button clicked');
              console.log('[TerminalPanel] Event:', e);
              e.stopPropagation();
              console.log('[TerminalPanel] Calling onNewSession');
              onNewSession();
              console.log('[TerminalPanel] onNewSession called');
            }}
            title="New chat session"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="chat-terminal-actions">
          <button
            className="chat-terminal-btn"
            onClick={() => setShowFileTree(!showFileTree)}
            title={showFileTree ? 'Hide file tree' : 'Show file tree'}
          >
            {showFileTree ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
          <button className="chat-terminal-btn" onClick={(e) => {
            console.log('[TerminalPanel] Close all sessions clicked');
            e.stopPropagation();
            onClose();
          }} title="Close all sessions">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="chat-terminal-body">
        <div className={`chat-terminal-left ${showFileTree ? 'split' : 'full'}`}>
          {sessions.map((session) => (
            <div
              key={session.id}
              ref={(el) => {
                if (el) terminalContainersRef.current.set(session.id, el);
              }}
              className="xterm-container"
              style={{ display: session.id === activeSessionId ? 'block' : 'none' }}
            />
          ))}
        </div>

        {showFileTree && (
          <div className="chat-terminal-right">
            <div className="file-tree-header">
              <span>{workingDirectory || 'Workspace'}</span>
            </div>
            <div className="file-tree">
              {fileTree.length > 0 ? (
                renderFileTree(fileTree)
              ) : (
                <div className="file-tree-empty">No files to display</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
