export default function Avatar({ member, small = false, size = null, className = '' }) {
  const sizeClass = size ? `avatar-${size}` : small ? 'small' : '';
  const initials = member?.initials || (member?.name ? member.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') : '?');
  const bg = member?.color || '#7c3aed';

  return (
    <span
      className={`avatar ${sizeClass} ${className}`.trim()}
      style={{
        background: bg,
        aspectRatio: '1 / 1',
        flexShrink: 0
      }}
      aria-label={member?.name || 'User avatar'}
      title={member?.name || 'Member'}
    >
      {initials}
    </span>
  );
}
