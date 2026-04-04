export default function Home() {
  return (
    <main style={{
      fontFamily: "monospace", background: "#030712", color: "#fff",
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: 16,
    }}>
      <div style={{ fontSize: "4rem" }}>🤖</div>
      <h1 style={{ color: "#0052FF", fontSize: "2rem", margin: 0 }}>TipJar Agent</h1>
      <p style={{ color: "#888" }}>Autonomous onchain agent — watching TipJar 24/7</p>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <a href="/api/status" style={{ color: "#0052FF" }}>Status →</a>
        <a href="https://github.com/nodecapitalnext/base-agent" style={{ color: "#888" }}>GitHub →</a>
      </div>
    </main>
  );
}
