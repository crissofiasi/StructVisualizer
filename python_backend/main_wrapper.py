#!/usr/bin/env python3
import sys
import os
import json

sys.path.insert(0, os.path.dirname(__file__))

from c_parser import parse_structs, struct_definitions
from layout_engine import compute_layout
from config_manager import load_config, save_config

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: main_wrapper.py <c_code> <pack_value> [add_to_db]"}))
        return

    c_code = sys.argv[1]
    pack_str = sys.argv[2]
    add_to_db = len(sys.argv) > 3 and sys.argv[3] == '1'

    config = load_config()
    type_db = {}
    for t, info in config["types"].items():
        type_db[t] = {"size": info["size"], "align": info["align"]}
    type_db["T*"] = {
        "size": config["pointer"]["size"],
        "align": config["pointer"]["align"]
    }

    cleaned_code = parse_structs(c_code)
    if not struct_definitions:
        print(json.dumps({"error": "No valid struct found."}))
        return

    struct_name = next(iter(struct_definitions))
    pack_value = None
    if pack_str.isdigit() and int(pack_str) > 0:
        pack_value = int(pack_str)

    layout = compute_layout(struct_name, config, type_db, pack=pack_value)

    if layout is None:
        print(json.dumps({"error": "Layout computation failed."}))
        return

    if "unknown_type" in layout:
        print(json.dumps({"unknown_type": layout["unknown_type"]}))
        return

    if add_to_db:
        config["types"][struct_name] = {
            "size": layout["total_size"],
            "align": layout["max_align"]
        }
        save_config(config)

    result = {
        "struct_name": struct_name,
        "fields": layout["fields"],
        "total_size": layout["total_size"],
        "max_align": layout["max_align"],
        "pack_value": pack_value
    }
    print(json.dumps(result, indent=None, separators=(',', ':')))

if __name__ == "__main__":
    main()