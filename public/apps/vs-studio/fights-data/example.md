# Fight JSON — Template

Szablon dla pliku `[Nazwa Walki] PL.json` / `EN.json`.  
Wszystkie wartości w `(nawiasach)` opisują co należy wpisać.

---

```json
{
  "schemaVersion": 1,
  "locale": "(język: 'pl' lub 'en')",
  "templateOrder": [
    "tactical-board",
    "character-dossier-a",
    "character-dossier-b",
    "character-profile",
    "crucial-feats",
    "victory-archive",
    "fight-analytics",
    "parameter-comparison",
    "x-factor",
    "final-summary",
    "battle-dynamics",
    "fight-simulation",
    "verdict-matrix",
    "fight-card"
  ],
  "templateData": {

    "tactical-board": {
      "subtitle": "(Krótki podtytuł walki — np. 'Bohater kontra Tyran', 'Wielki Regent vs Król Demonów')"
    },

    "character-dossier-a": {
      "world": "(Nazwa uniwersum/wersji postaci A — np. 'New52', 'Invincible (Image Comics)')",
      "quote": "(Charakterystyczny cytat postaci A)",
      "style": "(Opis stylu walki postaci A — jak podchodzi do starcia, co ją definiuje w walce. 1-2 zdania.)",
      "advantage": "(Kluczowa przewaga postaci A nad większością przeciwników. 1 zdanie.)",
      "mentality": "(Mentalność bojowa postaci A — jak myśli w walce, co ją napędza lub ogranicza. 1-2 zdania.)"
    },

    "character-dossier-b": {
      "world": "(Nazwa uniwersum/wersji postaci B)",
      "quote": "(Charakterystyczny cytat postaci B)",
      "style": "(Opis stylu walki postaci B. 1-2 zdania.)",
      "advantage": "(Kluczowa przewaga postaci B. 1 zdanie.)",
      "mentality": "(Mentalność bojowa postaci B. 1-2 zdania.)"
    },

    "character-profile": {
      "a": {
        "powers": [
          "(Główne moce/zdolności postaci A — krótko, 1 zdanie)"
        ],
        "tools": [
          "(Pierwsze kluczowe narzędzie/technika postaci A)",
          "(Drugie kluczowe narzędzie/technika postaci A)"
        ],
        "weaknesses": [
          "(Pierwsza słabość postaci A)",
          "(Druga słabość postaci A)"
        ]
      },
      "b": {
        "powers": [
          "(Główne moce/zdolności postaci B — krótko, 1 zdanie)"
        ],
        "tools": [
          "(Pierwsze kluczowe narzędzie/technika postaci B)",
          "(Drugie kluczowe narzędzie/technika postaci B)"
        ],
        "weaknesses": [
          "(Pierwsza słabość postaci B)",
          "(Druga słabość postaci B)"
        ]
      }
    },

    "crucial-feats": {
      "a": [
        "(Feat 1 postaci A)",
        "(Feat 2 postaci A)",
        "(Feat 3 postaci A)",
        "(Feat 4 postaci A)",
        "(Feat 5 postaci A)"
      ],
      "b": [
        "(Feat 1 postaci B)",
        "(Feat 2 postaci B)",
        "(Feat 3 postaci B)",
        "(Feat 4 postaci B)",
        "(Feat 5 postaci B)"
      ]
    },

    "victory-archive": {
      "a": [
        "(Nazwa pokonanego przeciwnika 1)",
        "(Nazwa pokonanego przeciwnika 2)",
        "(Nazwa pokonanego przeciwnika 3)",
        "(Nazwa pokonanego przeciwnika 4)",
        "(Nazwa pokonanego przeciwnika 5)"
      ],
      "b": [
        "(Nazwa pokonanego przeciwnika 1)",
        "(Nazwa pokonanego przeciwnika 2)",
        "(Nazwa pokonanego przeciwnika 3)",
        "(Nazwa pokonanego przeciwnika 4)",
        "(Nazwa pokonanego przeciwnika 5)"
      ]
    },

    "fight-analytics": {
      "a": {
        "battleIq":   (0-100: jak inteligentnie postać A wykorzystuje zdolności W SAMEJ WALCE),
        "durability": (0-100: ile obrażeń od przeciwników jest w stanie przyjąć),
        "experience": (0-100: ile lat/walk ma za sobą, jak szeroka jest jej historia bojowa),
        "hax":        (0-100: jak bardzo specjalne/unikalne są jej zdolności — rzeczy których nie da się 'po prostu' zniwelować siłą),
        "skills":     (0-100: szerokość arsenału bojowego — specjalne ataki, zdolności, techniki; Kamehameha, lasery z oczu, rozciągane kończyny itp.),
        "speed":      (0-100: prędkość W WALCE — reakcja, ruch bojowy, nie podróż kosmiczna),
        "stamina":    (0-100: kondycja — czy się męczy, czy potrzebuje przerw/naładowania ataków),
        "strength":   (0-100: siła fizyczna — oceniana przez featy wobec równorzędnych lub skalowanie),
        "style":      (0-100: jak świadomie zbudowany i dopracowany jest styl walki — lata nauki vs instynkt)
      },
      "b": {
        "battleIq":   (0-100),
        "durability": (0-100),
        "experience": (0-100),
        "hax":        (0-100),
        "skills":     (0-100),
        "speed":      (0-100),
        "stamina":    (0-100),
        "strength":   (0-100),
        "style":      (0-100)
      }
    },

    "parameter-comparison": {
      "a": {
        "battleIq":   (identyczne wartości co fight-analytics — a.battleIq),
        "durability": (identyczne wartości co fight-analytics — a.durability),
        "experience": (identyczne wartości co fight-analytics — a.experience),
        "hax":        (identyczne wartości co fight-analytics — a.hax),
        "skills":     (identyczne wartości co fight-analytics — a.skills),
        "speed":      (identyczne wartości co fight-analytics — a.speed),
        "stamina":    (identyczne wartości co fight-analytics — a.stamina),
        "strength":   (identyczne wartości co fight-analytics — a.strength),
        "style":      (identyczne wartości co fight-analytics — a.style)
      },
      "b": {
        "battleIq":   (identyczne wartości co fight-analytics — b.battleIq),
        "durability": (identyczne wartości co fight-analytics — b.durability),
        "experience": (identyczne wartości co fight-analytics — b.experience),
        "hax":        (identyczne wartości co fight-analytics — b.hax),
        "skills":     (identyczne wartości co fight-analytics — b.skills),
        "speed":      (identyczne wartości co fight-analytics — b.speed),
        "stamina":    (identyczne wartości co fight-analytics — b.stamina),
        "strength":   (identyczne wartości co fight-analytics — b.strength),
        "style":      (identyczne wartości co fight-analytics — b.style)
      }
    },

    "x-factor": {
      "a_bonus": "(liczba jako string — dodatkowe punkty dla postaci A w x-factor, np. '10')",
      "a_bonus_label": "(etykieta przewagi A — 1-2 słowa caps, np. 'KONTROLA', 'WYTRWAŁOŚĆ')",
      "a_value": "(bazowa wartość postaci A w x-factor — zazwyczaj '50')",
      "b_bonus": "(dodatkowe punkty dla postaci B, np. '20')",
      "b_value": "(bazowa wartość postaci B — zazwyczaj '50')",
      "factor": "(Pytanie otwierające x-factor — co jest kluczową zmienną tej walki?)",
      "implikacja": "(Co oznacza ta zmienna w praktyce dla przebiegu walki? 2-3 zdania.)",
      "mechanika": "(Jak mechanicznie działa ta przewaga/słabość w walce? 2-3 zdania.)",
      "psychologia": "(Jak ta zmienna wpływa na psychologię walki obu postaci? 2-3 zdania.)",
      "regen": "(Krótka etykieta caps opisująca kluczową właściwość — np. 'BRAK ZASAD', 'DEMON NAMECZAŃSKI')"
    },

    "final-summary": {
      "line_1": "(Pierwsze zdanie podsumowania — kto ma przewagę i dlaczego, ogólnie)",
      "line_2": "(Drugie zdanie — co konkretnie daje tę przewagę lub co ją komplikuje)",
      "line_3": "(Trzecie zdanie — kluczowy warunek rozstrzygnięcia lub paradoks walki)",
      "winner": "(Zdanie-werdykt — kto wygrywa i z jakim zastrzeżeniem, np. 'X ma przewagę. Y wciąż ma realną drogę do zwycięstwa.')"
    },

    "battle-dynamics": {

      "label": "(Nazwa scenariusza 1 — np. 'Standardowe zasady · Nazwa zmiennej')",
      "a_curve": "(5 liczb po przecinku — krzywa mocy postaci A przez 5 faz, np. '91,92,94,96,98')",
      "b_curve": "(5 liczb po przecinku — krzywa mocy postaci B przez 5 faz, np. '86,84,80,75,70')",
      "yellow_wave": "(8 liczb po przecinku — wartości żółtej fali tła, np. '31,34,32,36,33,37,35,39')",
      "phase_1": "(Opis fazy 1 scenariusza 1 — co się dzieje na początku walki)",
      "phase_2": "(Opis fazy 2 scenariusza 1 — środek walki, punkt zwrotny)",
      "phase_3": "(Opis fazy 3 scenariusza 1 — końcówka walki, rozstrzygnięcie)",
      "analysis": "(Jednozdaniowa analiza scenariusza 1 — kto wygrywa i dlaczego)",

      "s2_label": "(Nazwa scenariusza 2)",
      "s2_a_curve": "(5 liczb — krzywa postaci A w scenariuszu 2)",
      "s2_b_curve": "(5 liczb — krzywa postaci B w scenariuszu 2)",
      "s2_phase_1": "(Opis fazy 1 scenariusza 2)",
      "s2_phase_2": "(Opis fazy 2 scenariusza 2)",
      "s2_phase_3": "(Opis fazy 3 scenariusza 2)",
      "s2_analysis": "(Analiza scenariusza 2)",

      "s3_label": "(Nazwa scenariusza 3)",
      "s3_a_curve": "(5 liczb — krzywa postaci A w scenariuszu 3)",
      "s3_b_curve": "(5 liczb — krzywa postaci B w scenariuszu 3)",
      "s3_phase_1": "(Opis fazy 1 scenariusza 3)",
      "s3_phase_2": "(Opis fazy 2 scenariusza 3)",
      "s3_phase_3": "(Opis fazy 3 scenariusza 3)",
      "s3_analysis": "(Analiza scenariusza 3)",

      "s4_label": "(Nazwa scenariusza 4)",
      "s4_a_curve": "(5 liczb — krzywa postaci A w scenariuszu 4)",
      "s4_b_curve": "(5 liczb — krzywa postaci B w scenariuszu 4)",
      "s4_phase_1": "(Opis fazy 1 scenariusza 4)",
      "s4_phase_2": "(Opis fazy 2 scenariusza 4)",
      "s4_phase_3": "(Opis fazy 3 scenariusza 4)",
      "s4_analysis": "(Analiza scenariusza 4)"
    },

    "fight-simulation": {

      "label": "(Nazwa scenariusza 1 — identyczna jak w battle-dynamics)",
      "opening": "(Opis otwarcia walki w scenariuszu 1 — pierwsze sekundy/ruchy)",
      "mid_fight": "(Opis środka walki w scenariuszu 1 — punkt krytyczny)",
      "late_fight": "(Opis końcówki walki w scenariuszu 1 — co rozstrzyga)",
      "end_condition": "(Warunek zwycięstwa w scenariuszu 1 — od czego zależy wynik)",

      "phase_1_animation": "(Animacja fazy 1 — opcje: 'rush-ko', 'clash-lock', 'feint-counter', 'solar-flare', 'corner-trap', 'regen-attrition', 'berserk-overextend')",
      "phase_1_actor": "(Kto inicjuje fazę 1 — 'a' lub 'b')",
      "phase_1_title": "(Tytuł fazy 1 — 2-3 słowa)",
      "phase_1_a_label": "(Etykieta statystyki postaci A w fazie 1 — np. 'Szybkość')",
      "phase_1_a_value": "(Wartość statystyki postaci A w fazie 1 — liczba 0-100)",
      "phase_1_b_label": "(Etykieta statystyki postaci B w fazie 1 — np. 'Agresja')",
      "phase_1_b_value": "(Wartość statystyki postaci B w fazie 1 — liczba 0-100)",
      "phase_1_event": "(Opis wydarzenia w fazie 1 — co konkretnie się dzieje)",

      "phase_2_animation": "(Animacja fazy 2)",
      "phase_2_title": "(Tytuł fazy 2)",
      "phase_2_event": "(Opis wydarzenia w fazie 2)",
      "phase_2_branch_a": "(Co się dzieje jeśli postać A wygrywa tę fazę)",
      "phase_2_branch_b": "(Co się dzieje jeśli postać B wygrywa tę fazę)",

      "phase_3_actor": "(Kto inicjuje fazę 3 — 'a' lub 'b')",
      "phase_3_animation": "(Animacja fazy 3)",
      "phase_3_title": "(Tytuł fazy 3)",
      "phase_3_event": "(Opis wydarzenia w fazie 3)",
      "phase_3_branch_a": "(Wynik jeśli postać A wygrywa fazę 3)",
      "phase_3_branch_b": "(Wynik jeśli postać B wygrywa fazę 3)",

      "s2_label": "(Nazwa scenariusza 2)",
      "s2_phase_1_animation": "(Animacja fazy 1 scenariusza 2)",
      "s2_phase_1_actor": "(Aktor fazy 1 scenariusza 2 — 'a' lub 'b')",
      "s2_phase_1_title": "(Tytuł fazy 1 scenariusza 2)",
      "s2_phase_1_event": "(Opis fazy 1 scenariusza 2)",
      "s2_phase_2_animation": "(Animacja fazy 2 scenariusza 2)",
      "s2_phase_2_title": "(Tytuł fazy 2 scenariusza 2)",
      "s2_phase_2_event": "(Opis fazy 2 scenariusza 2)",
      "s2_phase_2_branch_a": "(Branch A fazy 2 scenariusza 2)",
      "s2_phase_2_branch_b": "(Branch B fazy 2 scenariusza 2)",
      "s2_phase_3_actor": "(Aktor fazy 3 scenariusza 2)",
      "s2_phase_3_animation": "(Animacja fazy 3 scenariusza 2)",
      "s2_phase_3_title": "(Tytuł fazy 3 scenariusza 2)",
      "s2_phase_3_event": "(Opis fazy 3 scenariusza 2)",
      "s2_phase_3_branch_a": "(Branch A fazy 3 scenariusza 2)",
      "s2_phase_3_branch_b": "(Branch B fazy 3 scenariusza 2)",
      "s2_end_condition": "(Warunek zwycięstwa w scenariuszu 2)",

      "s3_label": "(Nazwa scenariusza 3)",
      "s3_phase_1_animation": "(Animacja fazy 1 scenariusza 3)",
      "s3_phase_1_actor": "(Aktor fazy 1 scenariusza 3)",
      "s3_phase_1_title": "(Tytuł fazy 1 scenariusza 3)",
      "s3_phase_1_event": "(Opis fazy 1 scenariusza 3)",
      "s3_phase_2_animation": "(Animacja fazy 2 scenariusza 3)",
      "s3_phase_2_actor": "(Aktor fazy 2 scenariusza 3 — opcjonalnie)",
      "s3_phase_2_mode": "(Tryb fazy 2 scenariusza 3 — opcjonalnie: 'animation')",
      "s3_phase_2_title": "(Tytuł fazy 2 scenariusza 3)",
      "s3_phase_2_event": "(Opis fazy 2 scenariusza 3)",
      "s3_phase_2_branch_a": "(Branch A fazy 2 scenariusza 3)",
      "s3_phase_2_branch_b": "(Branch B fazy 2 scenariusza 3)",
      "s3_phase_3_animation": "(Animacja fazy 3 scenariusza 3)",
      "s3_phase_3_actor": "(Aktor fazy 3 scenariusza 3)",
      "s3_phase_3_title": "(Tytuł fazy 3 scenariusza 3)",
      "s3_phase_3_event": "(Opis fazy 3 scenariusza 3)",
      "s3_phase_3_branch_a": "(Branch A fazy 3 scenariusza 3)",
      "s3_phase_3_branch_b": "(Branch B fazy 3 scenariusza 3)",
      "s3_end_condition": "(Warunek zwycięstwa w scenariuszu 3)",

      "s4_label": "(Nazwa scenariusza 4)",
      "s4_phase_1_animation": "(Animacja fazy 1 scenariusza 4)",
      "s4_phase_1_actor": "(Aktor fazy 1 scenariusza 4)",
      "s4_phase_1_title": "(Tytuł fazy 1 scenariusza 4)",
      "s4_phase_1_event": "(Opis fazy 1 scenariusza 4)",
      "s4_phase_2_animation": "(Animacja fazy 2 scenariusza 4)",
      "s4_phase_2_actor": "(Aktor fazy 2 scenariusza 4)",
      "s4_phase_2_title": "(Tytuł fazy 2 scenariusza 4)",
      "s4_phase_2_event": "(Opis fazy 2 scenariusza 4)",
      "s4_phase_2_branch_a": "(Branch A fazy 2 scenariusza 4)",
      "s4_phase_2_branch_b": "(Branch B fazy 2 scenariusza 4)",
      "s4_phase_3_animation": "(Animacja fazy 3 scenariusza 4)",
      "s4_phase_3_actor": "(Aktor fazy 3 scenariusza 4)",
      "s4_phase_3_title": "(Tytuł fazy 3 scenariusza 4)",
      "s4_phase_3_event": "(Opis fazy 3 scenariusza 4)",
      "s4_phase_3_branch_a": "(Branch A fazy 3 scenariusza 4)",
      "s4_phase_3_branch_b": "(Branch B fazy 3 scenariusza 4)",
      "s4_end_condition": "(Warunek zwycięstwa w scenariuszu 4)"
    },

    "verdict-matrix": {
      "col_1": "(Nagłówek kolumny 1 — zmienna TAK, np. 'SOLAR FLARE: TAK', 'KI BLASTY: TAK')",
      "col_2": "(Nagłówek kolumny 2 — zmienna NIE)",
      "row_1": "(Nagłówek wiersza 1 — np. 'STANDARD KO')",
      "row_2": "(Nagłówek wiersza 2 — np. 'WALKA NA ŚMIERĆ')",
      "case_1": "(Werdykt dla: kolumna 1 + wiersz 1 — kto wygrywa i X/10)",
      "case_2": "(Werdykt dla: kolumna 2 + wiersz 1)",
      "case_3": "(Werdykt dla: kolumna 1 + wiersz 2)",
      "case_4": "(Werdykt dla: kolumna 2 + wiersz 2)"
    },

    "fight-card": {
      "fight_title": "(Pełna nazwa walki — np. 'Superman vs King Hyperion')"
    }
  },

  "templates": {},

  "fighterA": {
    "name": "(Imię/nazwa postaci A)",
    "version": "(Wersja/era postaci A — np. 'New52', 'Grand Regent')",
    "stats": {
      "battleIq":   (identyczne co fight-analytics.a.battleIq),
      "durability": (identyczne co fight-analytics.a.durability),
      "experience": (identyczne co fight-analytics.a.experience),
      "hax":        (identyczne co fight-analytics.a.hax),
      "skills":     (identyczne co fight-analytics.a.skills),
      "speed":      (identyczne co fight-analytics.a.speed),
      "stamina":    (identyczne co fight-analytics.a.stamina),
      "strength":   (identyczne co fight-analytics.a.strength),
      "style":      (identyczne co fight-analytics.a.style)
    }
  },
  "fighterB": {
    "name": "(Imię/nazwa postaci B)",
    "version": "(Wersja/era postaci B)",
    "stats": {
      "battleIq":   (identyczne co fight-analytics.b.battleIq),
      "durability": (identyczne co fight-analytics.b.durability),
      "experience": (identyczne co fight-analytics.b.experience),
      "hax":        (identyczne co fight-analytics.b.hax),
      "skills":     (identyczne co fight-analytics.b.skills),
      "speed":      (identyczne co fight-analytics.b.speed),
      "stamina":    (identyczne co fight-analytics.b.stamina),
      "strength":   (identyczne co fight-analytics.b.strength),
      "style":      (identyczne co fight-analytics.b.style)
    }
  }
}
```

