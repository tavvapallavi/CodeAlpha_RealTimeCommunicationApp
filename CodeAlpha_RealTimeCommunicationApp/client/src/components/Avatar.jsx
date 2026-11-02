const COLORS = ["#137A6B", "#B45309", "#6D3FC0", "#1D5FA8", "#B4234A", "#4D6B1F"];

export default function Avatar({ name = "?", size = 64 }) {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.42, background: COLORS[hash % COLORS.length] }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
