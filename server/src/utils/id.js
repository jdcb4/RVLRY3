export function createCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function createPlayerId() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}
