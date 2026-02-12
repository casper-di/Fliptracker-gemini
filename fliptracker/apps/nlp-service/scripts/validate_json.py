import sys, json
if len(sys.argv) != 2:
    print("Usage: validate_json.py <file>")
    sys.exit(2)
try:
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        json.load(f)
    sys.exit(0)
except Exception as e:
    print("JSON_INVALID", e)
    sys.exit(1)
