import sys
import os
import json

sys.path.insert(0, os.path.dirname(__file__))

from c_parser import parse_structs, struct_definitions
from layout_engine import compute_layout
from config_manager import load_config, save_config

def main():
    if len(sys.argv) != 3:
        print(json.dumps({"success": False, "error": "Usage: save_type.py <type_name> <definition_text>"}))
        return

    type_name = sys.argv[1]
    definition_text = sys.argv[2]

    try:
        config = load_config()
        type_db = {}
        for t, info in config["types"].items():
            type_db[t] = {"size": info["size"], "align": info["align"]}
        type_db["T*"] = {
            "size": config["pointer"]["size"],
            "align": config["pointer"]["align"]
        }

        # Clear old definitions
        struct_definitions.clear()

        # Parse the full definition (e.g., "struct X { ... };")
        cleaned_code = parse_structs(definition_text)
        if type_name not in struct_definitions:
            # Maybe it's a typedef? Try to find any struct
            if not struct_definitions:
                print(json.dumps({"success": False, "error": "No struct found in definition"}))
                return
            # Use the first defined struct
            actual_name = next(iter(struct_definitions))
            if actual_name != type_name:
                print(json.dumps({"success": False, "error": f"Expected {type_name}, got {actual_name}"}))
                return

        layout = compute_layout(type_name, config, type_db, pack=None)
        if not layout or "total_size" not in layout:
            print(json.dumps({"success": False, "error": "Layout computation failed"}))
            return

        config["types"][type_name] = {
            "size": layout["total_size"],
            "align": layout["max_align"]
        }
        save_config(config)
        print(json.dumps({"success": True}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()