# v1.5.4 — Desktop manual verification

**Release:** v1.5.4 (One Mark)  
**Tester:** _____________ **Date:** _____________

---

## BRAND — Icon parity

| ID | Step | Pass |
|----|------|------|
| B1 | Windows: shortcut + taskbar still **Obscur** arcs (regression — already correct on 1.5.3) | ☐ |
| B2 | Android: Release APK launcher icon = same Obscur mark (not Tauri swirl) | ☐ |
| B3 | macOS `.dmg` / Linux `.AppImage` icon spot-check on GitHub Release | ☐ |

---

## P1 — Regression (from v1.5.3)

| ID | Step | Pass |
|----|------|------|
| P1 | Vault opens on medium account without multi-second empty skeleton | ☐ |
| P2 | Sidebar route switch after warmup feels immediate | ☐ |
| P3 | Hide on device / show again still works on a DM thread | ☐ |

---

## Notes

_Signing: unsigned installer may show SmartScreen — expected until Authenticode configured._
