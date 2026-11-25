/**
 * Writes an audit trail entry for important creates, edits, approvals, and cancellations.
 */
async function logAudit(dbOrConn, { userId = null, userName = 'System', action, entityType, entityId = null, details = '' }) {
  await dbOrConn.query(
    `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, userName, action, entityType, entityId, details]
  );
}

module.exports = {
  logAudit,
};
