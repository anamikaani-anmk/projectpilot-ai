/** Normalize MySQL row keys to lowercase (handles Windows uppercase column names). */
function normalizeRow(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function normalizeRows(rows) {
  return rows.map(normalizeRow);
}

/** Map legacy inprog status to in_progress. */
function normalizeStatus(status) {
  if (status === "inprog" || status === "in_progress") return "in_progress";
  if (status === "completed") return "done";
  return status;
}

module.exports = { normalizeRow, normalizeRows, normalizeStatus };
