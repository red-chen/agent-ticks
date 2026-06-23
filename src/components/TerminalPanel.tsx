import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { X, PanelRightClose, PanelRightOpen, ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus, LayoutDashboard, Save } from 'lucide-react';
import { Terminal } from 'xterm';
import type { ITheme } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import type { ChatSession, FileNode } from '../types';

interface TerminalPanelProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionChange: (sessionId: string) => void;
  onWorkspaceSelect: () => void;
  onSessionClose: (sessionId: string) => void;
  onNewSession: () => void;
  onClose: () => void;
  isFullScreen?: boolean;
  workspaceTitle?: string;
  workspaceContent?: ReactNode;
  tabbarActions?: ReactNode;
  appName?: string;
  appVersion?: string;
}

function readCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function terminalTheme(): ITheme {
  return {
    background: readCssVar('--terminal-bg'),
    foreground: readCssVar('--terminal-text'),
    cursor: readCssVar('--text-accent'),
    selectionBackground: readCssVar('--bg-active'),
  };
}

const MIN_TERMINAL_WIDTH = 360;
const FIXED_EDITOR_FILE_TREE_WIDTH = 280;
const MIN_FILE_EDITOR_WIDTH = 240;
const MIN_EDITOR_PANEL_WIDTH = FIXED_EDITOR_FILE_TREE_WIDTH + MIN_FILE_EDITOR_WIDTH;
const TERMINAL_BODY_GAP = 8;
const TERMINAL_RESIZER_WIDTH = 8;

