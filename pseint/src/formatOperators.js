// Presentation only: preserve strings and the original source sent to PSeInt.
export function formatOperators(label) {
  return label.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|<>|<=|>=/g,
    token=>({'<>':'≠','<=':'≤','>=':'≥'}[token] ?? token));
}
