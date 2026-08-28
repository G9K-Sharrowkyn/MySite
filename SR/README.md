# Swoop Racer

Prototyp liniowego wyścigu typu time attack inspirowanego minigrą z serii KOTOR.
Pojazd przyspiesza automatycznie, a gracz odpowiada za start, pięć zmian biegów,
wybór linii przejazdu, omijanie przeszkód i skok repulsorowy.

## Uruchomienie

```bash
npm install
npm run dev
```

Kontrole jakości:

```bash
npm test
npm run lint
npm run build
```

## Sterowanie

- `A` / `D` albo strzałki — ruch w lewo i prawo
- lewy przycisk myszy — start oraz zmiana biegu
- `Spacja` — skok

## Edytor trasy

Przycisk `EDYTOR TRASY` w menu otwiera lokalny tryb moderatora. Kółko myszy,
`W`/`S` lub strzałki góra/dół przesuwają trasę pod nieruchomym kursorem;
`A`/`D` lub strzałki lewo/prawo zmieniają jego położenie w poprzek. `Shift`
zwiększa krok, a `Page Up`/`Page Down` przeskakują po 100 metrów. Panel pozwala wybrać typ i pas,
dodać lub usunąć obiekt, zapisać układ w przeglądarce, wyeksportować/importować
JSON oraz przywrócić wersję domyślną. Zapisany układ jest od razu używany przez
normalny wyścig.

Kliknięcie przed sygnałem startowym powoduje falstart i doliczenie kary, ale nie
pomija odliczania. Zbyt wczesna albo spóźniona zmiana biegu obniża prędkość.
Po przekroczeniu mety przejazd zostaje zamknięty, pojazd automatycznie wytraca
prędkość, a ekran wyników pojawia się po jego całkowitym zatrzymaniu.

Każda trasa jest deterministyczna: wszystkie przeszkody istnieją od początku w
konkretnych odległościach. Nie są losowane ani tworzone tuż przed graczem.
Trasy składają się z ręcznie zaprojektowanych, naprzemiennych sekwencji. Każda
piątka obiektów zawiera trzy pola przyspieszenia i dwie przeszkody, a odstępy oraz
linie przejazdu są celowo zróżnicowane.

Silnik dodaje naturalnie 10 km/h na sekundę, a każdy akcelerator daje jednorazowe
+15 km/h. Maksymalna prędkość wynosi 400 km/h. Pominięcie pola nie odbiera prędkości, natomiast każda kolizja redukuje
aktualną prędkość o połowę. Część sekwencji tworzy ciasne, ale świadomie ustawione
skupiska, w których bezpieczna linia prowadzi przez boosty obok zagrożenia.

## Struktura

- `src/game/raceRules.ts` — testowalne reguły biegów, boostów i skali świata
- `src/store/gameStore.ts` — stan przejazdu, trasy i lokalna tabela wyników
- `src/hooks/usePlayerPhysics.ts` — symulacja pojazdu
- `src/components/Tunnel.tsx` — modułowy korytarz techniczny
- `src/components/Obstacles.tsx` — przeszkody, kolizje i boostery
- `src/components/UI.tsx` — start, HUD, tempo rekordu i ekran mety

Tabela wyników jest obecnie zapisywana lokalnie w przeglądarce. Publiczny ranking
będzie wymagał osobnego serwera oraz weryfikacji przesyłanych przejazdów.
