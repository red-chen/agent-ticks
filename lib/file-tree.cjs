const fs = require('fs');
const path = require('path');

/**
 * 扫描目录并生成文件树
 * @param {string} dirPath - 目录路径
 * @param {object} options - 选项
 * @returns {object} 文件树节点
 */
function scanDirectory(dirPath, options = {}) {
  const {
    maxDepth = 5,
    currentDepth = 0,
    ignorePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.DS_Store',
      '*.log',
      '.env',
    ],
  } = options;

  if (currentDepth >= maxDepth) return null;

  try {
    const stats = fs.statSync(dirPath);
    const name = path.basename(dirPath);

    // 检查是否应该忽略
    if (shouldIgnore(name, ignorePatterns)) return null;

    if (stats.isDirectory()) {
      let children = [];
      try {
        const entries = fs.readdirSync(dirPath);
        children = entries
          .map((entry) => {
            const fullPath = path.join(dirPath, entry);
            return scanDirectory(fullPath, {
              ...options,
              currentDepth: currentDepth + 1,
            });
          })
          .filter(Boolean)
          .sort((a, b) => {
            // 目录优先，然后按名称排序
            if (a.type === 'directory' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
          });
      } catch (err) {
        // 无法读取目录（权限问题等）
        console.warn(`Cannot read directory: ${dirPath}`, err.message);
      }

      return {
        name,
        path: dirPath,
        type: 'directory',
        children,
        expanded: currentDepth === 0, // 只展开根目录
      };
    } else if (stats.isFile()) {
      return {
        name,
        path: dirPath,
        type: 'file',
      };
    }

    return null;
  } catch (err) {
    console.warn(`Cannot stat: ${dirPath}`, err.message);
    return null;
  }
}

function shouldIgnore(name, patterns) {
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // 简单的通配符匹配
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(name)) return true;
    } else {
      if (name === pattern) return true;
    }
  }
  return false;
}

/**
 * 获取指定目录的文件树
 * @param {string} workingDirectory - 工作目录
 * @returns {array} 文件树数组
 */
function getFileTree(workingDirectory) {
  if (!workingDirectory || !fs.existsSync(workingDirectory)) {
    return [];
  }

  try {
    const tree = scanDirectory(workingDirectory, {
      maxDepth: 3, // 限制深度，避免扫描太深
    });

    if (!tree || !tree.children) return [];

    return tree.children;
  } catch (err) {
    console.error('Failed to scan file tree:', err);
    return [];
  }
}

module.exports = {
  getFileTree,
};
