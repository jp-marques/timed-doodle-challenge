function validateNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') return 'Invalid nickname';
  const trimmed = nickname.trim();
  if (trimmed.length < 2) return 'Nickname must be at least 2 characters';
  if (trimmed.length > 15) return 'Nickname must be 15 characters or less';
  if (!/^[a-zA-Z0-9\s._-]+$/.test(trimmed)) return 'Nickname contains invalid characters';
  if (trimmed !== trimmed.replace(/\s+/g, ' ')) return 'Please avoid excessive spaces in your nickname';
  return null;
}

function validateRoomCode(code) {
  if (!code || typeof code !== 'string') return 'Invalid room code';
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length !== 5) return 'Room code must be 5 characters';
  if (!/^[A-Z0-9]+$/.test(trimmed)) return 'Room code contains invalid characters';
  return null;
}

function validateRoundDuration(duration) {
  if (!duration || typeof duration !== 'number') return 'Invalid duration';
  if (!Number.isInteger(duration)) return 'Duration must be a whole number';
  if (duration < 15) return 'Duration must be at least 15 seconds';
  if (duration > 300) return 'Duration cannot exceed 5 minutes (300 seconds)';
  return null;
}

module.exports = { validateNickname, validateRoomCode, validateRoundDuration };



