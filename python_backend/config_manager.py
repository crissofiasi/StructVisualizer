import json
import os

CONFIG_FILE = os.environ.get('STRUCT_VISUALIZER_CONFIG', 'config.json')

DEFAULT_CONFIG = {
    "types": {
        "char": {"size": 1, "align": 1},
        "boolean": {"size": 1, "align": 1},
        "short": {"size": 2, "align": 2},
        "int": {"size": 4, "align": 4},
        "long": {"size": 8, "align": 8},
        "long long": {"size": 8, "align": 8},
        "float": {"size": 4, "align": 4},
        "double": {"size": 8, "align": 8},
        "size_t": {"size": 4, "align": 4},
        "time_t": {"size": 4, "align": 4},
        "uint16": {"size": 2, "align": 2},
        "uint32": {"size": 4, "align": 4},
        "uint64": {"size": 8, "align": 8},
        "uint8": {"size": 1, "align": 1},
        "Std_ReturnType": {"size": 1, "align": 1}
    },
    "pointer": {"size": 4, "align": 4},
    "gui": {
        "window_width": 1800,
        "window_height": 900,
        "left_width": 600,
        "right_width": 400,
        "byte_width_px": 80,
        "pack_value": "4"
    }
}

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                for key, default in DEFAULT_CONFIG.items():
                    if key not in config:
                        config[key] = default
                return config
        except:
            return DEFAULT_CONFIG.copy()
    else:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        return DEFAULT_CONFIG.copy()

def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)