export function TerminalPanel({
  sessions,
  activeSessionId,
  onSessionChange,
  onWorkspaceSelect,
  onSessionClose,
  onNewSession,
  onClose,
  isFullScreen = false,
  workspaceTitle = 'Workspace',
  workspaceContent,
  tabbarActions,
  appName = 'AgentTicks',
  appVersion = '0.1.0',
}: TerminalPanelProps) {
  const [showFileTree, setShowFileTree] = useState(true);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [workingDirectory, setWorkingDirectory] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorError, setEditorError] = useState('');
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [confirmCloseSessionId, setConfirmCloseSessionId] = useState<string | null>(null);
  const [rightPaneWidth, setRightPaneWidth] = useState<number | null>(null);
  const [isPaneResizing, setIsPaneResizing] = useState(false);

  console.log('[TerminalPanel] Render - sessions:', sessions.length, sessions.map(s => ({ id: s.id, name: s.agentName })));
  console.log('[TerminalPanel] Render - activeSessionId:', activeSessionId);

  // 为每个会话维护独立的 terminal 实例
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const paneResizeCleanupRef = useRef<(() => void) | null>(null);
  const terminalResizeFrameRef = useRef<number | null>(null);
  const terminalsRef = useRef<Map<string, { term: Terminal; fitAddon: FitAddon }>>(new Map());
  const terminalContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const hasOpenEditor = Boolean(selectedFile);
  const rightPanelVisible = activeSessionId !== null && showFileTree;
  const leftPaneMode = rightPanelVisible ? 'split' : 'full';
  const hasFileChanges = selectedFile ? editorContent !== selectedFile.content : false;
  const closeCandidate = sessions.find((session) => session.id === confirmCloseSessionId) || null;

  const resizeActiveTerminal = useCallback(() => {
    terminalResizeFrameRef.current = null;
    if (!activeSessionId) return;

    const terminal = terminalsRef.current.get(activeSessionId);
    if (!terminal) return;

    try {
      terminal.fitAddon.fit();
      const dims = terminal.fitAddon.proposeDimensions();
      if (dims) {
        window.agentTicks?.resizePty(activeSessionId, dims.cols, dims.rows).catch(() => {
          // PTY may not be ready yet.
        });
      }
    } catch (err) {
      // Ignore fit errors from hidden or not-yet-mounted terminals.
    }
  }, [activeSessionId]);

  const scheduleActiveTerminalResize = useCallback(() => {
    if (terminalResizeFrameRef.current !== null) return;
    terminalResizeFrameRef.current = window.requestAnimationFrame(resizeActiveTerminal);
  }, [resizeActiveTerminal]);

  const clampRightPaneWidth = useCallback((nextWidth: number) => {
    const containerWidth = bodyRef.current?.clientWidth || window.innerWidth;
    const minRightWidth = hasOpenEditor ? MIN_EDITOR_PANEL_WIDTH : FIXED_EDITOR_FILE_TREE_WIDTH;
    const rightPaneOverhead = hasOpenEditor
      ? (TERMINAL_BODY_GAP * 2 + TERMINAL_RESIZER_WIDTH)
      : TERMINAL_BODY_GAP;
    const maxRightWidth = Math.max(minRightWidth, containerWidth - MIN_TERMINAL_WIDTH - rightPaneOverhead);

    return Math.min(Math.max(nextWidth, minRightWidth), maxRightWidth);
  }, [hasOpenEditor]);

  const resolvedRightPaneWidth = useCallback(() => {
    const containerWidth = bodyRef.current?.clientWidth || window.innerWidth;
    const fallbackWidth = hasOpenEditor
      ? Math.round(containerWidth * 0.5)
      : Math.round(containerWidth * 0.22);

    return clampRightPaneWidth(rightPaneWidth ?? fallbackWidth);
  }, [clampRightPaneWidth, hasOpenEditor, rightPaneWidth]);

  const beginPaneResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!bodyRef.current || !hasOpenEditor) return;

    event.preventDefault();
    paneResizeCleanupRef.current?.();
    setIsPaneResizing(true);
    document.body.classList.add('is-terminal-pane-resizing');

    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    if (handle.setPointerCapture) {
      try {
        handle.setPointerCapture(pointerId);
      } catch (err) {
        // The document listeners below still cover the drag.
      }
    }

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect) return;

      const nextRightWidth = rect.right - moveEvent.clientX;
      setRightPaneWidth(clampRightPaneWidth(nextRightWidth));
      scheduleActiveTerminalResize();
    };

    const stopResize = (stopEvent?: PointerEvent) => {
      if (stopEvent && stopEvent.pointerId !== pointerId) return;
      paneResizeCleanupRef.current?.();
      resizeActiveTerminal();
    };

    const cleanup = () => {
      document.removeEventListener('pointermove', handleMove, true);
      document.removeEventListener('pointerup', stopResize, true);
      document.removeEventListener('pointercancel', stopResize, true);
      window.removeEventListener('blur', cleanup);
      if (handle.releasePointerCapture) {
        try {
          handle.releasePointerCapture(pointerId);
        } catch (err) {
          // Capture may already have been released.
        }
      }
      document.body.classList.remove('is-terminal-pane-resizing');
      setIsPaneResizing(false);
      paneResizeCleanupRef.current = null;
    };

    paneResizeCleanupRef.current = cleanup;
    document.addEventListener('pointermove', handleMove, true);
    document.addEventListener('pointerup', stopResize, true);
    document.addEventListener('pointercancel', stopResize, true);
    window.addEventListener('blur', cleanup);
  };

  useEffect(() => {
    return () => {
      paneResizeCleanupRef.current?.();
      if (terminalResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(terminalResizeFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasOpenEditor) {
      paneResizeCleanupRef.current?.();
    }
  }, [hasOpenEditor]);

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
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', 'Cascadia Code', 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        theme: terminalTheme(),
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

  useEffect(() => {
    const applyTerminalTheme = () => {
      const nextTheme = terminalTheme();
      for (const { term } of terminalsRef.current.values()) {
        term.options.theme = { ...nextTheme };
      }
    };

    applyTerminalTheme();

    const observer = new MutationObserver(applyTerminalTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    });

    return () => observer.disconnect();
  }, []);

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
      setRightPaneWidth((currentWidth) => (
        currentWidth === null ? currentWidth : clampRightPaneWidth(currentWidth)
      ));
      resizeActiveTerminal();
    };

    window.addEventListener('resize', handleResize);
    // 延迟初始 fit，等待 PTY 启动
    const initialFitTimer = window.setTimeout(handleResize, 1000);

    return () => {
      window.clearTimeout(initialFitTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [clampRightPaneWidth, resizeActiveTerminal, showFileTree, isFullScreen]);

  // 当文件树切换时重新 fit
  useEffect(() => {
    if (!activeSessionId) return;

    const fitTimer = window.setTimeout(() => {
      resizeActiveTerminal();
    }, 100);

    return () => window.clearTimeout(fitTimer);
  }, [resizeActiveTerminal, showFileTree, activeSessionId, selectedFile?.path]);

  // 加载真实的文件树
  useEffect(() => {
    if (!activeSession) return;

    const loadFileTree = async () => {
      try {
        const state = await window.agentTicks?.getState();
        const agent = state?.agents.find((a) => a.id === activeSession.agentId);

        const dir = activeSession.workingDirectory || agent?.workingDirectory || '';
        if (!dir) {
          setWorkingDirectory('');
          setFileTree([]);
          setSelectedFile(null);
          setEditorContent('');
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

  const openFile = async (node: FileNode) => {
    if (!workingDirectory || node.type !== 'file') return;

    setIsEditorLoading(true);
    setEditorError('');
    try {
      const file = await window.agentTicks?.readFile(workingDirectory, node.path);
      if (!file) throw new Error('File API is unavailable');
      setSelectedFile(file);
      setEditorContent(file.content);
    } catch (error) {
      setSelectedFile(null);
      setEditorContent('');
      setEditorError((error as Error).message || 'Failed to open file');
    } finally {
      setIsEditorLoading(false);
    }
  };

  const saveFile = async () => {
    if (!workingDirectory || !selectedFile) return;

    setIsSavingFile(true);
    setEditorError('');
    try {
      const file = await window.agentTicks?.writeFile(workingDirectory, selectedFile.path, editorContent);
      if (!file) throw new Error('File API is unavailable');
      setSelectedFile(file);
      setEditorContent(file.content);
    } catch (error) {
      setEditorError((error as Error).message || 'Failed to save file');
    } finally {
      setIsSavingFile(false);
    }
  };

  const closeFile = () => {
    setSelectedFile(null);
    setEditorContent('');
    setEditorError('');
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (selectedFile && editorContent !== selectedFile.content && !isSavingFile) {
        saveFile();
      }
    }
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={`file-tree-item ${selectedFile?.path === node.path ? 'active' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => (node.type === 'directory' ? toggleDirectory(node) : openFile(node))}
          title={node.path}
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

  if (sessions.length === 0 && !workspaceContent) return null;

  const confirmCloseSession = () => {
    if (!confirmCloseSessionId) return;
    onSessionClose(confirmCloseSessionId);
    setConfirmCloseSessionId(null);
  };
  const canResizeRightPane = rightPanelVisible && hasOpenEditor;
  const currentRightPaneWidth = rightPanelVisible
    ? (hasOpenEditor ? resolvedRightPaneWidth() : FIXED_EDITOR_FILE_TREE_WIDTH)
    : 0;

  return (
    <div className="chat-terminal-view">
      {!isFullScreen && (
        <div className="chat-terminal-header">
          <div className="chat-terminal-title">{appName}</div>
          <div className="chat-terminal-version">v{appVersion}</div>
        </div>
      )}

      <div className="chat-terminal-shell">
        <div className="chat-terminal-main-panel">
          <div className="chat-terminal-tabbar">
            <div className="terminal-tabs">
              <div
                className={`terminal-tab terminal-tab-workspace ${activeSessionId === null ? 'active' : ''}`}
                onClick={onWorkspaceSelect}
              >
                <LayoutDashboard size={13} />
                <span className="terminal-tab-title">{workspaceTitle}</span>
              </div>
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
                      e.stopPropagation();
                      setConfirmCloseSessionId(session.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                className="terminal-tab-new"
                onClick={onNewSession}
                title="New chat session"
              >
                <Plus size={12} />
              </button>
            </div>
            <div className="chat-terminal-actions">
              {tabbarActions}
              {activeSession && (
                <button
                  className="chat-terminal-btn"
                  onClick={() => setShowFileTree(!showFileTree)}
                  title={showFileTree ? 'Hide file tree' : 'Show file tree'}
                >
                  {showFileTree ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                </button>
              )}
              {sessions.length > 0 && (
                <button className="chat-terminal-btn" onClick={onClose} title="Close all sessions">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className={`chat-terminal-body ${isPaneResizing ? 'resizing' : ''}`} ref={bodyRef}>
            {activeSessionId === null && (
              <div className="chat-workspace-content">
                {workspaceContent}
              </div>
            )}

            <div
              className={`chat-terminal-left ${leftPaneMode}`}
              style={{
                display: activeSessionId === null ? 'none' : 'flex',
              }}
            >
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

            {rightPanelVisible && (
              <>
                {canResizeRightPane && (
                  <div
                    className="terminal-filetree-resizer"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize file editor"
                    title="Resize file editor"
                    onPointerDown={beginPaneResize}
                  />
                )}
                <div
                  className={`chat-terminal-right ${hasOpenEditor ? 'editor-mode' : 'file-tree-only'}`}
                  style={{ width: `${currentRightPaneWidth}px` }}
                >
                <div className="file-explorer-pane">
                  <div className="file-tree-header">
                    <span>{workingDirectory || 'No working directory'}</span>
                  </div>
                  <div className="file-tree">
                    {fileTree.length > 0 ? (
                      renderFileTree(fileTree)
                    ) : (
                      <div className="file-tree-empty">No files to display</div>
                    )}
                    {isEditorLoading && <div className="file-tree-empty">Opening file...</div>}
                    {editorError && !selectedFile && <div className="file-tree-error">{editorError}</div>}
                  </div>
                </div>

                {selectedFile && (
                  <div className="file-editor-pane">
                    <div className="file-editor-header">
                      <div className="file-editor-title">
                        <FileText size={14} />
                        <span>{selectedFile.name}</span>
                        {hasFileChanges && <em>Unsaved</em>}
                      </div>
                      <div className="file-editor-actions">
                        <button
                          className="file-editor-btn"
                          onClick={saveFile}
                          disabled={!hasFileChanges || isSavingFile}
                          title="Save file (Command+S)"
                        >
                          <Save size={14} />
                        </button>
                        <button className="file-editor-btn" onClick={closeFile} title="Close file">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {editorError && <div className="file-editor-error">{editorError}</div>}
                    <textarea
                      className="file-editor"
                      value={editorContent}
                      spellCheck={false}
                      onKeyDown={handleEditorKeyDown}
                      onChange={(event) => setEditorContent(event.target.value)}
                    />
                  </div>
                )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {closeCandidate && (
        <div className="modal-backdrop">
          <section className="delete-confirm-modal">
            <div className="modal-head">
              <span><X size={15} /> Close session</span>
              <button title="Cancel" onClick={() => setConfirmCloseSessionId(null)}><X size={15} /></button>
            </div>
            <div className="delete-confirm-body">
              <p>Close the session for "{closeCandidate.agentName}"? The running terminal process will be stopped.</p>
            </div>
            <div className="modal-actions">
              <button onClick={() => setConfirmCloseSessionId(null)}>Cancel</button>
              <button className="danger" onClick={confirmCloseSession}>
                <X size={14} />
                Close session
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
