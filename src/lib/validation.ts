export function validateNickname(nickname: string): string | null {
  const trimmed = nickname.trim();
  if (!trimmed) return 'Please enter your nickname';
  if (trimmed.length < 2) return 'Nickname must be at least 2 characters';
  if (trimmed.length > 15) return 'Nickname must be 15 characters or less';
  if (!/^[a-zA-Z0-9\s._-]+$/.test(trimmed)) {
    return 'Nickname can only contain letters, numbers, spaces, dots, hyphens, and underscores';
  }
  if (trimmed !== trimmed.replace(/\s+/g, ' ')) {
    return 'Please avoid excessive spaces in your nickname';
  }
  return null;
}

export function validateRoundDuration(duration: number): string | null {
  if (!Number.isInteger(duration)) return 'Duration must be a whole number';
  if (duration < 15) return 'Duration must be at least 15 seconds';
  if (duration > 300) return 'Duration cannot exceed 5 minutes (300 seconds)';
  return null;
}



