interface UserAvatarProps { seed: string; src?: string | null; className?: string; }

function seedNumber(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function UserAvatar({ seed, src, className = "" }: UserAvatarProps) {
  if (src) return <img className={className} src={src} alt="" referrerPolicy="no-referrer" />;
  const value = seedNumber(seed || "lockedin");
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < 5; y += 1) for (let x = 0; x < 3; x += 1) if ((value >> ((y * 3 + x) % 31)) & 1) { cells.push([x, y]); if (x < 2) cells.push([4 - x, y]); }
  const hue = value % 24;
  const colors = ["#8e2e24", "#17231d", "#9a6a28", "#5d6d5d"];
  return <svg className={className} viewBox="0 0 5 5" role="img" aria-label="Generated profile avatar"><rect width="5" height="5" fill="#f2eddf"/>{cells.map(([x,y],index)=><rect key={`${x}-${y}-${index}`} x={x} y={y} width="1" height="1" fill={colors[(hue + x + y) % colors.length]}/>)}</svg>;
}
