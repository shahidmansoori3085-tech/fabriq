/** "98765 43210", "+91 98765-43210", "098765 43210" → "9876543210"; null when not an Indian mobile number. */
export function cleanMobile(raw: string): string | null {
  const d = raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
