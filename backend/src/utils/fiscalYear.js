/**
 * Returns the current Indian Financial Year string, e.g. "FY2026-27"
 * Indian FY runs April 1 to March 31.
 */
function getCurrentFY() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  if (month >= 4) return `FY${year}-${String(year + 1).slice(2)}`;
  return `FY${year - 1}-${String(year).slice(2)}`;
}

/**
 * Returns FY string for any given date string (YYYY-MM-DD)
 */
function getFYForDate(dateStr) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 4) return `FY${year}-${String(year + 1).slice(2)}`;
  return `FY${year - 1}-${String(year).slice(2)}`;
}

/**
 * Returns all FY strings from FY2024-25 up to current FY
 */
function getFYList() {
  const current = getCurrentFY();
  const list = [];
  let startYear = 2024;
  while (true) {
    const fy = `FY${startYear}-${String(startYear + 1).slice(2)}`;
    list.push(fy);
    if (fy === current) break;
    startYear++;
  }
  return list.reverse(); // most recent first
}

module.exports = { getCurrentFY, getFYForDate, getFYList };
