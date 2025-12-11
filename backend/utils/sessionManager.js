// ============================================================================
// SESSION MANAGER - Manage upload sessions for separate tab uploads
// File: backend/utils/sessionManager.js
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

/**
 * Session storage (In-memory Map for MVP, can be upgraded to Redis)
 */
const uploadSessions = new Map();

/**
 * Session TTL (30 minutes)
 */
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Create a new upload session
 */
export function createNewSession(userId) {
  const sessionId = uuidv4();
  const session = {
    sessionId,
    userId,
    files: {
      data: null,
      placement: null,
      storage: null
    },
    costConfig: {},
    hazmatFilter: 'all',
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL
  };

  uploadSessions.set(sessionId, session);
  console.log(`📦 Created new session: ${sessionId} for user: ${userId}`);

  return session;
}

/**
 * Get session by ID (with ownership check)
 */
export function getSession(sessionId, userId) {
  const session = uploadSessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session expired
  if (Date.now() > session.expiresAt) {
    console.log(`⏱️ Session ${sessionId} expired`);
    cleanupSession(sessionId);
    return null;
  }

  // Verify ownership
  if (session.userId !== userId) {
    console.log(`🚫 Session ${sessionId} does not belong to user ${userId}`);
    return null;
  }

  return session;
}

/**
 * Update session with uploaded tab
 */
export function updateSessionTab(sessionId, tabType, filePath, filename) {
  const session = uploadSessions.get(sessionId);

  if (!session) {
    throw new Error('Session not found');
  }

  session.files[tabType] = {
    path: filePath,
    filename,
    uploaded: true,
    uploadedAt: Date.now()
  };

  uploadSessions.set(sessionId, session);
  console.log(`✅ Updated session ${sessionId} - ${tabType} tab uploaded`);

  return session;
}

/**
 * Check if all required tabs are uploaded
 */
export function isSessionReady(sessionId) {
  const session = uploadSessions.get(sessionId);

  if (!session) {
    return false;
  }

  const requiredTabs = ['data', 'placement', 'storage'];
  const allUploaded = requiredTabs.every(
    tab => session.files[tab]?.uploaded === true
  );

  return allUploaded;
}

/**
 * Get session status (for UI display)
 */
export function getSessionStatus(sessionId) {
  const session = uploadSessions.get(sessionId);

  if (!session) {
    return null;
  }

  const uploadedTabs = Object.keys(session.files)
    .filter(tab => session.files[tab]?.uploaded === true);

  return {
    sessionId: session.sessionId,
    uploadedTabs,
    ready: isSessionReady(sessionId),
    createdAt: session.createdAt,
    expiresAt: session.expiresAt
  };
}

/**
 * Update session config (cost config, hazmat filter)
 */
export function updateSessionConfig(sessionId, costConfig, hazmatFilter) {
  const session = uploadSessions.get(sessionId);

  if (!session) {
    throw new Error('Session not found');
  }

  if (costConfig) {
    session.costConfig = costConfig;
  }

  if (hazmatFilter) {
    session.hazmatFilter = hazmatFilter;
  }

  uploadSessions.set(sessionId, session);
  console.log(`⚙️ Updated session ${sessionId} config`);

  return session;
}

/**
 * Cleanup session and delete uploaded files
 */
export function cleanupSession(sessionId) {
  const session = uploadSessions.get(sessionId);

  if (!session) {
    return;
  }

  // Delete uploaded files
  Object.values(session.files).forEach(file => {
    if (file && file.path) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log(`🗑️ Deleted file: ${file.path}`);
        }
      } catch (err) {
        console.error(`❌ Error deleting file ${file.path}:`, err.message);
      }
    }
  });

  // Remove session
  uploadSessions.delete(sessionId);
  console.log(`🧹 Cleaned up session: ${sessionId}`);
}

/**
 * Cleanup expired sessions (run periodically)
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of uploadSessions.entries()) {
    if (now > session.expiresAt) {
      cleanupSession(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
  }
}

/**
 * Get all sessions for a user (for debugging)
 */
export function getUserSessions(userId) {
  const userSessions = [];

  for (const session of uploadSessions.values()) {
    if (session.userId === userId) {
      userSessions.push({
        sessionId: session.sessionId,
        uploadedTabs: Object.keys(session.files).filter(
          tab => session.files[tab]?.uploaded
        ),
        ready: isSessionReady(session.sessionId),
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      });
    }
  }

  return userSessions;
}

/**
 * Get session count (for monitoring)
 */
export function getSessionCount() {
  return uploadSessions.size;
}

/**
 * Start periodic cleanup (call in server.js)
 */
export function startSessionCleanup(intervalMinutes = 5) {
  setInterval(() => {
    cleanupExpiredSessions();
  }, intervalMinutes * 60 * 1000);

  console.log(`🔄 Session cleanup started (every ${intervalMinutes} minutes)`);
}
