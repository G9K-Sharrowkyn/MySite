# Breachpoint

Prosta, jednoosobowa strzelanka FPS działająca w przeglądarce. Projekt korzysta
z tego samego lekkiego zestawu React + Vite + React Three Fiber co sąsiedni `SR`.

## Uruchomienie

```powershell
npm install
npm run dev
```

Vite udostępnia grę pod adresem pokazanym w terminalu, na ścieżce `/shooter/`.

## Sterowanie

- `WASD` — ruch
- `Alt` + `WASD` — chód
- `WASD` bez modyfikatora — bieg
- mysz — rozglądanie i celowanie
- lewy przycisk myszy — strzał
- prawy przycisk myszy — celowanie przez przyrządy
- `1` / `2` / `3` — pistolet, karabin i strzelba
- `R` — przeładowanie
- `Shift` — sprint
- `Spacja` — skok
- `Esc` — zwolnienie kursora / pauza

## Modele 3D

Bronie, postacie i wybrane elementy areny pochodzą z darmowego pakietu
[Quaternius Toon Shooter Game Kit](https://quaternius.com/packs/toonshootergamekit.html).
Są udostępnione na licencji CC0. Kopię informacji o źródle i licencji zapisano w
`public/models/toon-shooter/ASSET_LICENSE.md`.

Karabin gracza, jego animacje zamka i magazynka pochodzą z paczki
[Free FPS Template & Tutorial](https://www.fab.com/listings/6a0af880-2b74-480c-a82c-8e597918dffe).
Model Honey Badger autorstwa TastyTony jest dostępny na licencji CC BY 4.0.
Informację o pochodzeniu zapisano w
`public/models/free-fps-template/ASSET_LICENSE.md`.

Próbki wystrzałów, przeładowania i dobywania broni pochodzą z paczki
[Free Weapon Sound Effects](https://www.fab.com/listings/1697af22-7e2a-410e-b8c0-88239216520d).
Do gry dołączono wyłącznie zoptymalizowane pliki OGG; informacja o źródle
znajduje się w `public/audio/free-weapon-sounds/ASSET_LICENSE.md`.

### Realistyczne assety OpenGameArt i Poly Haven

Widoczne z perspektywy gracza modele pistoletu, M4A1 i strzelby pochodzą z
OpenGameArt. Modele i tekstury zostały przekonwertowane do zoptymalizowanych
plików GLB/WebP. Szczegóły licencji oraz wymagane przypisanie autora pistoletu
znajdują się w `public/models/realistic-weapons/ASSET_LICENSE.md`.

Betonowa posadzka, metalowe ściany i oświetlenie HDRI magazynu pochodzą z
Poly Haven i są udostępnione na licencji CC0. Informacje o źródłach zapisano w
`public/textures/industrial/ASSET_LICENSE.md` oraz
`public/environment/ASSET_LICENSE.md`.

Poprzednie modele pozostają w projekcie jako zasoby zapasowe i materiał
porównawczy.

## Kontrola jakości

```powershell
npm test
npm run lint
npm run build
```
