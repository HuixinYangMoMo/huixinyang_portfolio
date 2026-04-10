import sqlite3
import os
import glob
import json

base_dir = os.path.expanduser("~/Library/Application Support/Cursor/User/workspaceStorage")
found_text = []

# search workspace storage
for db_path in glob.glob(os.path.join(base_dir, "*", "state.vscdb")):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM ItemTable WHERE key='composer.composerData'")
        row = cursor.fetchone()
        if row:
            parsed = json.loads(row[1])
            if "composerData" in parsed:
                data = parsed["composerData"]
                for cid in ["a436979d-57e5-42f8-ad42-a31c2319bf52", "11d9d8ed-a316-46b8-8a50-aabc713156d4", "27002c98-99ba-4bb6-ae7e-3a347edb3265"]:
                    if cid in data:
                        print(f"FOUND IN {db_path} for {cid}")
                        found_text.append(json.dumps(data[cid], ensure_ascii=False))
        conn.close()
    except Exception as e:
        pass

# search global storage
global_db = os.path.expanduser("~/Library/Application Support/Cursor/User/globalStorage/state.vscdb")
try:
    conn = sqlite3.connect(global_db)
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM ItemTable WHERE key='composer.composerData'")
    row = cursor.fetchone()
    if row:
        parsed = json.loads(row[1])
        for cid in ["a436979d-57e5-42f8-ad42-a31c2319bf52", "11d9d8ed-a316-46b8-8a50-aabc713156d4"]:
            if cid in parsed:
                print(f"FOUND IN GLOBAL for {cid}")
                found_text.append(json.dumps(parsed[cid], ensure_ascii=False))
    conn.close()
except:
    pass

for t in found_text:
    print(t[:1000])
    print("-----")
