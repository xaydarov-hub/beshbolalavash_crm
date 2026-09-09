// Keep textual logins; make Uzbek phone formats (+998 / 998 / local) equivalent.
export function loginKey(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!/^[+\d\s()-]+$/.test(text)) return text;
  const digits = text.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits;
}
