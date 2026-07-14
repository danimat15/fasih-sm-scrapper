with open("research/get_data_mikro/portal_debug.html", "r", encoding="utf-8") as f:
    html = f.read()

print(f"HTML Length: {len(html)}")
search_term = "PROVINSI"
print(f"Contains '{search_term}': {search_term in html}")
print(f"Contains '{search_term.lower()}': {search_term.lower() in html}")

# Print around first occurrence of "PROVINSI" case-insensitive
search_term = "content-wrapper"
print(f"Contains '{search_term}': {search_term in html}")

idx = html.lower().find(search_term.lower())
if idx != -1:
    print(f"Found occurrence of content-wrapper at index {idx}:")
    print(html[idx + 1000:idx + 3500])
else:
    print("content-wrapper not found in the HTML.")
    
# Check for "Filter"
idx_filter = html.lower().find("filter")
if idx_filter != -1:
    print(f"Found 'filter' at index {idx_filter}:")
    print(html[max(0, idx_filter - 100):min(len(html), idx_filter + 200)])
