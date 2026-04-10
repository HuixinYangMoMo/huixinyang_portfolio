import sqlite3
import os
import glob
import json

base_dir = os.path.expanduser("~/Library/Application Support/Cursor/User/workspaceStorage")
found = False

for db_path in glob.glob(os.path.join(base_dir, "*", "state.vscdb")):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM ItemTable")
        rows = cursor.fetchall()
        for key, value in rows:
            if "视频" in value or "开屏" in value:
                print(f"Found in {db_path}, key: {key}")
                # We want to print a snippet
                print(value[:500])
                print("-" * 50)
                found = True
        conn.close()
    except Exception as e:
        pass

if not found:
    print("Not found in workspaceStorage sqlite.")
