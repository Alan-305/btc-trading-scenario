EVENT_JA: dict[str, str] = {
    "fomc": "FOMC 政策金利発表",
    "cpi": "米CPI",
    "consumer price index": "米CPI",
    "nonfarm": "米雇用統計",
    "non-farm": "米雇用統計",
    "payroll": "米雇用統計",
    "gdp": "米GDP",
    "ppi": "米PPI",
    "retail sales": "米小売売上",
    "ism manufacturing": "米ISM製造業",
    "ism services": "米ISMサービス業",
    "initial jobless": "米新規失業保険申請",
    "fed chair": "FRB議長発言",
}


def event_name_ja(name: str) -> str | None:
    lower = name.lower()
    for key, ja in EVENT_JA.items():
        if key in lower:
            return ja
    return None
