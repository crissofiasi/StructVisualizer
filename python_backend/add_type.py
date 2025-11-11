import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import json
from config_manager import load_config, save_config

try:
    name, size, align = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    config = load_config()
    config["types"][name] = {"size": size, "align": align}
    save_config(config)
    print(json.dumps({"success": True}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))