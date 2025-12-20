# 📱 Mobile Layout Specification - Speaker Names Design

## 🎯 Key Requirement
**"Sprechernamen links vom jeweiligen Text, aber dabei wenig Platz einnehmen"**

---

## 📐 Layout-Struktur

### **Desktop (> 900px)** - Aktuell
```
┌────────────────────────────────────────────────────────────┐
│                    METADATA HEADER                          │
├────────────────────────────┬───────────────────────────────┤
│                            │ SIDEBAR (22.2%)               │
│                            │ ┌───────────────────────────┐ │
│  TRANSCRIPTION             │ │ Marcar letras             │ │
│  (77.8%)                   │ │ Tokens seleccionados      │ │
│                            │ │ Atajos de teclado         │ │
│  Sprecher A:               │ │ Exportar                  │ │
│  Dies ist der Text...      │ └───────────────────────────┘ │
│                            │                               │
│  Sprecher B:               │                               │
│  Mehr Text hier...         │                               │
│                            │                               │
└────────────────────────────┴───────────────────────────────┘
│          [Floating Player - 650px max-width]               │
└────────────────────────────────────────────────────────────┘
```

---

### **Mobile (< 600px)** - NEU! ✨

```
┌────────────────────────────────────────┐
│     METADATA HEADER (Compact)          │
│  Título (truncated)                    │
│  Variedad • Fecha                      │
├────────────────────────────────────────┤
│                                        │
│  TRANSCRIPTION (Full Width)            │
│                                        │
│  ┌───┬─────────────────────────────┐  │
│  │SA │ Dies ist der Transkriptions-│  │  ← Sprecher LINKS
│  │   │ text, der sehr viel Platz   │  │
│  │   │ für die eigentliche Rede    │  │
│  │   │ hat. Der Name nimmt nur     │  │
│  │   │ minimal Platz ein.          │  │
│  └───┴─────────────────────────────┘  │
│                                        │
│  ┌───┬─────────────────────────────┐  │
│  │SB │ Nächster Sprecher folgt     │  │  ← Sprecher LINKS
│  │   │ hier mit mehr Text für die  │  │
│  │   │ Transkription, die gut      │  │
│  │   │ lesbar ist auf dem kleinen  │  │
│  │   │ Bildschirm.                 │  │
│  └───┴─────────────────────────────┘  │
│                                        │
├────────────────────────────────────────┤
│  [SIMPLIFIED PLAYER - 60px height]     │
│  ▶  ━━━━━━━━━━━━━━━━━  1:23 / 5:47    │
└────────────────────────────────────────┘
```

---

## 🎨 CSS-Implementation

### **Grid-Layout für Speaker + Text**

```css
/* Speaker content container */
.speaker-content {
  display: grid !important;
  grid-template-columns: auto 1fr !important;  /* Name: auto-width, Text: fill */
  gap: var(--md3-space-2) !important;         /* 8px gap */
  align-items: start !important;
}
```

**Ergebnis**:
- Spalte 1 (`auto`): Speaker Name - nimmt nur benötigten Platz
- Spalte 2 (`1fr`): Transkript-Text - füllt verbleibenden Raum
- Gap: 8px zwischen Name und Text

---

### **Speaker Name Styling**

```css
.speaker-name {
  /* Sehr klein! */
  font-size: 0.7rem !important;          /* 11.2px bei 16px base */
  font-weight: 500 !important;           /* Medium (nicht bold) */
  
  /* Farbe */
  color: var(--md3-color-on-surface-variant) !important;  /* Subtil */
  
  /* Spacing */
  margin: 0 !important;
  padding: 0.25rem 0.5rem !important;    /* 4px 8px */
  
  /* Width limit */
  max-width: 80px !important;            /* Maximal 80px breit */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;               /* "Sprecher A..." bei Overflow */
  
  /* Visual */
  background: var(--md3-color-surface-container-highest);
  border-radius: var(--md3-radius-small);
  align-self: flex-start;
}
```

**Ergebnis**:
- Sehr kleine Schrift (0.7rem = ~11px)
- Maximale Breite 80px (sonst Ellipsis)
- Subtile Hintergrundfarbe (MD3 Surface Container)
- Abgerundete Ecken

---

### **Transkript-Text Styling**

```css
.transcript-text,
.word {
  font-size: 1rem !important;           /* 16px - gut lesbar */
  line-height: 1.6 !important;          /* Luftiger Zeilenabstand */
}

/* Touch-optimierte Wörter */
.word {
  padding: 0.25rem 0.125rem !important; /* 4px 2px */
  min-height: 44px;                     /* MD3 minimum touch target */
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
```

**Ergebnis**:
- Große Schrift für Lesbarkeit (1rem = 16px)
- Touch-Targets mindestens 44px hoch (MD3 Standard)
- Wörter sind klickbar für Audio-Playback

---

## 📏 Größenvergleich

### **Speaker Name Width**

```
Desktop (Normal):
┌─────────────────────┐
│  Sprecher A:        │  → ~120px breit
└─────────────────────┘

Mobile (Optimiert):
┌──────┐
│  SA  │  → max 80px, oft nur ~40px
└──────┘
```

