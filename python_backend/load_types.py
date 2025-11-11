import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Now imports will work
from config_manager import load_config, save_config
import json

sys.path.insert(0, os.path.dirname(__file__))
from config_manager import load_config

config = load_config()
print(json.dumps(config["types"]))