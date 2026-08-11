// Shared county normalization: profile data often stores "Salt Lake County",
// while templates append the word "County" themselves. Every base template
// normalizes at generateDocument() entry so no composition site can double it.
function normalizeCountyName(county) {
  return typeof county === 'string' ? county.replace(/\s+county$/i, '').trim() : county;
}

module.exports = { normalizeCountyName };