**Platzersparnis**: ~66% weniger Platz für Speaker Names!

---

### **Font-Size Comparison**

```
Desktop Speaker Name:  1.0rem  (16px)  ████████████████
Mobile Speaker Name:   0.7rem  (11px)  ███████████

Desktop Text:          1.0rem  (16px)  ████████████████
Mobile Text:           1.0rem  (16px)  ████████████████  (gleich!)
```

**Wichtig**: Nur Speaker Names werden kleiner, **nicht** der Transkript-Text!

---

## 🎯 Breakpoint-Verhalten

```css
/* Mobile Small (< 400px) */
@media (max-width: 400px) {
  .speaker-name {
    font-size: 0.65rem !important;  /* Noch kleiner: 10.4px */
    max-width: 60px !important;
  }
}

/* Mobile Standard (< 600px) */
@media (max-width: 600px) {
  .speaker-name {
    font-size: 0.7rem !important;   /* 11.2px */
    max-width: 80px !important;
  }
}

/* Tablet (601px - 900px) */
@media (min-width: 601px) and (max-width: 900px) {
  .speaker-name {
    font-size: 0.8rem !important;   /* 12.8px */
    max-width: 100px !important;
  }
}

/* Desktop (> 900px) */
@media (min-width: 901px) {
  .speaker-name {
    font-size: 1rem;                /* 16px (normal) */
    max-width: none;
  }
}
```

---

## 🌐 Landscape Mode

```css
/* Landscape (Mobile) - Noch kompakter! */
@media (max-width: 900px) and (orientation: landscape) {
  .speaker-name {
    font-size: 0.65rem !important;  /* Extra klein */
    max-width: 60px !important;
  }
}
```

Im Landscape-Modus ist **noch mehr horizontaler Platz** für Transkription!

---

## 🎨 Visual Example (ASCII)

### Mobile (Portrait, < 600px):

```
┌────────────────────────────────────────┐
│ Interview mit María García             │
│ ES-ARG • 2024-02-13                    │
├────────────────────────────────────────┤
│                                        │
│ ┌──┬──────────────────────────────┐   │
│ │E │ Entonces, ¿cómo fue tu       │   │
│ │  │ experiencia en Buenos Aires? │   │
│ └──┴──────────────────────────────┘   │
│                                        │
│ ┌──┬──────────────────────────────┐   │
│ │M │ Bueno, fue muy interesante,  │   │
│ │  │ la verdad. Porque ahí conocí │   │
│ │  │ a mucha gente de diferentes  │   │
│ │  │ lugares, ¿viste?             │   │
│ └──┴──────────────────────────────┘   │
│                                        │
│ ┌──┬──────────────────────────────┐   │
│ │E │ ¿Y qué fue lo que más te     │   │
│ │  │ gustó de la ciudad?          │   │
│ └──┴──────────────────────────────┘   │
│                                        │
├────────────────────────────────────────┤
│ ▶  ━━━━━━━━━━━━━━  02:45 / 08:32     │
└────────────────────────────────────────┘
     ↑
   60px hoch, fixed bottom
```

**Legende**:
- `E` = Entrevistador (sehr klein, links)
- `M` = María (sehr klein, links)
- Transkript-Text nimmt **>90%** der Breite ein
- Speaker Names nur **<10%** der Breite

---

## ✅ Erfüllte Requirements

1. ✅ **Sprechernamen links vom Text** → Grid `auto 1fr`
2. ✅ **Sehr klein (0.7rem)** → Minimaler Platzbedarf
3. ✅ **Max 80px breit** → Begrenzte Breite mit Ellipsis
4. ✅ **Transkription maximiert** → 1fr füllt verbleibenden Raum
5. ✅ **Touch-optimiert** → 44px min-height für Wörter
6. ✅ **MD3-konform** → Surface Container, Primary-Variant Colors
7. ✅ **Responsive** → Breakpoints für alle Größen
8. ✅ **Landscape-optimiert** → Noch kompakter

---

## 🚀 Testing-Checkliste

### Mobile (< 600px):
- [ ] Speaker names erscheinen **links** vom Text
- [ ] Speaker names sind **sehr klein** (schwer zu lesen ist OK!)
- [ ] Text ist **groß genug** zum Lesen (1rem)
- [ ] Text nutzt **volle Breite** (>90%)
- [ ] Wörter sind **klickbar** (Touch-Targets 44px)
- [ ] Player ist **60px hoch** und **fixed bottom**
- [ ] Sidebars sind **versteckt**

### Verschiedene Devices:
- [ ] iPhone SE (375px)
- [ ] iPhone 12/13 (390px)
- [ ] Android Standard (360px-400px)
- [ ] Tablet Portrait (768px)
- [ ] Landscape Mode

---

**Status**: ✅ **Specification Complete**  
**Implementation**: ✅ **CSS fertig** in `player-mobile.css`  
**Testing**: ⏳ **Morgen!**
