"""
Local text utilities that reduce the number of tokens sent to the AI provider.

Nothing here calls an AI service: it is plain string processing, so it is free.
  * condense()          - strip whitespace / page-number noise, neutralise prompt breakouts
  * select_relevant()   - for long documents, keep only the passages relevant to a question
"""
import math
import os
import re
from collections import Counter
from typing import List

# Documents up to this size are sent whole to Q&A; longer ones are reduced to excerpts.
QNA_CONTEXT_CHARS = int(os.getenv("QNA_CONTEXT_CHARS", "8000"))
_CHUNK_TARGET = 900

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_PAGE_NOISE = re.compile(
    r"^(?:page\s+\d{1,4}(?:\s*(?:of|/)\s*\d{1,4})?|\d{1,4}\s*(?:of|/)\s*\d{1,4}|[-\u2013\u2014]\s*\d{1,4}\s*[-\u2013\u2014])$",
    re.IGNORECASE,
)
_WORD = re.compile(r"[a-z0-9$%]+")
_STOPWORDS = frozenset(
    """the and for are but not you all any can had her was one our out has have this that with
    from they will would there their what about which when who how does did been being into than then
    them these those your yours mine may might must shall should could per its is it be to of in on
    or as at by an if do so no we he she""".split()
)


def condense(text: str) -> str:
    """Return `text` with redundant whitespace and page-number lines removed.

    Also replaces triple double-quotes so user text cannot close the quoted
    block that prompts wrap documents in (basic prompt-injection hygiene).
    Idempotent: condense(condense(x)) == condense(x).
    """
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL_CHARS.sub("", text)
    text = text.replace('"""', "'''")
    lines = [ln.strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if not _PAGE_NOISE.match(ln)]
    text = "\n".join(lines)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ─── Excerpt selection (BM25-lite) ────────────────────────────────────────────

def _stem(word: str) -> str:
    # Crude prefix stem so "terminate"/"termination"/"terminated" all match.
    return word[:5] if len(word) > 5 else word


def _tokens(text: str) -> List[str]:
    return [_stem(w) for w in _WORD.findall(text.lower()) if len(w) > 2 and w not in _STOPWORDS]


def split_chunks(text: str, target: int = _CHUNK_TARGET) -> List[str]:
    """Split text into ~`target`-char chunks on paragraph, then sentence, boundaries."""
    pieces: List[str] = []
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        if not para:
            continue
        if len(para) <= target * 1.5:
            pieces.append(para)
            continue
        for sent in re.split(r"(?<=[.;:])\s+", para):
            while len(sent) > target * 1.5:  # pathological run-on text
                pieces.append(sent[:target])
                sent = sent[target:]
            if sent:
                pieces.append(sent)

    chunks: List[str] = []
    current = ""
    for piece in pieces:
        if current and len(current) + len(piece) + 2 > target:
            chunks.append(current)
            current = piece
        else:
            current = f"{current}\n\n{piece}" if current else piece
    if current:
        chunks.append(current)
    return chunks


def select_relevant(document: str, question: str, budget: int = QNA_CONTEXT_CHARS) -> str:
    """Return the parts of `document` most relevant to `question`, within `budget` chars.

    - Short documents are returned unchanged.
    - The first chunk (title / parties / date) is always kept for context.
    - Chosen chunks are emitted in original order so the text still reads naturally.
    - If nothing in the document overlaps the question, the whole document is
      returned (never guess: a wrong "not addressed" answer costs a re-ask).
    """
    if len(document) <= budget:
        return document

    chunks = split_chunks(document)
    if len(chunks) <= 1:
        return document[:budget]

    q_terms = set(_tokens(question))
    if not q_terms:
        return document

    chunk_tokens = [Counter(_tokens(c)) for c in chunks]
    n = len(chunks)
    avg_len = sum(sum(c.values()) for c in chunk_tokens) / n or 1.0
    df = {t: sum(1 for c in chunk_tokens if t in c) for t in q_terms}

    k1, b = 1.5, 0.75
    scores = []
    for counts in chunk_tokens:
        length = sum(counts.values()) or 1
        score = 0.0
        for term in q_terms:
            tf = counts.get(term, 0)
            if not tf:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * length / avg_len))
        scores.append(score)

    if max(scores) <= 0:
        return document

    chosen = {0}
    used = len(chunks[0])
    for idx in sorted(range(n), key=lambda i: scores[i], reverse=True):
        if scores[idx] <= 0 or idx in chosen:
            continue
        if used + len(chunks[idx]) > budget:
            continue
        chosen.add(idx)
        used += len(chunks[idx])

    return "\n\n[...]\n\n".join(chunks[i] for i in sorted(chosen))
