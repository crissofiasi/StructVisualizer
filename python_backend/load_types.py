import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import json
from config_manager import load_config

try:
    config = load_config()
    print(json.dumps(config["types"]))
except Exception as e:
    print(json.dumps({}), file=sys.stderr)