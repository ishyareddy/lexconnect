"""
Static grounding facts for Indian law.
These are injected into every prompt so TinyLlama cannot hallucinate
on common legal questions even when FAISS retrieval is weak.
"""

INDIAN_LAW_FACTS = """
INDIAN CONSTITUTION:
- Article 14: Right to Equality — equality before law for all persons.
- Article 15: Prohibition of discrimination on grounds of religion, race, caste, sex, or place of birth. The State shall not discriminate against any citizen on these grounds.
- Article 16: Equality of opportunity in public employment.
- Article 17: Abolition of Untouchability.
- Article 19: Freedom of speech, assembly, association, movement, profession.
- Article 21: Protection of life and personal liberty — no person shall be deprived of life or personal liberty except according to procedure established by law.
- Article 22: Protection against arbitrary arrest and detention.
- Article 32: Right to Constitutional Remedies — the right to move the Supreme Court for enforcement of fundamental rights.
- Article 50: Separation of judiciary from executive in public services of the State (Directive Principle).
- Article 226: High Courts have power to issue writs for enforcement of fundamental rights and other purposes.

WRITS (Article 32 / 226):
- Habeas Corpus: Produces a person before court to examine lawfulness of detention.
- Mandamus: Directs a public authority to perform a legal duty.
- Prohibition: Prevents a lower court from exceeding jurisdiction.
- Certiorari: Quashes an order of a lower court/tribunal acting without jurisdiction.
- Quo Warranto: Challenges a person's right to hold public office.

IPC (Indian Penal Code):
- Section 302: Punishment for murder — death or imprisonment for life.
- Section 304: Culpable homicide not amounting to murder.
- Section 307: Attempt to murder.
- Section 354: Assault or criminal force to woman with intent to outrage modesty.
- Section 376: Punishment for rape.
- Section 420: Cheating and dishonestly inducing delivery of property.
- Section 498A: Husband or relative of husband subjecting woman to cruelty.

FAMILY LAW / CUSTODY:
- Child custody in India is governed by the Guardians and Wards Act 1890 and personal laws (Hindu Minority and Guardianship Act 1956 for Hindus).
- The paramount consideration in custody matters is the welfare of the child.
- Courts may grant physical custody to one parent and visitation rights to the other.
- Mutual consent divorce under Section 13B Hindu Marriage Act requires 1 year of separation.
- Maintenance is governed by Section 125 CrPC (all religions) and personal laws.

PROPERTY LAW:
- Transfer of Property Act 1882 governs sale, mortgage, lease, gift of immovable property.
- Registration Act 1908: Documents of immovable property above Rs 100 must be registered.
- Adverse possession: 12 years of continuous, open, hostile possession can give title (Limitation Act).
- Encroachment on government land is a criminal offence under IPC.

CONSUMER LAW:
- Consumer Protection Act 2019 replaced the 1986 Act.
- District Commission handles complaints up to Rs 1 crore.
- State Commission handles Rs 1 crore to Rs 10 crore.
- National Commission handles above Rs 10 crore.
- Complaint must be filed within 2 years of cause of action.

CONTRACT LAW:
- Indian Contract Act 1872 governs all contracts.
- A valid contract requires offer, acceptance, consideration, free consent, lawful object.
- Breach of contract entitles the aggrieved party to damages (Section 73).
"""


def get_grounding() -> str:
    return INDIAN_LAW_FACTS.strip()