/**
 * Universal User Avatar Resolver for 180 Sovereign Identity & Profile
 * Resolves avatar across all OIDC claims, OAuth userinfo responses,
 * provider properties, and custom schemas with high-resolution fallbacks.
 */

export function resolveUserAvatar(user: any): string {
  if (!user) return '';

  const raw =
    user.avatarUrl ||
    user.avatar ||
    user.picture ||
    user.photoUrl ||
    user.photo_url ||
    user.avatar_url ||
    user.image ||
    user.profilePicture ||
    user.profile_picture ||
    user.user?.avatarUrl ||
    user.user?.avatar ||
    user.user?.picture ||
    user.user?.photoUrl ||
    '';

  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  return getFallbackAvatar(user.name || user.username || user.email || '180 User');
}

export function getFallbackAvatar(name: string): string {
  const cleanName = (name || 'User').trim();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=2563eb&color=ffffff&bold=true&size=128`;
}
