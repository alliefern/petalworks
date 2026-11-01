import { spriteUrl } from '../assets/manifest';

export function Icon({ k, size = 22, alt = '' }: { k: string; size?: number; alt?: string }) {
  const url = spriteUrl(k);
  if (!url) return <span style={{ width: size, height: size, display: 'inline-block' }} aria-hidden />;
  return <img src={url} width={size} height={size} alt={alt} draggable={false} />;
}
