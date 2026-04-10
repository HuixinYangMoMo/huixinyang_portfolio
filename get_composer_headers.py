import sqlite3
import os
import json

db_path = os.path.expanduser("~/Library/Application Support/Cursor/User/globalStorage/state.vscdb")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT value FROM ItemTable WHERE key='composer.composerHeaders'")
row = cursor.fetchone()
if row:
    parsed = json.loads(row[0])
    for c in parsed.get("allComposers", []):
        name = c.get("name", "")
        if "视频" in name or "开屏" in name or "视频为主的开屏设计" in name:
            print(f"ID: {c.get('composerId')} | Title: {name}")
conn.close()
