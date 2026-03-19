import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

export default function App() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [newValue, setNewValue] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    axios.get("http://127.0.0.1:8000/trackers/1/entries")
      .then(res => {
        const data = res.data.map(e => ({
          datum: new Date(e.recorded_at).toLocaleDateString("de-DE"),
          wert: e.value,
          notiz: e.note
        }));
        setEntries(data);
        const werte = data.map(d => d.wert);
        setStats({
          durchschnitt: (werte.reduce((a, b) => a + b, 0) / werte.length).toFixed(1),
          minimum: Math.min(...werte).toFixed(1),
          maximum: Math.max(...werte).toFixed(1),
          trend: (werte[werte.length - 1] - werte[0]).toFixed(1)
        });
      });
  };

  useEffect(() => { loadData(); }, []);

  const addEntry = () => {
    if (!newValue) return;
    setSaving(true);
    axios.post("http://127.0.0.1:8000/trackers/1/entries", {
      value: parseFloat(newValue),
      note: newNote
    }).then(() => {
      setNewValue("");
      setNewNote("");
      setSaving(false);
      loadData();
    });
  };

  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    axios.post(
      "http://127.0.0.1:8000/trackers/1/import",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    ).then(res => {
      alert(res.data.message);
      loadData();
    }).catch(err => {
      alert("Fehler: " + err.response?.data?.detail);
    });
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.logo}>PrivateBI</h1>
        <p style={styles.sub}>Dein persönliches Daten-Dashboard</p>
      </header>

      <main style={styles.main}>
        <h2 style={styles.sectionTitle}>Körpergewicht</h2>

        {stats && (
          <div style={styles.kpiRow}>
            <div style={styles.kpi}>
              <span style={styles.kpiLabel}>Durchschnitt</span>
              <span style={styles.kpiValue}>{stats.durchschnitt} kg</span>
            </div>
            <div style={styles.kpi}>
              <span style={styles.kpiLabel}>Minimum</span>
              <span style={styles.kpiValue}>{stats.minimum} kg</span>
            </div>
            <div style={styles.kpi}>
              <span style={styles.kpiLabel}>Maximum</span>
              <span style={styles.kpiValue}>{stats.maximum} kg</span>
            </div>
            <div style={styles.kpi}>
              <span style={styles.kpiLabel}>Trend</span>
              <span style={{
                ...styles.kpiValue,
                color: stats.trend > 0 ? "#f87171" : "#34d399"
              }}>
                {stats.trend > 0 ? "+" : ""}{stats.trend} kg
              </span>
            </div>
          </div>
        )}

        <div style={styles.inputCard}>
          <h3 style={styles.inputTitle}>Neuer Eintrag</h3>
          <div style={styles.inputRow}>
            <input
              type="number"
              placeholder="Gewicht in kg"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              style={styles.input}
              step="0.1"
            />
            <input
              type="text"
              placeholder="Notiz (optional)"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              style={styles.input}
            />
            <button onClick={addEntry} disabled={saving} style={styles.button}>
              {saving ? "..." : "Speichern"}
            </button>
          </div>
        </div>

        <div style={styles.inputCard}>
          <h3 style={styles.inputTitle}>CSV importieren</h3>
          <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>
            Apple Health Export via{" "}
            <a
              href="https://apps.apple.com/de/app/simple-health-export-csv/id1535380115"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#818cf8" }}
            >
              Simple Health Export CSV
            </a>
          </p>
          <div style={styles.inputRow}>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSV}
              style={{ color: "#e2e8f0", fontSize: "0.9rem", flex: 1 }}
            />
          </div>
        </div>

        <div style={styles.chartCard}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={entries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
              <XAxis dataKey="datum" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 8 }}
                labelStyle={{ color: "#94a3b8" }}
                itemStyle={{ color: "#818cf8" }}
              />
              <Line
                type="monotone"
                dataKey="wert"
                stroke="#818cf8"
                strokeWidth={2}
                dot={{ fill: "#818cf8", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Datum</th>
                <th style={styles.th}>Wert</th>
                <th style={styles.th}>Notiz</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{e.datum}</td>
                  <td style={styles.td}>{e.wert} kg</td>
                  <td style={styles.td}>{e.notiz || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const styles = {
  app: { background: "#0f1117", minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "1.5rem 2rem" },
  logo: { fontSize: "1.5rem", fontWeight: 700, color: "#818cf8", margin: 0 },
  sub: { fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" },
  main: { padding: "2rem", maxWidth: 1100, margin: "0 auto" },
  sectionTitle: { fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1.5rem" },
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" },
  kpi: { background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" },
  kpiLabel: { fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" },
  kpiValue: { fontSize: "1.75rem", fontWeight: 700, color: "#818cf8" },
  chartCard: { background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" },
  tableCard: { background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #2d3148" },
  td: { padding: "0.75rem 1rem", fontSize: "0.9rem", color: "#e2e8f0" },
  trEven: { background: "#1a1d27" },
  trOdd: { background: "#151821" },
  inputCard: { background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" },
  inputTitle: { fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" },
  inputRow: { display: "flex", gap: "1rem", alignItems: "center" },
  input: { background: "#0f1117", border: "1px solid #2d3148", borderRadius: 8, padding: "0.75rem 1rem", color: "#e2e8f0", fontSize: "0.95rem", flex: 1, outline: "none" },
  button: { background: "#818cf8", border: "none", borderRadius: 8, padding: "0.75rem 1.5rem", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.95rem", whiteSpace: "nowrap" },
};