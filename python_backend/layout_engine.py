# layout_engine.py
from c_parser import struct_definitions

def get_type_info(base_type, config, type_db):
    if base_type in type_db:
        return {
            "size": type_db[base_type]["size"],
            "align": type_db[base_type]["align"]
        }
    elif base_type in struct_definitions:
        layout = compute_layout(base_type, config, type_db, pack=None)
        if layout and 'total_size' in layout:
            return {"size": layout["total_size"], "align": layout["max_align"]}
    elif base_type == 'function_ptr':
        return {
            "size": type_db["T*"]["size"],
            "align": type_db["T*"]["align"]
        }
    return None  # ← Type not found

# In layout_engine.py, replace compute_layout with:
def compute_layout(struct_name, config, type_db, pack=None):
    fields = struct_definitions.get(struct_name)
    if not fields:
        return None

    current_offset = 0
    layout = []
    max_align = 1
    i = 0
    n = len(fields)

    while i < n:
        field = fields[i]
        base_type = field['type']

        # Handle bit-field run
        if field.get('bit_size') is not None:
            # Start of a bit-field run
            run_type = base_type
            run_size_info = get_type_info(run_type, config, type_db)
            if run_size_info is None:
                return {"unknown_type": run_type}

            storage_size = run_size_info['size']
            storage_align = run_size_info['align']
            max_align = max(max_align, storage_align)

            effective_align = min(storage_align, pack) if pack else storage_align
            padding = (-current_offset) % effective_align
            aligned_offset = current_offset + padding

            # Collect all consecutive bit-fields of same type
            run_fields = []
            bits_used = 0
            j = i
            while j < n:
                f = fields[j]
                if f.get('bit_size') is None or f['type'] != run_type:
                    break
                if bits_used + f['bit_size'] > storage_size * 8:
                    break  # doesn't fit in current unit
                run_fields.append(f)
                bits_used += f['bit_size']
                j += 1

            # Add one layout entry for the whole storage unit
            layout.append({
                'name': ', '.join(f['name'] for f in run_fields),
                'offset': aligned_offset,
                'size': storage_size,
                'padding_before': padding,
                'type': run_type,
                'is_array': False,
                'count': 1,
                'is_pointer': False,
                'bit_fields': [  # metadata for visualization
                    {'name': f['name'], 'bits': f['bit_size']} for f in run_fields
                ]
            })

            current_offset = aligned_offset + storage_size
            i = j  # skip processed bit-fields

        else:
            # Regular field (non-bit-field)
            info = get_type_info(base_type, config, type_db)
            if info is None:
                return {"unknown_type": base_type}

            natural_align = info['align']
            unit_size = info['size']
            if field['is_pointer'] and base_type != 'function_ptr':
                unit_size = type_db["T*"]["size"]
                natural_align = type_db["T*"]["align"]

            field_size = unit_size * field['array_size']
            effective_align = min(natural_align, pack) if pack else natural_align

            padding = (-current_offset) % effective_align
            aligned_offset = current_offset + padding

            layout.append({
                'name': field['name'],
                'offset': aligned_offset,
                'size': field_size,
                'padding_before': padding,
                'type': base_type,
                'is_array': field['array_size'] > 1,
                'count': field['array_size'],
                'is_pointer': field['is_pointer'],
                'bit_fields': None
            })

            current_offset = aligned_offset + field_size
            max_align = max(max_align, natural_align)
            i += 1

    if pack:
        total_size = current_offset
    else:
        total_size = ((current_offset + max_align - 1) // max_align) * max_align

    return {
        'fields': layout,
        'total_size': total_size,
        'max_align': max_align
    }