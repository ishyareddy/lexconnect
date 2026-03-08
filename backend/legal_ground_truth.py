"""
Grounding facts for Indian law — act names only, no section numbers.
Goal: help the 3B model name the RIGHT law, not hallucinate section numbers.
"""

_ALWAYS = """
CONSTITUTIONAL RIGHTS (India):
- Every person has a right to equality, life, liberty, and constitutional remedies.
- The Supreme Court (Article 32) and High Courts (Article 226) can issue writs to enforce rights.
- Writs: Habeas Corpus (unlawful detention), Mandamus (compel authority to act), Certiorari (quash lower court order), Prohibition (stop lower court exceeding jurisdiction), Quo Warranto (challenge public office).
"""

_SECTIONS = {
    "tenancy": """
TENANCY LAW (India):
- The correct law for tenant eviction disputes is the state Rent Control Act (e.g. Tamil Nadu Buildings Lease and Rent Control Act for Chennai, Delhi Rent Control Act for Delhi, Maharashtra Rent Control Act for Mumbai). NOT the Specific Relief Act.
- A landlord cannot evict a tenant without a court order — not even after the agreement expires.
- A 7-day eviction notice is NOT valid for a long-term tenant. Minimum notice under the Transfer of Property Act is 15 days for residential tenants.
- Cutting electricity or water to force a tenant out is illegal. It is criminal intimidation under the Indian Penal Code.
- The correct court for eviction disputes is the Rent Controller court (also called Rent Control Court) in the district where the property is located — NOT a civil court, NOT under the Specific Relief Act.
- The Rent Controller can issue a stay order immediately stopping the eviction.
- Tenant should also file a police complaint for the illegal electricity cutoff under the Indian Penal Code.
- A registered rent agreement is strong proof of the tenancy terms and the agreed rental period.
""",
    "cheque": """
CHEQUE BOUNCE LAW (India):
- Governed by the Negotiable Instruments Act 1881.
- Bouncing a cheque for a legal debt is a criminal offence.
- Steps: Send a written demand notice to the drawer within 30 days of the bounce. If they do not pay within 15 days, file a complaint in the Magistrate Court within the next 30 days.
- Documents needed: original cheque, bank return memo, demand notice, proof of delivery.
""",
    "family": """
FAMILY / DOMESTIC VIOLENCE LAW (India):
- DOMESTIC VIOLENCE: The Protection of Women from Domestic Violence Act 2005 is the primary law for women facing physical, verbal, mental, or economic abuse by husband or his family.
- Under the Domestic Violence Act 2005, a woman can get: (1) Protection Order — stops the abuser from contacting or harming her; (2) Residence Order — gives her the right to stay in the matrimonial home even if she does not own it; (3) Monetary Relief — compensation for losses caused by the violence; (4) Custody Order — temporary custody of children.
- Being thrown out of the matrimonial home and having locks changed is a violation of the Domestic Violence Act 2005. The woman can get a Residence Order from the Magistrate to return to the home immediately.
- File a complaint with the local Magistrate Court or a Protection Officer (available in every district) under the Domestic Violence Act 2005. No police FIR is required to start this process.
- IPC Section 498A: Cruelty by husband or his relatives — can be filed as an FIR with police alongside the DV case.
- DIVORCE: For Hindus, governed by the Hindu Marriage Act 1955. Grounds include cruelty (mental or physical), desertion, adultery.
- MAINTENANCE: A wife and children can claim maintenance under the Hindu Marriage Act and the Criminal Procedure Code (applies to all religions). This can be claimed even before the divorce is finalised.
- CHILD CUSTODY: Decided based on the welfare of the child under the Guardians and Wards Act 1890.
""",
    "property": """
PROPERTY / INHERITANCE LAW (India):
- Property disputes are governed by the Transfer of Property Act 1882.
- Sale deeds must be registered under the Registration Act 1908.
- Inheritance for Hindus is governed by the Hindu Succession Act 1956 (amended 2005) — daughters have equal rights to ancestral property as sons.
- A co-owner can file a partition suit in civil court to divide jointly held property.
- A Will (registered or with two witnesses) is valid evidence of a person's inheritance wishes.
""",
    "consumer": """
CONSUMER LAW (India):
- Governed by the Consumer Protection Act 2019.
- File a complaint for defective goods, poor service, unfair trade practices, or misleading advertisements.
- File at the District Consumer Commission (for most cases), State Commission, or National Commission.
- Complaint must be filed within 2 years of the problem.
- Remedies: refund, replacement, and compensation.
""",
    "contract": """
CONTRACT LAW (India):
- Governed by the Indian Contract Act 1872.
- A valid contract needs: offer, acceptance, consideration, free consent, and a lawful purpose.
- If a contract is breached, the party can sue for damages or ask the court to enforce the contract under the Specific Relief Act 1963.
""",
}

_TOPIC_KEYWORDS = {
    "tenancy":  ["rent", "tenant", "landlord", "evict", "eviction", "lease", "flat", "electricity", "accommodation"],
    "cheque":   ["cheque", "check", "bounce", "dishonour", "dishonor", "negotiable"],
    "family":   ["divorce", "marriage", "maintenance", "alimony", "custody", "wife", "husband",
                 "matrimonial", "domestic", "cruelty", "separation", "son", "daughter", "child",
                 "abuse", "violent", "violence", "thrown", "evicted from home", "lock", "beaten",
                 "assault", "harassment", "dowry", "498"],
    "property": ["property", "land", "plot", "inheritance", "will", "succession", "partition",
                 "ancestral", "encroachment", "deed", "registration", "brother", "sister"],
    "consumer": ["consumer", "defective", "refund", "product", "service", "complaint", "seller"],
    "contract": ["contract", "agreement", "breach", "payment", "advance", "construction"],
}


def get_grounding() -> str:
    all_sections = _ALWAYS
    for s in _SECTIONS.values():
        all_sections += s
    return all_sections.strip()


def get_focused_grounding(question: str, case_ctx: str = "") -> str:
    combined = (question + " " + case_ctx).lower()
    selected = [t for t, kws in _TOPIC_KEYWORDS.items() if any(kw in combined for kw in kws)]
    if not selected:
        return get_grounding()
    result = _ALWAYS
    for topic in selected:
        result += _SECTIONS.get(topic, "")
    return result.strip()