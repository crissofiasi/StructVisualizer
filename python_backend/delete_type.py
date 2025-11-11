import sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from config_manager import load_config, save_config

name = sys.argv[1]
config = load_config()
if name in config["types"]:
    del config["types"][name]
    save_config(config)
    print(json.dumps({"success": True}))
else:
    print(json.dumps({"success": False, "error": "Type not found"}))