---

## Dostępne animacje (phase_X_animation)

| Wartość | Kiedy używać |
|---|---|
| `rush-ko` | Agresywne otwarcie, jeden zawodnik natychmiast atakuje |
| `clash-lock` | Starcie na równi, wymiana ciosów, punkt krytyczny |
| `feint-counter` | Walka techniczna, jeden zawodnik wygrywa precyzją |
| `solar-flare` | Użycie broni ostatecznej / finisher |
| `corner-trap` | Jeden zawodnik przyciska drugiego, dominacja |
| `regen-attrition` | Wojna na wyniszczenie, regeneracja jako czynnik |
| `berserk-overextend` | Nieuchronność, jeden zawodnik przejmuje kontrolę bez szans na odwrót |

## Uwagi

- **fight-analytics** i **parameter-comparison** mają identyczne wartości — kopiuj.
- **fighterA/fighterB stats** również identyczne z fight-analytics.
- **a_value** i **b_value** w x-factor to zazwyczaj `"50"` dla obu — bonus decyduje o przewadze.
- **Krzywe** (a_curve, b_curve): 5 liczb oddzielonych przecinkiem, bez spacji. Reprezentują momentum przez 5 faz walki.
- **yellow_wave**: 8 liczb — dekoracyjna fala tła, można użyć losowych wartości w zakresie 28-42.

