const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const store = require('./store.cjs');

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const MAX_ZIP_ENTRIES = 1000;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

function sanitizeAgentId(agentId) {
  const value = String(agentId || '');
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
    throw new Error('Invalid agent id');
  }
  return value;
}

function ensureAgent(agentId) {
  const normalized = sanitizeAgentId(agentId);
  const agent = store.listAgents().find((item) => item.id === normalized);
  if (!agent) throw new Error(`Agent not found: ${normalized}`);
  return agent;
}

function skillsPath(agentId) {
  const normalized = sanitizeAgentId(agentId);
  return store.agentSkillsPath(normalized);
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error('Invalid zip archive');
}

function safeEntryPath(rawName) {
  const normalized = rawName.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) return null;
  if (/^[a-zA-Z]:\//.test(normalized)) throw new Error(`Unsafe zip entry: ${rawName}`);

  const clean = path.posix.normalize(normalized);
  if (clean === '.' || clean.startsWith('../') || clean === '..') {
    throw new Error(`Unsafe zip entry: ${rawName}`);
  }
  return clean;
}

function readCentralDirectory(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let offset = centralDirectoryOffset;

  if (entryCount > MAX_ZIP_ENTRIES) {
    throw new Error(`Zip contains too many entries: ${entryCount}`);
  }

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Invalid zip central directory');
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    const entryPath = safeEntryPath(fileName);

    if (entryPath && !entryPath.endsWith('/')) {
      entries.push({
        compressedSize,
        compressionMethod,
        localHeaderOffset,
        path: entryPath,
        uncompressedSize,
      });
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function extractEntry(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`Invalid local zip entry: ${entry.path}`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  const compressed = buffer.subarray(dataStart, dataEnd);

  if (entry.compressionMethod === 0) return Buffer.from(compressed);
  if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Unsupported zip compression method ${entry.compressionMethod}: ${entry.path}`);
}

function uploadSkillZip(agentId, archive) {
  const agent = ensureAgent(agentId);
  if (!archive?.data) throw new Error('Missing zip data');

  const buffer = Buffer.from(archive.data);
  const entries = readCentralDirectory(buffer);
  const destination = skillsPath(agent.id);
  let totalBytes = 0;
  let files = 0;

  fs.mkdirSync(destination, { recursive: true });

  for (const entry of entries) {
    totalBytes += entry.uncompressedSize;
    if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('Zip archive is too large after extraction');
    }

    const targetPath = path.join(destination, entry.path);
    const resolvedTarget = path.resolve(targetPath);
    const resolvedDestination = path.resolve(destination);
    if (!resolvedTarget.startsWith(`${resolvedDestination}${path.sep}`)) {
      throw new Error(`Unsafe zip entry: ${entry.path}`);
    }

    const content = extractEntry(buffer, entry);
    fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
    fs.writeFileSync(resolvedTarget, content);
    files += 1;
  }

  return {
    agentId: agent.id,
    files,
    path: destination,
    uploadedAt: store.nowIso(),
  };
}

module.exports = {
  skillsPath,
  uploadSkillZip,
};
