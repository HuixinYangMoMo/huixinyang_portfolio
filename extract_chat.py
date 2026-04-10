import sqlite3
import json
import sys

db_path = "/Users/entropy/Library/Application Support/Cursor/User/workspaceStorage/d308b67c132b150db5a5f7d17de61604/state.vscdb"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT key, value FROM ItemTable")
rows = cursor.fetchall()
for key, value in rows:
    if "aiService.generations" in key or "aiService.prompts" in key or "composer.composerData" in key:
        print(f"--- {key} ---")
        try:
            parsed = json.loads(value)
            print(json.dumps(parsed, indent=2, ensure_ascii=False)[:3000])
        except Exception:
            print(value[:3000])
conn.close()
