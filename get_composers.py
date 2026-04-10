import sqlite3
import json

db_path = "/Users/entropy/Library/Application Support/Cursor/User/workspaceStorage/d308b67c132b150db5a5f7d17de61604/state.vscdb"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT key, value FROM ItemTable WHERE key='composer.composerData'")
row = cursor.fetchone()
if row:
    value = row[1]
    parsed = json.loads(value)
    if "allComposers" in parsed:
        for c in parsed["allComposers"]:
            print(f"ID: {c.get('composerId')} | Title: {c.get('name')}")
conn.close()
