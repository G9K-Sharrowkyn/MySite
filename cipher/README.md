# Ultra Enigma V1

Lokalna aplikacja React + TypeScript + Vite z silnikiem zaimplementowanym według `inst.md`. Wszystkie operacje szyfrujące wykonuje przeglądarka. Bez backendu, gotowych szyfrów i bibliotek kryptograficznych.

## Uruchomienie

W folderze `cipher`:

```powershell
# Instalacja zależności, jeśli nie są jeszcze zainstalowane:
npm ci
npm run dev
```

Podgląd: http://127.0.0.1:4176/cipher/

```powershell
npm test
npm run build
npm run preview
```

Serwery Vite słuchają wyłącznie na `127.0.0.1`. Jeśli port 4176 jest zajęty, zatrzymaj wcześniejszy serwer tej aplikacji lub użyj `npm run dev -- --port 4177`.

## Model V1

- Seed Mixer i SFC32 z dokładnymi stałymi, rozgrzewką i rozdzieleniem domen.
- 32 rotory z 256-elementowym okablowaniem i odwrotnością; wszystkie role R00–R31 zgodnie z instrukcją.
- Priming sygnaturą, dynamiczny sześciotorowy łańcuch, tweaki, feedback po każdym core byte, jednopoziomowe kaskady, zmiany kierunku oraz mutacje SWAP i REVERSE.
- Sześć podstawowych przesunięć w kolejności z sekcji 20; następnie ich kaskady w tej samej kolejności. Przesunięcia kaskadowe nie uruchamiają kolejnych kaskad.
- Deterministyczny szum umieszczony wewnątrz body przed pięcioma pełnymi rundami diffusion. Każda runda odwracana w przeciwnej kolejności.
- 24-bajtowy Bootstrap Ticket, little endian, guard, maska XOR i permutacja ticketu.
- Własny Base64 bez paddingu, z alfabetem zależnym od hasła.
- UTF-8, Unicode i zachowanie treści wiadomości, w tym nowych linii i początkowego U+FEFF.

`src/engine/` nie importuje Reacta. Publiczne funkcje:

```typescript
import { encrypt } from './src/engine/encrypt';
import { decrypt } from './src/engine/decrypt';

const encrypted = encrypt('hasło', 'Zażółć gęślą jaźń\n🙂');
const recovered = decrypt('hasło', encrypted.ciphertext);
```

Puste hasło jest odrzucane. Pusta wiadomość jest prawidłowa i również otrzymuje ticket oraz deterministyczny plan szumu. Wyniki przykładów W/Wi/Wit w instrukcji są ilustracyjne; rzeczywisty szyfrogram obejmuje co najmniej 24 bajty ticketu.

Podczas odszyfrowania sprawdzamy ticket, długości, sygnaturę i checksum; odtwarzany szum również musi się zgadzać. Decoder odrzuca nieznane symbole i niezerowe niewykorzystane bity ostatniego sextetu. Te kontrole nie zmieniają wyniku szyfrowania V1; zapobiegają przyjmowaniu uszkodzeń ukrytych w szumie lub w końcówce kodowania. Plaintext jest udostępniany dopiero po przejściu wszystkich kontroli.

## Interfejs

- Jedna strona: hasło z SHOW/HIDE, tryby ENCRYPT/DECRYPT, 32 karty rotorów w układzie 4×8, dwa edytory, COPY, osiem statystyk i zwijana diagnostyka.
- Każdy input o długości do 16 384 jednostek UTF-16 jest przeliczany bez debounce. Dłuższy input używa 50 ms debounce. Poprzednie oczekujące obliczenia są anulowane przy kolejnej zmianie tekstu, hasła lub trybu.
- Każde szyfrowanie odbudowuje całą maszynę. Animacja rotorów trwa 250 ms i jest wyłącznie wizualna.
- Pierwsze przejście do DECRYPT wstawia otrzymany szyfrogram, aby łatwo sprawdzić round-trip. Kolejne przełączenia zachowują osobne pola obu trybów.
- Diagnostyka pokazuje końcowy stan i parametry ostatniego bajtu. Okablowanie jest dostępne dopiero po SHOW ROTOR WIRING.
- Na wąskich ekranach tablica rotorów przewija się poziomo, zachowując cztery rzędy po osiem rotorów; edytory układają się pionowo.
- Hasło i wiadomość pozostają w pamięci karty. Aplikacja nie zapisuje ich w localStorage, sessionStorage, IndexedDB ani cookies i nie wysyła ich do internetu. Odświeżenie karty czyści pola.

## Weryfikacja

1083 testy Vitest obejmują wszystkie przypadki z sekcji 74–84, 1025 długości codec, odwracanie każdej rundy diffusion, identyczne stany rotorów po round-trip, deterministyczność 100 uruchomień, serię długości 1–500 oraz odrzucanie błędnego hasła i uszkodzeń. Raport długości jest zapisywany przy testach do `.local/ciphertext-lengths-v1.json`.

`src/engine/v1-vectors.ts` zawiera pięć pełnych wzorców V1 wygenerowanych niezależną implementacją wzorów z instrukcji, z użyciem arytmetyki całkowitej Pythona. Testy porównują szyfrogram, sygnaturę, checksum, szum oraz wszystkie końcowe pozycje, kierunki, kroki i mutacje rotorów, a także checksumy okablowania. Lokalny generator wzorców: `.local/reference-v1.py`.

Sprawdzono także działającą przeglądarkę: live encrypt/decrypt, polskie znaki, emoji, nowe linie, kopiowanie, diagnostykę, próg debounce i anulowanie oczekujących obliczeń, układ desktop/mobile oraz brak zewnętrznych żądań i zapisu w pamięci przeglądarki. Lokalne zrzuty i skrypt kontrolny są w `.local/`.

## Późniejsze podpięcie pod my-site

`npm run build` tworzy `cipher/dist`, z bazą zasobów `/cipher/`. W późniejszym etapie jego zawartość można umieścić w `my-site/public/cipher` i osadzić pod `/cipher/`, np. przez iframe. Ta implementacja nie modyfikuje routingu ani skryptów nadrzędnej strony.

Ultra Enigma is an experimental custom cipher intended for personal and educational use. It has not undergone professional cryptographic review and must not be used to protect high-value secrets.
