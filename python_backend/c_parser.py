# c_parser.py
import re

# Cache
struct_definitions = {}
app = None

def set_app_reference(application):
    global app
    app = application

def parse_pragma_pack(code):
    match = re.search(r'#pragma\s+pack\s*\(\s*(\d+)\s*\)', code)
    return int(match.group(1)) if match else None

def parse_structs(code):
    global struct_definitions
    struct_definitions.clear()

    # Step 1: Strip comments
    code_no_comment = re.sub(r'//.*', '', code)
    code_no_comment = re.sub(r'/\*.*?\*/', '', code_no_comment, flags=re.DOTALL)

    # Step 2: Format for GUI display
    lines = code_no_comment.split('\n')
    formatted_lines = []
    in_struct = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r'^\s*(typedef\s+)?struct\b', stripped):
            formatted_lines.append(stripped)
            in_struct = True
        elif stripped in ['{', '}', '};']:
            formatted_lines.append(stripped)
        elif in_struct:
            formatted_lines.append('  ' + stripped)
        else:
            formatted_lines.append(stripped)

    code_display = '\n'.join(formatted_lines)

    # Step 3: Normalize for parsing
    code_normalized = re.sub(r'\s+', ' ', code_no_comment).strip()

    # Step 4: Match structs
    found = False

    # Match: typedef struct { ... } Name;
    typedef_matches = re.findall(r'typedef\s+struct\s*\{([^}]*)\}\s*(\w+)\s*;', code_normalized, re.DOTALL)
    for body, name in typedef_matches:
        struct_definitions[name] = parse_fields(body)
        found = True

    # Match: struct Name { ... };
    struct_matches = re.findall(r'struct\s+(\w+)\s*\{([^}]*)\}\s*;', code_normalized, re.DOTALL)
    for name, body in struct_matches:
        struct_definitions[name] = parse_fields(body)
        found = True

    return code_display  # ✅ Return cleaned code for GUI

def parse_fields(field_block):
    fields = []
    code = re.sub(r'\s+', ' ', field_block.strip())
    if not code:
        return fields

    declarations = [d.strip() for d in code.split(';') if d.strip()]

    for decl in declarations:
        field_line = decl.strip()
        if not field_line:
            continue

        # Function Pointer
        if '(*' in field_line:
            ptr_start = field_line.find('(*')
            end_paren = field_line.find(')', ptr_start)
            if end_paren == -1:
                continue
            name_part = field_line[ptr_start+2:end_paren].strip()
            name_match = re.match(r'^(\w+)', name_part)
            if not name_match:
                continue
            name = name_match.group(1)
            fields.append({
                'name': name,
                'type': 'function_ptr',
                'is_pointer': True,
                'array_size': 1,
                'bit_size': None
            })
            continue

        # Check for bit-field
        bit_match = re.search(r':\s*(\d+)\s*$', field_line)
        bit_size = int(bit_match.group(1)) if bit_match else None

        # Parse multi-dimensional array size
        arr_size = 1
        temp_decl = field_line
        if bit_size is not None:
            temp_decl = field_line[:field_line.rfind(':')].strip()

        while '[' in temp_decl and ']' in temp_decl:
            start = temp_decl.find('[')
            end = temp_decl.find(']', start)
            if start == -1 or end == -1:
                break
            num_str = temp_decl[start+1:end].strip()
            if num_str.isdigit():
                arr_size *= int(num_str)
            temp_decl = temp_decl[end+1:]

        # Extract base type and name
        base_part = field_line
        if '[' in field_line:
            base_part = field_line[:field_line.find('[')]
        if bit_size is not None:
            base_part = base_part[:base_part.rfind(':')].strip()

        parts = base_part.strip().split()
        if not parts:
            continue

        potential_name = parts[-1]
        name = potential_name.rstrip('* ')
        if not re.match(r'^[a-zA-Z_]', name):
            continue

        base_type = ' '.join(parts[:-1])
        is_pointer = '*' in field_line
        clean_type = re.sub(r'\*', '', base_type).strip()

        fields.append({
            'name': name,
            'type': clean_type,
            'is_pointer': is_pointer,
            'array_size': arr_size,
            'bit_size': bit_size
        })

    return fields