import json
import os
import sys

def execute_notebook(notebook_path):
    print(f"Reading notebook: {notebook_path}")
    os.makedirs("8Juli2026", exist_ok=True)
    with open(notebook_path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    code_blocks = []
    for cell in nb.get('cells', []):
        if cell.get('cell_type') == 'code':
            source = "".join(cell.get('source', []))
            cleaned_source = []
            for line in source.split('\n'):
                if not line.strip().startswith('%') and not line.strip().startswith('!'):
                    cleaned_source.append(line)
            code_blocks.append("\n".join(cleaned_source))
            
    print("Executing code extracted from notebook...")
    full_code = "\n".join(code_blocks)
    
    # Execute in a new global dictionary to avoid conflicts
    global_dict = {
        '__builtins__': __builtins__,
        '__name__': '__main__',
        '__file__': notebook_path
    }
    exec(full_code, global_dict)
    print("Notebook executed successfully!")

if __name__ == '__main__':
    execute_notebook('pengecekan_sls.ipynb')
