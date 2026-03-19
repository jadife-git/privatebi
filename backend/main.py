from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import psycopg2
import psycopg2.extras
import pandas as pd
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    conn = psycopg2.connect(
        host="localhost",
        database="privatebi",
        user="manuel"
    )
    return conn

class EntryInput(BaseModel):
    value: float
    note: str = None
    recorded_at: datetime = None

@app.get("/")
def root():
    return {"message": "PrivateBI API läuft"}

@app.get("/trackers")
def get_trackers():
    conn = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("SELECT * FROM trackers")
    trackers = cursor.fetchall()
    conn.close()
    return trackers

@app.get("/trackers/{tracker_id}/entries")
def get_entries(tracker_id: int):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("""
        SELECT
            e.id,
            e.value,
            e.note,
            e.recorded_at,
            t.name,
            t.unit
        FROM entries e
        JOIN trackers t ON e.tracker_id = t.id
        WHERE e.tracker_id = %s
        ORDER BY e.recorded_at ASC
    """, (tracker_id,))
    entries = cursor.fetchall()
    conn.close()
    return entries

@app.post("/trackers/{tracker_id}/entries")
def add_entry(tracker_id: int, entry: EntryInput):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO entries (tracker_id, value, note, recorded_at)
        VALUES (%s, %s, %s, %s)
    """, (
        tracker_id,
        entry.value,
        entry.note,
        entry.recorded_at or datetime.now()
    ))
    conn.commit()
    conn.close()
    return {"message": "Eintrag gespeichert"}

@app.post("/trackers/{tracker_id}/import")
async def import_csv(tracker_id: int, file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8")

    lines = text.splitlines()
    if lines and lines[0].startswith("sep="):
        text = "\n".join(lines[1:])

    df = pd.read_csv(io.StringIO(text))

    spalten_mapping = {
        "datum": "datum", "startdate": "datum", "date": "datum",
        "wert": "wert", "value": "wert",
        "notiz": "notiz", "note": "notiz"
    }
    df.columns = [spalten_mapping.get(c.lower(), c.lower()) for c in df.columns]

    if "datum" not in df.columns or "wert" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Spalten nicht erkannt. Gefunden: {list(df.columns)}"
        )

    df["wert"] = pd.to_numeric(df["wert"], errors="coerce")
    df["datum"] = pd.to_datetime(df["datum"], errors="coerce", utc=True)
    df = df.dropna(subset=["wert", "datum"])

    conn = get_db()
    cursor = conn.cursor()

    inserted = 0
    skipped = 0

    for _, row in df.iterrows():
        # Duplikat-Check: gleicher Tracker + gleicher Zeitstempel
        cursor.execute("""
            SELECT id FROM entries
            WHERE tracker_id = %s AND recorded_at = %s
        """, (tracker_id, row["datum"]))

        exists = cursor.fetchone()
        if exists:
            skipped += 1
            continue

        cursor.execute("""
            INSERT INTO entries (tracker_id, value, note, recorded_at)
            VALUES (%s, %s, %s, %s)
        """, (
            tracker_id,
            row["wert"],
            row.get("notiz", None),
            row["datum"]
        ))
        inserted += 1

    conn.commit()
    conn.close()
    return {
        "message": f"{inserted} Einträge importiert, {skipped} übersprungen",
        "tracker_id": tracker_id
    }