// Trim a text value from the form; empty -> null; cut to the column length.
function cleanText(value, max = 60) {
  const s = String(value ?? '').trim();
  return s ? s.slice(0, max) : null;
}

module.exports = { cleanText };
