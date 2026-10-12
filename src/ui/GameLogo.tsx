import './game-logo.css';

const logoUrl = new URL('../assets/regavo-logo.webp', import.meta.url).href;

export function GameLogo({ size = 50 }: { size?: number }) {
  return (
    <img
      className="game-logo"
      src={logoUrl}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  );
}
