export default function LocalGameShell({ title, description, children }) {
  return (
    <section className="panel">
      <h3>{title} · Pass-and-Play</h3>
      <p>{description}</p>
      {children}
    </section>
  );
}
