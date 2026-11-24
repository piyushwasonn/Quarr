"""Turn the QUARR research corpora (Google Docs exported as plain text) into
engine/framework/corpus.json.

    python3 scripts/corpus.py customer.txt founder.txt > engine/framework/corpus.json

Entries are delimited by "Duplicate key:" lines (Notion 90). Framework lenses are
assigned in engine/framework/lenses.ts from the raw lens labels kept here, so the
mapping lives in one place and is tested.
"""
import json, re, sys

FIELD = r"\n\s*(?:#{{1,4}}\s*)?{label}\s*:\s*"

def field(block, *labels, limit=700):
    for label in labels:
        m = re.search(FIELD.format(label=re.escape(label)) + r"(.*?)(?=\n\s*(?:#{1,4}\s*)?[A-Z][A-Za-z ,/()&-]{2,60}:\s|\Z)", "\n" + block, re.S)
        if m:
            text = re.sub(r"\s+", " ", m.group(1)).strip()
            if text:
                return clean(text)[:limit]
    return ""

def clean(s):
    s = s.replace("\\_", "_").replace("\\.", ".").replace("\\-", "-").replace("\\#", "#")
    s = re.sub(r"\s*[—]\s*", ", ", s)          # em dash: never reaches a founder
    s = re.sub(r"(\d)\s*–\s*(\d)", r"\1 to \2", s)
    return s.replace("–", "-").strip()

def questions(block):
    m = re.search(r"Questions QUARR should ask\s*:\s*(.*?)(?=\n\s*(?:#{1,4}\s*)?[A-Z][A-Za-z ,/()&-]{2,60}:\s|\Z)", block, re.S)
    if not m:
        return []
    raw = m.group(1)
    parts = re.split(r"\n\s*[•\-*]\s*|(?<=\?)\s+", raw)
    out = [clean(re.sub(r"\s+", " ", p)).strip(" •") for p in parts]
    return [q for q in out if q.endswith("?") and 12 < len(q) < 300][:6]

def title(block):
    lines = [l.strip() for l in block.split("\n") if l.strip()]
    for i, l in enumerate(lines):
        if re.match(r"(?:#{1,4}\s*)?(Date discovered|Platform and|Situation|Customer situation|Founder and business|Business situation)\b", l):
            for prev in reversed(lines[:i]):
                p = re.sub(r"^#{1,4}\s*", "", prev)
                p = re.sub(r"^\d+\\?\.\s*", "", p)
                if re.match(r"^(\d{1,2} \w+ 20\d\d|\w{3} \d{1,2}, 20\d\d)$", p) or p.endswith(":"):
                    continue
                p = re.sub(r"^(customer story|founder story|story)\s*\d*\s*[,:\u2014-]\s*", "", clean(p), flags=re.I)
                return p[:160]
            break
    return ""

def url(block):
    m = re.search(r"https?://[^\s)\]]+", block)
    return clean(m.group(0)).rstrip(".,") if m else ""

def level(block):
    m = re.search(r"Evidence strength(?: and confidence)?\s*:\s*(High|Medium-high|Medium|Low-medium|Low)", block, re.I)
    return m.group(1).capitalize() if m else "Unrated"

def parse(path, kind):
    text = open(path, encoding="utf8").read()
    keys = re.findall(r"Duplicate key:\s*([^\n]+)", text)
    blocks = re.split(r"(?:#{1,4}\s*)?Duplicate key:[^\n]*\n", text)
    out = []
    for block, key in zip(blocks, keys):
        t = title(block)
        if not t:
            continue
        e = {
            "key": clean(key.strip()).split(" | ")[0].strip(),
            "fingerprint": clean(key.strip()),
            "kind": kind,
            "title": t,
            "url": url(block[block.find("Platform"):] if "Platform" in block else block),
            "date": field(block, "Date discovered", limit=40),
            "lensLabels": field(block, "Relevant QUARR lens", limit=300),
            "questions": questions(block),
            "evidence": level(block),
        }
        if kind == "customer":
            e["gap"] = field(block, "Hidden business gap")
            e["complaint"] = field(block, "Visible complaint", "Visible customer complaint", limit=300)
        else:
            e["belief"] = field(block, "Founder belief or assumption", "Belief or assumption", limit=400)
            e["gap"] = field(block, "Missing customer understanding", "Missing understanding")
        out.append(e)
    return out

if __name__ == "__main__":
    customer, founder = sys.argv[1:3]
    stories = parse(customer, "customer") + parse(founder, "founder")
    seen = set()
    unique = [s for s in stories if not (s["fingerprint"] in seen or seen.add(s["fingerprint"]))]
    json.dump({"source": "Notion 90, Research & Asset Index (Drive corpora)", "stories": unique}, sys.stdout, ensure_ascii=False, indent=1)
