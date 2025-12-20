# MD3 Color Tokens – games.hispanistica

Basis:
- Primary: `#0F4C5C`
- Secondary: `#276D7B`

Hinweis: Das ist ein konsistentes, praxisnahes Token-Set (Light + Dark) auf Basis deiner beiden Farben. Wenn du später strikt nach Googles HCT/Tonal-Palettes generieren willst, kann man die Werte 1:1 ersetzen – die Token-Namen/Struktur bleiben identisch.

---

## Light scheme

```yaml
# Core
primary: "#0F4C5C"
onPrimary: "#FFFFFF"
primaryContainer: "#D4DFE2"
onPrimaryContainer: "#0F4C5C"

secondary: "#276D7B"
onSecondary: "#FFFFFF"
secondaryContainer: "#D4E2E5"
onSecondaryContainer: "#276D7B"

tertiary: "#3B6570"
onTertiary: "#FFFFFF"
tertiaryContainer: "#D7E2E6"
onTertiaryContainer: "#18343B"

# Neutrals / layout
background: "#F3F6F7"          # helle passende Background-Farbe
onBackground: "#061E25"

surface: "#EEF2F4"
onSurface: "#061E25"

surfaceVariant: "#E2EAEB"
onSurfaceVariant: "#0A313C"

# Surface containers (MD3)
surfaceContainerLowest: "#FFFFFF"
surfaceContainerLow: "#F7FAFB"
surfaceContainer: "#F0F5F6"
surfaceContainerHigh: "#E8EFF1"
surfaceContainerHighest: "#E1EAEC"

# Outlines / dividers
outline: "#072229"
outlineVariant: "#B7C9CE"

# Inverse
inverseSurface: "#041317"
inverseOnSurface: "#FFFFFF"
inversePrimary: "#638B95"

# States (wenn du Hex statt Alpha-Overlays willst)
primaryHover: "#0D4351"
primaryPressed: "#0B3A46"
secondaryHover: "#225F6B"
secondaryPressed: "#1D515B"

# Feedback
error: "#B3261E"
onError: "#FFFFFF"
errorContainer: "#EAD7D6"
onErrorContainer: "#B3261E"

warning: "#7A4D00"
onWarning: "#FFFFFF"
warningContainer: "#F2E0C2"
onWarningContainer: "#4A2F00"

success: "#146C2E"
onSuccess: "#FFFFFF"
successContainer: "#D7E8DD"
onSuccessContainer: "#0D3F1C"

info: "#1A5A8A"
onInfo: "#FFFFFF"
infoContainer: "#D7E7F3"
onInfoContainer: "#103856"
````

---

## Dark scheme

```yaml
# Core
primary: "#7FA7B2"
onPrimary: "#041D23"
primaryContainer: "#0B3A46"
onPrimaryContainer: "#CFE0E4"

secondary: "#8DB4BE"
onSecondary: "#072129"
secondaryContainer: "#1E5661"
onSecondaryContainer: "#D4E2E5"

tertiary: "#93B0B8"
onTertiary: "#071B20"
tertiaryContainer: "#23434C"
onTertiaryContainer: "#D7E2E6"

# Neutrals / layout
background: "#041317"
onBackground: "#E6F0F2"

surface: "#041317"
onSurface: "#E6F0F2"

surfaceVariant: "#0A313C"
onSurfaceVariant: "#C6D7DB"

# Surface containers (MD3)
surfaceContainerLowest: "#020B0D"
surfaceContainerLow: "#061A1F"
surfaceContainer: "#081F26"
surfaceContainerHigh: "#0A252D"
surfaceContainerHighest: "#0C2B34"

# Outlines / dividers
outline: "#8AA4AA"
outlineVariant: "#2A444C"

# Inverse
inverseSurface: "#E6F0F2"
inverseOnSurface: "#041317"
inversePrimary: "#0F4C5C"

# States (Hex-Varianten)
primaryHover: "#89B1BB"
primaryPressed: "#98BDC6"
secondaryHover: "#97BEC7"
secondaryPressed: "#A6CAD1"

# Feedback
error: "#F2B8B5"
onError: "#3A0A06"
errorContainer: "#8C1D18"
onErrorContainer: "#F2B8B5"

warning: "#F2C26B"
onWarning: "#2A1A00"
warningContainer: "#5A3A00"
onWarningContainer: "#F2C26B"

success: "#7FD59A"
onSuccess: "#05210E"
successContainer: "#0F4C22"
onSuccessContainer: "#7FD59A"

info: "#9BCBEE"
onInfo: "#062033"
infoContainer: "#0F3E5E"
onInfoContainer: "#9BCBEE"
```

---

## Minimal-Set (falls du wirklich nur das Nötigste willst)

```yaml
# Light
primary: "#0F4C5C"
secondary: "#276D7B"
background: "#F3F6F7"
surface: "#EEF2F4"
error: "#B3261E"
onPrimary: "#FFFFFF"
onSecondary: "#FFFFFF"
onBackground: "#061E25"
onSurface: "#061E25"

# Dark
primary_dark: "#7FA7B2"
secondary_dark: "#8DB4BE"
background_dark: "#041317"
surface_dark: "#041317"
error_dark: "#F2B8B5"
onPrimary_dark: "#041D23"
onSecondary_dark: "#072129"
onBackground_dark: "#E6F0F2"
onSurface_dark: "#E6F0F2"
```
