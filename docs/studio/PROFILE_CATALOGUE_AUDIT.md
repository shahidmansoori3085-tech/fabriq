# Profile catalogue audit

Catalogue data = **manufacturer-supplied** (code, size, kg, drawing). It is
never a cutting rule. Every profile row in the Studio carries its source.

## What a catalogue gives us vs what it does not

| Gives | Does not give |
|---|---|
| die code, name | which part of the window it becomes at a given shop |
| outer size (W × H mm), wall thickness | frame / shutter / glass deductions |
| kg per metre or per 12'/15'/16' (a *weight reference length*, not the bar sold) | the stock bar length the dealer actually sells |
| cross-section drawing | track compatibility, interlock overlap, rubber allowance |

## Per-catalogue status

| Catalogue | Pages seen | Trust | Notes |
|---|---|---|---|
| OMEO / Altech | all 158 | high | basis of the current section master (doc 08) |
| Ample 22 mm | 2/2 | high for sizes | the code 41085 is printed on two different profiles: a 65×22 interlock and a 30.9×26.2 cap. Ask the dealer which is which |
| Banu Hashim | p.58–61 | high for those pages | 31 mm BH-6406/07/08 match |
| Ample 25–50, domal, Z; Eleanor; Alucoat | index only | unverified | sizes in doc 18 are probably copied right but are unchecked |
| Doc 18 tables | — | sizes: unchecked; cutting: rejected | — |

## Rules the Studio follows
1. A profile entered by a fabricator is **the shop's truth** for that shop only.
   It is not added to a shared library unless they choose to share it.
2. Series name is a label. Compatibility comes from the part's role in a system
   that worked on a real job.
3. Stock length is per profile and per shop (12', 15', 16', 20', anything). The
   default is 16' because current behaviour must stay the same.
4. Weight: store kg plus its reference length, exactly as printed. Never divide by
   the bar length.
5. An image or PDF read by AI only *suggests* sizes. The fabricator confirms them.
