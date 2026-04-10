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
            if "视频为主" in value or "开屏设计" in value or "视频为主的开屏设计" in value:
                print(f"===========================================================")
                print(f"FOUND IN: {db_path}, Key: {key}")
                
                # Check if it's a composerData or generations where we can extract things
                if "aiService.generations" in key or "aiService.prompts" in key or "composer" in key:
                    try:
                        parsed = json.loads(value)
                        # We only print parts of it to avoid flooding
                        print(json.dumps(parsed, indent=2, ensure_ascii=False)[:1000])
                    except:
                        print(value[:1000])
                else:
                    print(value[:1000])
        conn.close()
    except Exception as e:
        pass
