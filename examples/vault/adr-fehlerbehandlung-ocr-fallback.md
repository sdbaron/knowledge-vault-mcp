---
title: "ADR: Fehlerbehandlung OCR Fallback"
tags:
  - architecture
  - adr
domain: "architecture"
owner: "team-ocr"
updated_at: "2026-05-05"
aliases:
  - "ADR OCR Fallback"
---

# Kontext

Fallback-OCR wird nur fuer kritische Felder ausgefuehrt, um Kosten und Laufzeit zu steuern.

# Entscheidung

Fehler in merged OCR werden zuerst durch Checker-Regeln behandelt; nur bei Bedarf folgt single-crop OCR.

# Konsequenzen

Mehr Stabilitaet bei kontrollierter API-Nutzung, dafuer zusaetzliche Pipeline-Logik.

# Verweise

- [[Prozess: Incident Bearbeitung]]
- [[Betriebsanleitung OCR Pipeline]]
