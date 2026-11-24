// QUARR copy never uses em dashes (or spaced en dashes as punctuation): they read as
// AI-written. Applied to AI drafts and to Bench edits before a founder sees them.
export function plainPunctuation(text: string): string {
  return text
    .replace(/\s*\u2014\s*/g, ", ") // em dash
    .replace(/\s+\u2013\s+/g, ", ") // spaced en dash used as a dash
    .replace(/(\d)\s*\u2013\s*(\d)/g, "$1 to $2") // number ranges: 3\u20135 \u2192 3 to 5
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([.!?;:])/g, "$1")
    .replace(/^\s*,\s*/, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
