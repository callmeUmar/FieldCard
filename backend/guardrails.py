"""Deterministic safety checks for /ai/audit. Pure code, no AI.

check(text, has_image) runs BEFORE any model call and returns a refusal or None.
redact(text) runs on EVERY response.
is_purchase(text) decides whether a message goes to the purchasing agent.
"""
import os
import re

REFUSAL = "I can't help with that"

SELF_HARM_REPLY = (
    f"{REFUSAL}, but I'm really sorry you're going through this, and you don't have to face it alone. "
    "If you're in the US, please call or text 988 to reach the 988 Suicide & Crisis Lifeline. "
    "It's free, confidential and available 24/7. If you're in immediate danger, call 911."
)


def _any(*patterns: str) -> re.Pattern:
    return re.compile("|".join(f"(?:{p})" for p in patterns), re.IGNORECASE)


SELF_HARM = _any(
    r"\b(harm|hurt|kill|injure|cut|poison)\s+(myself|me)\b",
    r"\bsuicid", r"\bself[- ]?harm", r"\bend(ing)? (my|it all|my own) li(fe|ves)\b",
    r"\b(want|wanna) to die\b", r"\bdon'?t want to (live|be alive)\b", r"\boverdose\b",
)
WEAPONS_VIOLENCE_CRIME = _any(
    # explosives and weapons
    r"\bexplosives?\b", r"\bbombs?\b", r"\bdetonat", r"\bgrenades?\b", r"\bIEDs?\b", r"\bnapalm\b",
    r"\bthermite\b", r"\bmolotov\b", r"\bC-?4\b", r"\bfirearms?\b", r"\bghost guns?\b", r"\bsilencers?\b",
    r"\b(build|make|print|assemble|buy)\b.{0,30}\b(gun|rifle|pistol|weapon)s?\b", r"\bweapons?\b",
    # violence
    r"\b(kill|murder|stab|shoot|strangle|poison|attack|hurt|harm)\b.{0,20}\b(someone|somebody|a person|people|him|her|them|my \w+)\b",
    r"\bmurder\b", r"\bmass shooting\b",
    # illegal activity
    r"\b(launder(ing)?|money laundering)\b", r"\b(make|cook|synthesi[sz]e)\b.{0,20}\b(meth|cocaine|heroin|fentanyl|drugs)\b",
    r"\bcounterfeit", r"\bshoplift", r"\bfake (id|passport|license)\b", r"\b(steal|rob)\b.{0,30}\b(car|money|bank|store|identity|from)\b",
    r"\bcredit card fraud\b", r"\bidentity theft\b",
    # hacking
    r"\bhack(ing|er|s)?\b", r"\bphishing\b", r"\bmalware\b", r"\bransomware\b", r"\bkeylogger\b",
    r"\bsql injection\b", r"\bddos\b", r"\b(crack|steal|brute[- ]?force)\b.{0,20}\bpasswords?\b",
    r"\bbreak into\b.{0,30}\b(account|system|network|server|computer|email)\b", r"\bbypass\b.{0,20}\b(auth|login|2fa|security)",
)
SENSITIVE_NUMBER = _any(r"\b\d{3}-\d{2}-\d{4}\b", r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
SENSITIVE_WORDS = _any(
    r"\bssn\b", r"\bsocial security\b", r"\bcard numbers?\b", r"\bcredit card\b", r"\bcvv\b",
    r"\bpassport (number|no)\b", r"\bdriver'?s licen[cs]e (number|no)\b", r"\bid numbers?\b", r"\btax id\b",
)
REPEAT_VERBS = _any(r"\b(repeat|confirm|read (it )?back|say (it )?back|echo|store|remember|recite|tell me (my|what))\b")
SECRETS_JAILBREAK = _any(
    r"\bsystem prompt\b", r"\b(hidden|initial|original|secret|internal) (prompt|instructions)\b",
    r"\b(reveal|print|show|repeat|output|dump|tell me)\b.{0,30}\b(your )?(instructions|rules|prompt)\b",
    r"\bapi[ _-]?keys?\b", r"\bpasswords?\b", r"\b(access |auth |bearer )?tokens?\b", r"\bsecret keys?\b",
    r"\bcredentials\b", r"\benv(ironment)? var", r"\.env\b", r"\bprivate data\b",
    r"\bdeveloper mode\b", r"\bdan mode\b", r"\bjailbreak", r"\bno restrictions\b", r"\bunrestricted mode\b",
    r"\b(ignore|disregard|forget)\b.{0,20}\b(all|any|previous|prior|above|earlier|your)\b.{0,20}\b(instructions|prompts?|directives)\b",
)
LIST_CONTACTS = _any(
    r"\b(list|print|show|dump|give|reveal|share|tell|output|extract|send)\b.{0,60}\b(e-?mails?|e-?mail address(es)?|phone numbers?|contact (info|details))\b",
)
IDENTIFY_PERSON = _any(
    r"\b(identify|recogni[sz]e|name)\b.{0,60}\b(person|people|man|woman|face|him|her|individual|who)\b",
    r"\bwho is (this|that|in|the person)\b", r"\breal[- ]world identity\b", r"\bidentity of\b",
)
ID_DOCUMENT = _any(
    r"\b(extract|repeat|read|list|transcribe|copy|give|tell|output|print)\b.{0,60}\b(id numbers?|identification numbers?|personal (details?|info(rmation)?|data)|date of birth|passport|licen[cs]e number)\b",
)
FAKE_FACTS = _any(
    r"\b(invent|make up|fabricate|fake|made[- ]up)\b.{0,60}\b(as|like it'?s|that it'?s|presented as|present(ed)? it)\b.{0,30}\b(real|true|fact|factual|genuine)",
    r"\b(invent|make up|fabricate)\b.{0,60}\b(confidently|convincing(ly)?)\b",
)
PURCHASE = _any(
    r"\b(buy|purchase|card|pay|spend|order|materials?|store|ferguson|home depot|ace hardware|job|budget|receipt)\b",
    r"\b(fittings?|pipe|pex|copper|valves?|solder|flux|elbows?|approval|approve|limit|owner|henderson|ortega|chen)\b",
    r"\$\s?\d",
)


def check(text: str, has_image: bool = False) -> str | None:
    """Returns a refusal (starting with "I can't help with that") or None."""
    t = text or ""
    if SELF_HARM.search(t):
        return SELF_HARM_REPLY
    if WEAPONS_VIOLENCE_CRIME.search(t):
        return f"{REFUSAL}. I won't give instructions for weapons, explosives, violence, hacking or other illegal activity."
    if ID_DOCUMENT.search(t):
        return f"{REFUSAL}. I won't extract ID numbers or personal details from identity documents."
    if SENSITIVE_NUMBER.search(t) or (SENSITIVE_WORDS.search(t) and REPEAT_VERBS.search(t)):
        return (
            f"{REFUSAL}. I don't repeat, confirm or store Social Security numbers, card numbers or other ID numbers. "
            "Please don't share them in chat."
        )
    if has_image and IDENTIFY_PERSON.search(t):
        return f"{REFUSAL}. I don't identify real people from photos. I can describe what's in the image instead."
    if LIST_CONTACTS.search(t):
        return f"{REFUSAL}. I don't share email addresses, phone numbers or other contact details."
    if SECRETS_JAILBREAK.search(t):
        return (
            f"{REFUSAL}. I can't reveal my instructions, keys, passwords, tokens or private data, "
            "and I don't have a mode without rules."
        )
    if FAKE_FACTS.search(t):
        return (
            f"{REFUSAL}. I won't present invented facts as real. "
            "I can write something clearly labeled as fiction if you'd like."
        )
    return None


def is_purchase(text: str) -> bool:
    return bool(PURCHASE.search(text or ""))


# ---------- output filter

_REDACTIONS = [
    (re.compile(r"\b(mongodb(\+srv)?|postgres(ql)?)://\S+"), "[redacted connection string]"),
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[redacted SSN]"),
    (re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)"), "[redacted card number]"),
    (re.compile(r"\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b"), "[redacted email]"),
    (re.compile(r"(?<![\w$.])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}(?![\w.])"), "[redacted phone]"),
    (re.compile(r"(?<![\w$.])\+?1?\d{10}(?![\w.])"), "[redacted phone]"),
    (re.compile(r"\b(AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9-]{10,})\b"), "[redacted key]"),
    (re.compile(r"\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b"), "[redacted key]"),
]
_SECRET_VARS = (
    "GEMINI_API_KEY", "MONGODB_URI", "PHOTON_API_KEY", "PERCEPTRON_API_KEY", "BACKBOARD_API_KEY", "TIGER_DATABASE_URL",
)


def redact(text: str) -> str:
    text = text or ""
    for var in _SECRET_VARS:
        value = os.getenv(var)
        if value and len(value) >= 8:
            text = text.replace(value, "[redacted key]")
    for pattern, replacement in _REDACTIONS:
        text = pattern.sub(replacement, text)
    return text
