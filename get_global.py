import sqlite3
import os
import glob
import json

db_path = os.path.expanduser("~/Library/Application Support/Cursor/User/globalStorage/state.vscdb")
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM ItemTable")
    rows = cursor.fetchall()
    for key, value in rows:
        if "视频" in value or "开屏" in value:
            print(f"Key: {key}")
            print(value[:300])
            print("---")
    conn.close()
except Exception as e:
    pass
