# Reuse add_type.py logic — "update" is same as "add"
import sys, json, os
from config_manager import load_config, save_config
sys.path.insert(0, os.path.dirname(__file__))

name, size, align = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
config = load_config()
config["types"][name] = {"size": size, "align": align}
save_config(config)
print(json.dumps({"success": True}))