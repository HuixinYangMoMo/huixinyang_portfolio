import sqlite3
import os
import glob
import json

base_dir = os.path.expanduser("~/Library/Application Support/Cursor/User/workspaceStorage")

for db_path in glob.glob(os.path.join(base_dir, "*", "state.vscdb")):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM ItemTable")
        rows = cursor.fetchall()
        for key, value in rows:
            if "composer.composerData" in key:
                try:
                    parsed = json.loads(value)
                    if "allComposers" in parsed:
                        for composer in parsed["allComposers"]:
                            name = composer.get("name", "")
                            if "开屏" in name or "视频" in name:
                                print(f"Found Composer Title: {name} in {db_path}")
                                print("Text:", composer.get("text", "")[:200])
                except:
                    pass
        conn.close()
    except Exception as e:
        pass
