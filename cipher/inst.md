
# ULTRA ENIGMA V1

## 1. Cel

Zbuduj lokalną aplikację webową o nazwie **Ultra Enigma**. Jest to eksperymentalna maszyna szyfrująca inspirowana Enigmą, ale znacznie bardziej złożona. Nie korzystaj z AES, ChaCha20, XChaCha20, WebCrypto ani żadnego gotowego szyfru. Całe szyfrowanie ma wynikać z własnej maszyny składającej się z 32 dynamicznych rotorów, ich zmiennego okablowania, sprzężenia zwrotnego, deterministycznego szumu i globalnych permutacji.

Aplikacja ma być w pełni deterministyczna. Dla tej samej wersji algorytmu, tego samego hasła i tej samej wiadomości wynik musi być zawsze identyczny.

Obowiązkowa własność:

```ts
decrypt(password, encrypt(password, plaintext).ciphertext).plaintext === plaintext
```

Każda operacja użyta podczas szyfrowania musi posiadać dokładnie zdefiniowaną operację odwrotną.

Nie pozostawiaj żadnego elementu algorytmu do losowego wyboru podczas implementacji. Implementuj dokładnie poniższą wersję V1.

---

# 2. Technologie

Użyj:

```text
Vite
React
TypeScript
Vitest
CSS
```

Nie używaj backendu.

Nie wysyłaj żadnych danych do internetu.

Nie zapisuj hasła ani plaintextu w localStorage, sessionStorage, IndexedDB ani cookies.

Struktura projektu:

```text
src/
  engine/
    uint.ts
    seedMixer.ts
    prng.ts
    signature.ts
    checksum.ts
    rotor.ts
    rotorMachine.ts
    noise.ts
    diffusion.ts
    ticket.ts
    printableCodec.ts
    encrypt.ts
    decrypt.ts
    types.ts

  components/
    Header.tsx
    KeyPanel.tsx
    RotorGrid.tsx
    RotorCard.tsx
    Workspace.tsx
    StatsPanel.tsx
    DiagnosticPanel.tsx

  App.tsx
  styles.css
```

Logika znajdująca się w `src/engine/` nie może importować Reacta.

---

# 3. Reprezentacja danych

Wszystkie teksty przed szyfrowaniem zamieniaj na UTF-8 przy użyciu:

```ts
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
```

Hasło:

```ts
const passwordBytes = encoder.encode(password);
```

Wiadomość:

```ts
const plaintextBytes = encoder.encode(plaintext);
```

Maszyna działa wyłącznie na bajtach `0–255`.

Nie wykonuj szyfrowania bezpośrednio na znakach JavaScript UTF-16.

Dzięki temu:

```text
ą
ę
ż
漢
🙂
\n
\t
```

są obsługiwane poprawnie.

Puste hasło jest niedozwolone.

Pusta wiadomość jest dozwolona.

---

# 4. Funkcje pomocnicze uint32

W `uint.ts` zaimplementuj dokładnie:

```ts
export function u32(x: number): number {
    return x >>> 0;
}

export function rotl32(x: number, n: number): number {
    n &= 31;

    return (
        ((x << n) | (x >>> (32 - n)))
        >>> 0
    );
}

export function byte(x: number): number {
    return x & 0xff;
}
```

Wszędzie tam, gdzie wykonywane są mnożenia 32-bitowe, używaj:

```ts
Math.imul(a, b)
```

Nie polegaj na zwykłym mnożeniu JavaScript przy operacjach mieszających.

---

# 5. Seed Mixer

W `seedMixer.ts` utwórz funkcję:

```ts
export function seedMixer(data: Uint8Array): [
    number,
    number,
    number,
    number
]
```

Stan początkowy:

```ts
let a = 0x243f6a88;
let b = 0x85a308d3;
let c = 0x13198a2e;
let d = 0x03707344;
```

Dla każdego bajtu `x = data[i]` wykonaj dokładnie:

```ts
const p1 = Math.imul(i + 1, 0x9e3779b1);
const p2 = Math.imul(x + 1, 0x85ebca6b);
const p3 = Math.imul(i + 1, 0xc2b2ae35);

a = u32(
    rotl32(
        u32(a ^ u32(x + p1)),
        5
    ) + b
);

b = u32(
    rotl32(
        u32(b + x + c),
        7
    ) ^ a
);

c = u32(
    rotl32(
        u32(c ^ p2),
        11
    ) + d
);

d = u32(
    rotl32(
        u32(d + x + p3),
        13
    ) ^ c
);
```

Po przetworzeniu całego wejścia wykonaj 16 rund końcowych.

Dla `r = 0..15`:

```ts
const t = u32(
    a ^
    rotl32(b, (r % 31) + 1) ^
    c ^
    d ^
    r
);

a = u32(rotl32(u32(a + t), 5) ^ b);
b = u32(rotl32(u32(b ^ t), 7) + c);
c = u32(rotl32(u32(c + t), 11) ^ d);
d = u32(rotl32(u32(d ^ t), 13) + a);
```

Jeżeli:

```ts
a === 0 &&
b === 0 &&
c === 0 &&
d === 0
```

ustaw:

```ts
d = 1;
```

Zwróć:

```ts
[a, b, c, d]
```

---

# 6. PRNG

Użyj dokładnie generatora `sfc32`.

W `prng.ts`:

```ts
export class SFC32 {
    constructor(
        private a: number,
        private b: number,
        private c: number,
        private d: number
    ) {
        this.a >>>= 0;
        this.b >>>= 0;
        this.c >>>= 0;
        this.d >>>= 0;

        for (let i = 0; i < 20; i++) {
            this.nextU32();
        }
    }

    nextU32(): number {
        let t = u32(this.a + this.b);

        this.a = u32(
            this.b ^ (this.b >>> 9)
        );

        this.b = u32(
            this.c + (this.c << 3)
        );

        this.c = rotl32(this.c, 21);

        this.d = u32(this.d + 1);

        t = u32(t + this.d);

        this.c = u32(this.c + t);

        return t;
    }

    nextByte(): number {
        return this.nextU32() & 0xff;
    }

    nextInt(maxExclusive: number): number {
        if (maxExclusive <= 0) {
            throw new Error("maxExclusive must be positive");
        }

        return this.nextU32() % maxExclusive;
    }
}
```

---

# 7. Generowanie generatora dla konkretnej domeny

Nigdy nie używaj jednego wspólnego PRNG do całego programu.

Utwórz:

```ts
function createDomainPRNG(
    password: string,
    domain: string
): SFC32
```

Implementacja:

```ts
const data = new TextEncoder().encode(
    password + "\0" + domain
);

const [a, b, c, d] = seedMixer(data);

return new SFC32(a, b, c, d);
```

Używaj dokładnie następujących nazw domen:

```text
ROTORS-V1
TICKET-V1
ALPHABET-V1
```

Domeny zależne od wiadomości będą zdefiniowane później.

---

# 8. Message Signature

Każda wiadomość otrzymuje 64-bitową sygnaturę przechowywaną jako dwa `uint32`.

W `signature.ts`:

```ts
interface MessageSignature {
    a: number;
    b: number;
}
```

Stan:

```ts
let a = 0x6a09e667;
let b = 0xbb67ae85;
```

Dla każdego bajtu `x = bytes[i]`:

```ts
a = u32(
    Math.imul(
        u32(a ^ u32(x + i)),
        0x9e3779b1
    )
);

a = rotl32(a, 7);

b = u32(
    Math.imul(
        u32(
            b +
            x +
            Math.imul(i + 1, 0x85ebca6b)
        ),
        0xc2b2ae35
    )
);

b = rotl32(
    u32(b ^ a),
    11
);
```

Po wszystkich bajtach:

```ts
a = u32(
    a ^
    Math.imul(bytes.length, 0x9e3779b1)
);

b = u32(
    b ^
    Math.imul(bytes.length, 0x85ebca6b)
);
```

Następnie wykonaj 8 rund:

```ts
for (let r = 0; r < 8; r++) {
    a = u32(
        rotl32(
            u32(a ^ b ^ bytes.length ^ r),
            9
        ) +
        0x7f4a7c15
    );

    b = u32(
        rotl32(
            u32(
                b +
                a +
                Math.imul(r + 1, 0x27d4eb2d)
            ),
            13
        ) ^
        0x165667b1
    );
}
```

Zwróć:

```ts
{
    a,
    b
}
```

Zmiana pojedynczego znaku musi zmieniać tę sygnaturę.

---

# 9. Checksum

Checksum ma służyć wyłącznie do wykrycia błędnego hasła lub uszkodzonej wiadomości.

Użyj FNV-1a 32-bit.

```ts
export function checksum32(
    bytes: Uint8Array
): number {
    let h = 0x811c9dc5;

    for (const x of bytes) {
        h ^= x;
        h = Math.imul(h, 0x01000193);
        h >>>= 0;
    }

    h ^= bytes.length;
    h >>>= 0;

    return h;
}
```

---

# 10. Struktura rotora

Każdy rotor ma dokładnie:

```ts
export interface Rotor {
    wiring: Uint8Array;
    inverseWiring: Uint8Array;

    position: number;

    step: number;

    direction: 1 | -1;

    mutations: number;

    totalSteps: number;
}
```

Aplikacja ma dokładnie:

```text
32 rotory
```

indeksowane:

```text
R00 ... R31
```

---

# 11. Role rotorów

Ustal role dokładnie tak:

```text
R00–R15
DATA ROTORS

R16–R23
STATE ROTORS

R24–R27
NOISE ROTORS

R28–R29
MUTATION ROTORS

R30
PERMUTATION ROTOR

R31
CONTROL ROTOR
```

Role są stałe w wersji V1.

---

# 12. Tworzenie rotorów

Utwórz PRNG:

```ts
const rng = createDomainPRNG(
    password,
    "ROTORS-V1"
);
```

Dla każdego rotora od `0` do `31` utwórz:

```ts
const wiring = Uint8Array.from(
    { length: 256 },
    (_, i) => i
);
```

Następnie wykonaj Fisher-Yates od:

```text
i = 255
```

do:

```text
i = 1
```

i wybierz:

```ts
const j = rng.nextInt(i + 1);
```

Zamień:

```ts
wiring[i]
wiring[j]
```

Następnie ustaw:

```ts
position =
    rng.nextByte();

step =
    ((rng.nextByte() & 0x7f) << 1) | 1;

direction =
    (rng.nextU32() & 1)
        ? 1
        : -1;

mutations = 0;

totalSteps = 0;
```

`step` jest więc zawsze nieparzyste i mieści się w zakresie:

```text
1–255
```

Po stworzeniu wiring natychmiast zbuduj `inverseWiring`.

Dla każdego:

```ts
inverseWiring[wiring[i]] = i;
```

---

# 13. Transformacja rotora

Transformacja do przodu:

```ts
export function rotorForward(
    rotor: Rotor,
    value: number
): number {
    const shifted =
        (value + rotor.position) & 0xff;

    const mapped =
        rotor.wiring[shifted];

    return (
        mapped -
        rotor.position
    ) & 0xff;
}
```

Transformacja odwrotna:

```ts
export function rotorBackward(
    rotor: Rotor,
    value: number
): number {
    const shifted =
        (value + rotor.position) & 0xff;

    const mapped =
        rotor.inverseWiring[shifted];

    return (
        mapped -
        rotor.position
    ) & 0xff;
}
```

Obowiązkowy test:

```ts
rotorBackward(
    rotor,
    rotorForward(rotor, x)
) === x
```

dla wszystkich:

```text
x = 0..255
```

---

# 14. Priming maszyny

Po utworzeniu rotorów wykonaj `primeMachine`.

Priming zależy od `messageSignature`.

Zapisz signature jako osiem bajtów little endian:

```text
sig[0] = A bits 0–7
sig[1] = A bits 8–15
sig[2] = A bits 16–23
sig[3] = A bits 24–31

sig[4] = B bits 0–7
sig[5] = B bits 8–15
sig[6] = B bits 16–23
sig[7] = B bits 24–31
```

Dla każdego:

```text
j = 0..7
```

pobierz:

```ts
const x = sig[j];
```

Następnie wykonaj cztery przesunięcia:

```ts
for (let t = 0; t < 4; t++) {
    const r =
        (
            x +
            j * 7 +
            t * 11
        ) & 31;

    const amount =
        1 +
        (
            x +
            t * 37 +
            j * 13
        ) % 17;

    advanceRotor(
        rotors[r],
        amount
    );
}
```

Po czterech przesunięciach wykonaj jedną mutację wiring.

Rotor:

```ts
const target =
    (
        x +
        j * 9 +
        rotors[28].position +
        rotors[29].position
    ) & 31;
```

Pierwszy indeks:

```ts
const p =
    (
        x +
        j * 31 +
        rotors[30].position
    ) & 0xff;
```

Drugi indeks:

```ts
const q =
    (
        p +
        1 +
        (
            x ^
            rotors[31].position ^
            (j * 17)
        ) % 255
    ) & 0xff;
```

Jeżeli `q === p`, ustaw:

```ts
q = (q + 1) & 0xff;
```

Zamień:

```ts
wiring[p]
wiring[q]
```

Następnie przebuduj `inverseWiring`.

Zwiększ:

```ts
mutations++
```

Encryption i decryption mają wykonać identyczny priming.

---

# 15. Przesuwanie rotora

Zaimplementuj:

```ts
function advanceRotor(
    rotor: Rotor,
    amount: number
): number
```

Policz:

```ts
const signedMove =
    rotor.direction *
    rotor.step *
    amount;

const raw =
    rotor.position +
    signedMove;
```

Nowa pozycja:

```ts
rotor.position =
    ((raw % 256) + 256) % 256;
```

Licznik:

```ts
rotor.totalSteps +=
    Math.abs(signedMove);
```

Liczbę przekroczeń punktu zero wylicz jako:

```ts
const wraps =
    raw >= 0
        ? Math.floor(raw / 256)
        : Math.abs(
            Math.floor(raw / 256)
        );
```

Zwróć:

```ts
wraps
```

---

# 16. Wybór aktywnego łańcucha rotorów

Dla każdego bajtu wiadomości wylicz 6 rotorów.

Funkcja otrzymuje:

```text
index
signature
aktualny stan rotorów
```

Nie może używać aktualnego plaintextByte.

Wylicz:

```ts
const r0 =
    (
        index +
        rotors[31].position +
        (signature.a & 31)
    ) & 31;
```

```ts
const r1 =
    (
        r0 +
        1 +
        (rotors[16].position % 31)
    ) & 31;
```

```ts
const r2 =
    (
        r1 +
        1 +
        (rotors[17].position % 31)
    ) & 31;
```

```ts
const r3 =
    (
        r2 +
        1 +
        (rotors[18].position % 31)
    ) & 31;
```

```ts
const r4 =
    (
        r3 +
        1 +
        (rotors[19].position % 31)
    ) & 31;
```

```ts
const r5 =
    (
        r4 +
        1 +
        (rotors[20].position % 31)
    ) & 31;
```

Powtórzenie któregoś rotora jest dozwolone.

Nie próbuj usuwać duplikatów.

---

# 17. Tweaki dla pojedynczego bajtu

Przed szyfrowaniem bajtu wylicz:

```ts
const sigByteA =
    (
        signature.a >>>
        ((index & 3) * 8)
    ) & 0xff;
```

```ts
const sigByteB =
    (
        signature.b >>>
        (((index + 1) & 3) * 8)
    ) & 0xff;
```

Następnie:

```ts
const t0 =
    (
        rotors[21].position +
        index +
        sigByteA
    ) & 0xff;
```

```ts
const t1 =
    (
        rotors[22].position ^
        rotors[23].position ^
        sigByteB
    ) & 0xff;
```

```ts
const t2 =
    (
        rotors[30].position +
        rotors[31].position +
        index * 17
    ) & 0xff;
```

Te wartości mają zostać wykorzystane dokładnie w poniższym łańcuchu.

---

# 18. Szyfrowanie jednego bajtu

Dla `plaintextByte`:

```ts
let x = plaintextByte;
```

Wykonaj dokładnie:

```ts
x ^= t0;
```

```ts
x =
    rotorForward(
        rotors[r0],
        x
    );
```

```ts
x =
    (x + t1) & 0xff;
```

```ts
x =
    rotorForward(
        rotors[r1],
        x
    );
```

```ts
x ^= t2;
```

```ts
x =
    rotorBackward(
        rotors[r2],
        x
    );
```

```ts
x =
    (
        x +
        rotors[24].position
    ) & 0xff;
```

```ts
x =
    rotorForward(
        rotors[r3],
        x
    );
```

```ts
x ^=
    rotors[25].position;
```

```ts
x =
    rotorBackward(
        rotors[r4],
        x
    );
```

```ts
x =
    (
        x +
        rotors[26].position +
        rotors[27].position
    ) & 0xff;
```

```ts
x =
    rotorForward(
        rotors[r5],
        x
    );
```

Ostatecznie:

```ts
const cipherByte =
    x & 0xff;
```

Dodaj `cipherByte` do `coreStream`.

Dopiero potem aktualizuj stan maszyny.

---

# 19. Deszyfrowanie jednego coreByte

Deszyfrowanie wykonaj dokładnie w odwrotnej kolejności.

```ts
let x = cipherByte;
```

```ts
x =
    rotorBackward(
        rotors[r5],
        x
    );
```

```ts
x =
    (
        x -
        rotors[26].position -
        rotors[27].position
    ) & 0xff;
```

```ts
x =
    rotorForward(
        rotors[r4],
        x
    );
```

```ts
x ^=
    rotors[25].position;
```

```ts
x =
    rotorBackward(
        rotors[r3],
        x
    );
```

```ts
x =
    (
        x -
        rotors[24].position
    ) & 0xff;
```

```ts
x =
    rotorForward(
        rotors[r2],
        x
    );
```

```ts
x ^= t2;
```

```ts
x =
    rotorBackward(
        rotors[r1],
        x
    );
```

```ts
x =
    (
        x -
        t1
    ) & 0xff;
```

```ts
x =
    rotorBackward(
        rotors[r0],
        x
    );
```

```ts
x ^= t0;
```

Wynik:

```ts
const plaintextByte =
    x & 0xff;
```

Dopiero po odzyskaniu plaintextByte wykonaj `advanceMachine`, przekazując ten sam `cipherByte`, który znajdował się w `coreStream`.

---

# 20. Aktualizacja maszyny po każdym cipherByte

Utwórz:

```ts
advanceMachine(
    rotors,
    cipherByte,
    index,
    chain
)
```

gdzie `chain` zawiera:

```text
r0
r1
r2
r3
r4
r5
```

Najpierw przesuń:

```ts
r0
```

o:

```ts
1 + (cipherByte & 3)
```

Przesuń:

```ts
r1
```

o:

```ts
1 + ((cipherByte >>> 2) & 3)
```

Przesuń:

```ts
r2
```

o:

```ts
1 + ((cipherByte >>> 4) & 3)
```

Przesuń:

```ts
r5
```

o:

```ts
1 + ((cipherByte >>> 6) & 3)
```

Przesuń:

```ts
R31
```

o:

```ts
1 + (cipherByte % 5)
```

Następnie wybierz jeden State Rotor:

```ts
const stateRotor =
    16 +
    (
        (cipherByte + index) & 7
    );
```

Przesuń go o:

```ts
1 +
(
    (cipherByte ^ index) & 3
)
```

---

# 21. Cascade Mechanism

Każde z przesunięć z poprzedniej sekcji zwraca liczbę `wraps`.

Dla każdego rotora, który miał co najmniej jedno przekroczenie punktu zero, wykonaj dodatkowe przesunięcie innego rotora.

Target:

```ts
const cascadeTarget =
    (
        sourceRotorIndex * 7 +
        11
    ) & 31;
```

Przesuń target o:

```ts
wraps
```

Te dodatkowe przesunięcia nie uruchamiają kolejnych cascade events.

Cascade jest więc dokładnie jednopoziomowy.

Zapobiega to nieskończonym pętlom.

---

# 22. Zmiana kierunku rotorów

Po wszystkich przesunięciach i cascade:

Jeżeli:

```ts
cipherByte & 1
```

odwróć:

```ts
rotors[r3].direction *= -1;
```

Jeżeli:

```ts
cipherByte & 2
```

odwróć:

```ts
rotors[28].direction *= -1;
```

Jeżeli:

```ts
cipherByte & 4
```

odwróć:

```ts
rotors[29].direction *= -1;
```

---

# 23. Mutation Event

Po zmianach kierunku policz:

```ts
const gate =
    (
        cipherByte +
        index +
        rotors[28].position +
        rotors[29].position +
        rotors[31].position
    ) & 31;
```

Jeżeli:

```text
gate != 0
gate != 1
```

nie wykonuj mutacji wiring.

---

# 24. Mutation Type 1 — SWAP

Jeżeli:

```ts
gate === 0
```

wybierz rotor:

```ts
const target =
    (
        cipherByte +
        index +
        rotors[30].position
    ) & 31;
```

Wylicz:

```ts
const p =
    (
        cipherByte +
        rotors[28].position +
        index * 13
    ) & 0xff;
```

```ts
let q =
    (
        p +
        1 +
        (
            rotors[29].position +
            rotors[31].position +
            index * 7
        ) % 255
    ) & 0xff;
```

Jeżeli:

```ts
q === p
```

ustaw:

```ts
q =
    (q + 1) & 0xff;
```

Zamień:

```ts
wiring[p]
wiring[q]
```

Przebuduj `inverseWiring`.

Zwiększ:

```ts
mutations++
```

---

# 25. Mutation Type 2 — REVERSE

Jeżeli:

```ts
gate === 1
```

wybierz:

```ts
const target =
    (
        cipherByte +
        rotors[29].position +
        index * 3
    ) & 31;
```

Długość segmentu:

```ts
const length =
    4 +
    (
        (
            rotors[28].position +
            rotors[31].position +
            cipherByte
        ) & 15
    );
```

Daje to:

```text
4–19 pozycji
```

Maksymalny początek:

```ts
const maxStart =
    256 - length;
```

Początek:

```ts
const start =
    (
        cipherByte +
        rotors[30].position +
        index
    ) % (maxStart + 1);
```

Odwróć kolejność:

```text
wiring[start ... start + length - 1]
```

Przebuduj `inverseWiring`.

Zwiększ:

```ts
mutations++
```

---

# 26. Core Stream

Po zaszyfrowaniu wszystkich bajtów plaintextu otrzymujesz:

```ts
coreStream: Uint8Array
```

Jego długość musi być dokładnie równa:

```ts
plaintextBytes.length
```

Core Stream nie jest jeszcze finalnym ciphertextem.

---

# 27. Noise Plan

Utwórz domenę:

```ts
const noiseDomain =
    "NOISE-V1:" +
    hex32(signature.a) +
    ":" +
    hex32(signature.b) +
    ":" +
    plaintextLength;
```

`hex32` zawsze zwraca dokładnie 8 znaków hex.

Przykład:

```text
0000000f
```

Utwórz PRNG:

```ts
const rng =
    createDomainPRNG(
        password,
        noiseDomain
    );
```

Wylicz:

```ts
const maxNoise =
    Math.min(
        512,
        32 +
        plaintextLength * 2
    );
```

Następnie:

```ts
const noiseCount =
    rng.nextInt(
        maxNoise + 1
    );
```

To jest dokładnie liczba bajtów szumu.

---

# 28. Dlaczego dłuższa wiadomość może dać krótszy ciphertext

Nie implementuj prawdziwego niszczenia informacji.

Efekt „pustych cylindrów” realizuj właśnie poprzez `noiseCount`.

Przykład:

```text
100 bajtów plaintext
+
170 noise
=
270 bajtów body
```

Po dopisaniu jednego znaku zmienia się signature.

Nowy wynik może być:

```text
101 bajtów plaintext
+
4 noise
=
105 bajtów body
```

Dlatego dłuższa wiadomość może nagle stworzyć znacznie krótszy szyfrogram.

To jest zachowanie wymagane.

---

# 29. Rozmieszczanie noise

Wylicz:

```ts
const totalLength =
    plaintextLength +
    noiseCount;
```

Utwórz:

```ts
const positions =
    [0, 1, 2, ..., totalLength - 1];
```

Przetasuj `positions` Fisher-Yates przy użyciu tego samego `noise RNG`.

Pierwsze:

```text
noiseCount
```

indeksów oznacz jako:

```text
NOISE
```

Pozostałe oznacz jako:

```text
DATA
```

Następnie przejdź po pozycjach od:

```text
0
```

do:

```text
totalLength - 1
```

Jeżeli pozycja jest `DATA`, wstaw kolejny bajt `coreStream`.

Jeżeli pozycja jest `NOISE`, wygeneruj:

```ts
rng.nextByte()
```

i wstaw go do bufora.

Powstaje:

```ts
mixedBuffer
```

Podczas deszyfrowania odtwórz identyczny plan i po cofnięciu diffusion usuń wszystkie pozycje oznaczone `NOISE`.

---

# 30. Global Diffusion

Wykonaj dokładnie:

```text
5 rund
```

Numerowanych:

```text
0, 1, 2, 3, 4
```

Dla każdej rundy utwórz osobny PRNG.

Domena:

```ts
"DIFF-V1:" +
hex32(signature.a) +
":" +
hex32(signature.b) +
":" +
plaintextLength +
":" +
mixedBuffer.length +
":" +
round
```

Dla każdej rundy najpierw wygeneruj kompletny `RoundPlan`.

Nie generuj parametrów „w locie” podczas wykonywania transformacji.

---

# 31. RoundPlan

Struktura:

```ts
interface RoundPlan {
    bytePermutation: Uint8Array;
    inverseBytePermutation: Uint8Array;

    mask: Uint8Array;

    forwardConstant: number;
    backwardConstant: number;

    rotateBy: number;

    reverseStart: number;
    reverseEnd: number;

    blockLength: number;
    blockStartA: number;
    blockStartB: number;

    indexPermutation: number[];
}
```

---

# 32. Byte Permutation

Utwórz:

```text
[0 ... 255]
```

i przetasuj Fisher-Yates używając round PRNG.

Zbuduj również inverse permutation.

---

# 33. Additive Mask

Dla każdego bajtu body wygeneruj:

```ts
mask[i] =
    rng.nextByte();
```

Maska ma dokładnie długość bufora.

---

# 34. Chain Constants

Wygeneruj:

```ts
forwardConstant =
    rng.nextByte();
```

```ts
backwardConstant =
    rng.nextByte();
```

---

# 35. Rotation Plan

Jeżeli bufor jest pusty:

```ts
rotateBy = 0;
```

W przeciwnym razie:

```ts
rotateBy =
    rng.nextInt(bufferLength);
```

---

# 36. Reverse Plan

Jeżeli:

```text
bufferLength < 2
```

ustaw:

```text
reverseStart = 0
reverseEnd = 0
```

W przeciwnym razie wygeneruj:

```ts
const a =
    rng.nextInt(bufferLength);

const b =
    rng.nextInt(bufferLength);
```

Następnie:

```ts
reverseStart =
    Math.min(a, b);

reverseEnd =
    Math.max(a, b);
```

---

# 37. Block Swap Plan

Jeżeli:

```text
bufferLength < 4
```

ustaw:

```text
blockLength = 0
blockStartA = 0
blockStartB = 0
```

W przeciwnym razie:

```ts
const half =
    Math.floor(
        bufferLength / 2
    );
```

```ts
const maxBlock =
    Math.min(
        16,
        half
    );
```

```ts
blockLength =
    1 +
    rng.nextInt(maxBlock);
```

Pierwszy blok znajduje się zawsze w pierwszej połowie:

```ts
blockStartA =
    rng.nextInt(
        half -
        blockLength +
        1
    );
```

Drugi zawsze w drugiej:

```ts
blockStartB =
    half +
    rng.nextInt(
        bufferLength -
        half -
        blockLength +
        1
    );
```

Bloki nie nachodzą na siebie.

---

# 38. Global Index Permutation

Utwórz:

```text
[0 ... bufferLength - 1]
```

i przetasuj Fisher-Yates.

To jest `indexPermutation`.

---

# 39. Kolejność jednej rundy diffusion

Każdą rundę wykonuj dokładnie w tej kolejności:

```text
1. BYTE SUBSTITUTION
2. ADDITIVE MASK
3. FORWARD CHAIN
4. BACKWARD CHAIN
5. ROTATE
6. REVERSE SEGMENT
7. SWAP BLOCKS
8. GLOBAL INDEX PERMUTATION
```

Nie zmieniaj kolejności.

---

# 40. Byte Substitution

Dla każdego bajtu:

```ts
buffer[i] =
    bytePermutation[
        buffer[i]
    ];
```

Inverse:

```ts
buffer[i] =
    inverseBytePermutation[
        buffer[i]
    ];
```

---

# 41. Additive Mask

Forward:

```ts
buffer[i] =
    (
        buffer[i] +
        mask[i]
    ) & 0xff;
```

Inverse:

```ts
buffer[i] =
    (
        buffer[i] -
        mask[i]
    ) & 0xff;
```

---

# 42. Forward Chain

Forward:

```ts
for (
    let i = 1;
    i < buffer.length;
    i++
) {
    buffer[i] =
        (
            buffer[i] +
            buffer[i - 1] +
            forwardConstant
        ) & 0xff;
}
```

Inverse wykonuj od końca:

```ts
for (
    let i = buffer.length - 1;
    i >= 1;
    i--
) {
    buffer[i] =
        (
            buffer[i] -
            buffer[i - 1] -
            forwardConstant
        ) & 0xff;
}
```

Kierunek inverse jest obowiązkowy.

---

# 43. Backward Chain

Forward:

```ts
for (
    let i = buffer.length - 2;
    i >= 0;
    i--
) {
    buffer[i] =
        (
            buffer[i] +
            buffer[i + 1] +
            backwardConstant
        ) & 0xff;
}
```

Inverse wykonuj od początku:

```ts
for (
    let i = 0;
    i < buffer.length - 1;
    i++
) {
    buffer[i] =
        (
            buffer[i] -
            buffer[i + 1] -
            backwardConstant
        ) & 0xff;
}
```

---

# 44. Rotate

Forward:

```text
rotate left o rotateBy
```

Inverse:

```text
rotate right o rotateBy
```

Jeżeli bufor jest pusty, nie rób nic.

---

# 45. Reverse Segment

Odwróć:

```text
buffer[reverseStart ... reverseEnd]
```

Operacja odwrotna jest identyczna.

---

# 46. Swap Blocks

Jeżeli:

```ts
blockLength > 0
```

zamień każdy bajt:

```text
blockStartA + i
```

z:

```text
blockStartB + i
```

dla:

```text
i = 0 ... blockLength - 1
```

Operacja odwrotna jest identyczna.

---

# 47. Global Index Permutation

Forward:

```ts
const output =
    new Uint8Array(
        buffer.length
    );

for (
    let i = 0;
    i < buffer.length;
    i++
) {
    output[
        indexPermutation[i]
    ] =
        buffer[i];
}
```

Inverse:

```ts
const output =
    new Uint8Array(
        buffer.length
    );

for (
    let i = 0;
    i < buffer.length;
    i++
) {
    output[i] =
        buffer[
            indexPermutation[i]
        ];
}
```

---

# 48. Cofanie rund diffusion

Podczas deszyfrowania cofaj rundy:

```text
4
3
2
1
0
```

W każdej rundzie wykonuj:

```text
1. INVERSE GLOBAL INDEX PERMUTATION
2. SWAP BLOCKS
3. REVERSE SEGMENT
4. ROTATE RIGHT
5. INVERSE BACKWARD CHAIN
6. INVERSE FORWARD CHAIN
7. SUBTRACT ADDITIVE MASK
8. INVERSE BYTE SUBSTITUTION
```

---

# 49. Bootstrap Ticket

Każda wiadomość ma dokładnie:

```text
24 bajty ticketu
```

Struktura:

```text
0–3
MAGIC

4
VERSION

5
FLAGS

6–9
PLAINTEXT BYTE LENGTH

10–13
MESSAGE SIGNATURE A

14–17
MESSAGE SIGNATURE B

18–21
CHECKSUM

22–23
GUARD
```

Magic:

```text
0x55
0x45
0x4e
0x31
```

co odpowiada:

```text
UEN1
```

Version:

```text
1
```

Flags:

```text
0
```

Wszystkie `uint32` zapisuj little endian.

---

# 50. Guard

Guard wylicz:

```ts
const guard =
    (
        plaintextLength ^
        signature.a ^
        signature.b ^
        checksum
    ) & 0xffff;
```

Zapisz little endian.

---

# 51. Scrambling Ticket

Utwórz:

```ts
const rng =
    createDomainPRNG(
        password,
        "TICKET-V1"
    );
```

Wygeneruj 24 bajty maski:

```ts
mask[i] =
    rng.nextByte();
```

Wykonaj:

```ts
ticket[i] ^=
    mask[i];
```

Następnie utwórz tablicę:

```text
[0 ... 23]
```

i przetasuj Fisher-Yates przy użyciu tego samego PRNG.

Forward:

```ts
scrambled[perm[i]] =
    ticket[i];
```

Inverse:

```ts
ticket[i] =
    scrambled[perm[i]];
```

Po inverse XORuj tę samą maską.

---

# 52. Password Alphabet

Podstawowy alfabet:

```text
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

Ma dokładnie 64 znaki.

Utwórz:

```ts
const rng =
    createDomainPRNG(
        password,
        "ALPHABET-V1"
    );
```

Przetasuj 64 znaki Fisher-Yates.

Otrzymany alfabet jest używany do zapisu ciphertextu.

---

# 53. Printable Codec

Zaimplementuj własny Base64 bez znaku `=`.

Dla każdych trzech bajtów:

```text
aaaaaaaa
bbbbbbbb
cccccccc
```

utwórz cztery wartości 6-bit:

```ts
s0 = a >>> 2;

s1 =
    ((a & 3) << 4) |
    (b >>> 4);

s2 =
    ((b & 15) << 2) |
    (c >>> 6);

s3 =
    c & 63;
```

Każdy sextet zamień na znak z `passwordAlphabet`.

Dla jednego końcowego bajtu generuj dwa znaki.

Dla dwóch końcowych bajtów generuj trzy znaki.

Nie dodawaj `=`.

Decoder wykonuje dokładnie odwrotne operacje.

Jeżeli:

```text
ciphertext.length % 4 === 1
```

zgłoś błąd:

```text
Invalid ciphertext length
```

---

# 54. Final Binary Payload

Po zakończeniu diffusion masz:

```text
encryptedBody
```

Po scrambling ticketu masz:

```text
scrambledTicket
```

Połącz:

```text
scrambledTicket
+
encryptedBody
```

Ticket zawsze znajduje się przed body.

Następnie zakoduj wszystko przez custom printable codec.

To jest finalny ciphertext.

---

# 55. Pełne szyfrowanie

`encrypt()` ma robić dokładnie:

```text
1.
Validate password != ""

2.
UTF-8 encode plaintext

3.
calculateMessageSignature

4.
checksum32

5.
create 32 rotors from password

6.
primeMachine using messageSignature

7.
for every plaintext byte:
    calculate chain
    calculate tweaks
    encrypt byte
    append cipherByte to coreStream
    advanceMachine using cipherByte

8.
buildNoisePlan

9.
merge coreStream and noise into mixedBuffer

10.
apply diffusion round 0

11.
apply diffusion round 1

12.
apply diffusion round 2

13.
apply diffusion round 3

14.
apply diffusion round 4

15.
build 24-byte Bootstrap Ticket

16.
scramble ticket

17.
concatenate ticket + body

18.
generate passwordAlphabet

19.
encode binary payload

20.
return result
```

---

# 56. EncryptionResult

Zwróć:

```ts
interface EncryptionResult {
    ciphertext: string;

    plaintextCharacters: number;
    plaintextBytes: number;

    bodyBytes: number;

    noiseBytes: number;

    finalBinaryBytes: number;

    signatureA: number;
    signatureB: number;

    checksum: number;

    rotorStates: RotorPublicState[];

    totalMutations: number;

    diagnostic: EncryptionDiagnostic;
}
```

---

# 57. Pełne deszyfrowanie

`decrypt()` ma robić dokładnie:

```text
1.
Validate password != ""

2.
Generate passwordAlphabet

3.
Decode ciphertext

4.
Require at least 24 bytes

5.
Split:
    first 24 bytes = scrambledTicket
    remainder = encryptedBody

6.
Unscramble Bootstrap Ticket

7.
Validate MAGIC

8.
Validate VERSION == 1

9.
Read:
    plaintextLength
    signature A
    signature B
    checksum
    guard

10.
Validate guard

11.
Recreate Noise Plan

12.
Verify:
    encryptedBody.length ==
    plaintextLength + noiseCount

13.
Recreate all five Diffusion RoundPlans

14.
Undo round 4

15.
Undo round 3

16.
Undo round 2

17.
Undo round 1

18.
Undo round 0

19.
Use Noise Plan to extract only DATA bytes

20.
Verify resulting coreStream.length ==
    plaintextLength

21.
Create the 32 password rotors

22.
Prime using ticket messageSignature

23.
For every coreStream byte:
    calculate same chain
    calculate same tweaks
    decrypt cipherByte
    append plaintextByte
    advanceMachine using cipherByte

24.
Recalculate checksum

25.
Recalculate messageSignature

26.
Compare checksum

27.
Compare signature

28.
UTF-8 decode with fatal = true

29.
Return plaintext only if every check succeeds
```

---

# 58. Błędne hasło

Jeżeli password jest błędny, najczęściej custom alphabet albo ticket da błędne dane.

Jeżeli:

```text
MAGIC != UEN1
```

nie kontynuuj.

Pokaż:

```text
Nieprawidłowe hasło lub uszkodzony szyfrogram.
```

Nie pokazuj przypadkowo odszyfrowanych danych.

---

# 59. Uszkodzony ciphertext

Jeżeli:

```text
checksum nie pasuje
```

lub:

```text
signature nie pasuje
```

lub:

```text
guard nie pasuje
```

pokaż ten sam komunikat:

```text
Nieprawidłowe hasło lub uszkodzony szyfrogram.
```

Nie informuj użytkownika, który konkretnie test się nie udał w głównym UI.

W Diagnostic Mode można podać szczegół.

---

# 60. Zachowanie podczas wpisywania

W trybie ENCRYPT każda zmiana plaintextu powoduje wykonanie:

```ts
encrypt(
    currentPassword,
    entireCurrentPlaintext
)
```

od początku.

Nie kontynuuj poprzedniego stanu maszyny.

Nie dopisuj jednego cipher znaku.

Cała maszyna jest rekonstruowana od zera.

Dlatego:

```text
W
```

może dać:

```text
a7Q
```

ale:

```text
Wi
```

może dać:

```text
P2_m8X
```

a:

```text
Wit
```

może dać:

```text
z9
```

Wynik poprzedniego szyfrowania nie ma być prefiksem nowego.

---

# 61. Efekt lawinowy

Zmiana pojedynczego plaintext byte wpływa na:

```text
messageSignature
priming
początkowe rotor positions
priming mutations
pierwszy cipherByte
feedback
kolejne rotor positions
mutation events
noiseCount
noise placement
diffusion permutations
diffusion masks
final ordering
```

Dlatego dwa teksty:

```text
Spotkajmy się jutro.
```

oraz:

```text
Spotkajmy się jutro!
```

mają tworzyć całkowicie inne ciphertexty.

---

# 62. Interfejs

Cała aplikacja ma mieć jeden ekran.

Na górze:

```text
ULTRA ENIGMA
ROTOR CIPHER MACHINE // VERSION 1
```

Pod tym panel hasła.

Label:

```text
INITIALIZATION KEY
```

Pole typu password.

Obok przycisk:

```text
SHOW / HIDE
```

Nie zapisuj hasła.

---

# 63. Przełącznik trybu

Dodaj:

```text
ENCRYPT
DECRYPT
```

Jako dwa duże przyciski lub segment control.

Domyślnie:

```text
ENCRYPT
```

---

# 64. Rotor Grid

Pokaż 32 rotory w czterech rzędach:

```text
R00 R01 R02 R03 R04 R05 R06 R07
R08 R09 R10 R11 R12 R13 R14 R15
R16 R17 R18 R19 R20 R21 R22 R23
R24 R25 R26 R27 R28 R29 R30 R31
```

Każda karta pokazuje:

```text
R07
DATA

POS 184
STEP 037
DIR →
MUT 12
```

Dla kierunku:

```text
→ = +1
← = -1
```

---

# 65. Workspace ENCRYPT

Dwa pola obok siebie.

Lewo:

```text
PLAINTEXT
```

Textarea edytowalna.

Prawo:

```text
CIPHERTEXT
```

Textarea tylko do odczytu.

Dodaj:

```text
COPY
```

nad ciphertextem.

---

# 66. Workspace DECRYPT

Lewo:

```text
CIPHERTEXT
```

edytowalne.

Prawo:

```text
PLAINTEXT
```

tylko do odczytu.

Dodaj:

```text
COPY
```

przy plaintext.

---

# 67. Aktualizacja na żywo

Dla tekstu do:

```text
16 384 znaków JavaScript
```

wykonuj obliczenie bez debounce przy każdym `onChange`.

Dla tekstu dłuższego niż:

```text
16 384 znaków
```

użyj:

```text
50 ms debounce
```

Nie zmieniaj algorytmu szyfrowania.

---

# 68. Animacja rotorów

Szyfrowanie najpierw oblicza się w całości.

Dopiero po otrzymaniu wyniku UI animuje wizualną pozycję rotorów od poprzedniej pozycji do nowej.

Animacja nie może wpływać na engine.

Czas animacji:

```text
250 ms
```

Jeżeli rotor zmienił się bardzo mocno, wykonaj szybki obrót zamiast próbować odtwarzać każdą historyczną zmianę.

---

# 69. Statystyki

Pod workspace pokaż:

```text
PLAINTEXT CHARACTERS
PLAINTEXT BYTES
CORE BYTES
NOISE BYTES
BODY BYTES
FINAL BINARY BYTES
CIPHERTEXT CHARACTERS
ROTOR MUTATIONS
```

---

# 70. Diagnostic Mode

Dodaj zwijany panel:

```text
DIAGNOSTIC MODE
```

Domyślnie zamknięty.

Po otwarciu pokaż:

```text
Signature A
Signature B
Checksum
Plaintext byte length
Noise count
Body length
Total rotor mutations
Final rotor positions
Final rotor directions
```

Pokaż również dla ostatniego przetworzonego bajtu:

```text
r0
r1
r2
r3
r4
r5

t0
t1
t2

input byte
core output byte
```

W trybie decrypt:

```text
core input byte
recovered plaintext byte
```

---

# 71. Nie pokazuj wiring domyślnie

W normalnym UI nie wyświetlaj 256-elementowych permutacji rotorów.

W Diagnostic Mode dodaj opcjonalny przycisk:

```text
SHOW ROTOR WIRING
```

Dopiero wtedy pokaż wartości.

---

# 72. Wygląd

Użyj ciemnego technicznego interfejsu.

Tło:

```text
bardzo ciemne
```

Panele:

```text
ciemnoszare
```

Tekst:

```text
jasnoszary / biały
```

Akcent:

```text
chłodny turkusowy lub niebieski
```

Nie używaj stylistyki steampunkowej.

Aplikacja ma wyglądać jak nowoczesna cyfrowa maszyna kryptograficzna inspirowana sprzętem laboratoryjnym.

---

# 73. Ostrzeżenie

Na dole aplikacji umieść niewielki tekst:

```text
Ultra Enigma is an experimental custom cipher intended for personal and educational use. It has not undergone professional cryptographic review and must not be used to protect high-value secrets.
```

Nie wyświetlaj go jako agresywnego alertu.

---

# 74. Testy rotorów

Dla każdego z 32 rotorów i wszystkich:

```text
0–255
```

sprawdź:

```ts
backward(
    forward(x)
) === x
```

---

# 75. Testy diffusion

Dla losowych tablic długości:

```text
0
1
2
3
4
5
16
64
255
512
```

sprawdź:

```ts
inverseDiffusion(
    diffusion(bytes)
) === bytes
```

---

# 76. Testy ticketu

Sprawdź:

```ts
unscrambleTicket(
    password,
    scrambleTicket(
        password,
        ticket
    )
) === ticket
```

---

# 77. Testy printable codec

Dla tablic długości:

```text
0–1024
```

sprawdź:

```ts
decode(
    password,
    encode(
        password,
        bytes
    )
) === bytes
```

---

# 78. Round-trip

Obowiązkowo przetestuj:

```text
""
"a"
"A"
"Hello"
"Zażółć gęślą jaźń"
"🙂"
"🙂🙂🙂"
"漢字"
"\n"
"\n\n\n"
"tekst\nw kilku\nakapitach"
```

oraz teksty długości:

```text
1
10
100
1000
10000
```

Dla każdego:

```ts
decrypt(
    password,
    encrypt(
        password,
        text
    ).ciphertext
).plaintext === text
```

---

# 79. Test różnych haseł

Dla:

```text
password1
password2
```

i identycznego plaintextu ciphertexty muszą być różne.

---

# 80. Test deterministyczności

Dla identycznego:

```text
password
plaintext
```

wywołaj `encrypt()` 100 razy.

Każdy wynik musi być identyczny.

---

# 81. Test jednej zmiany

Porównaj:

```text
To jest tajna wiadomość.
```

z:

```text
To jest tajna wiadomość!
```

Ciphertext nie może być identyczny.

Nie może również posiadać długiego wspólnego prefiksu wynikającego z szyfrowania znak po znaku.

---

# 82. Test długości

Wygeneruj serię:

```text
A
AA
AAA
AAAA
AAAAA
...
```

do długości 500.

Zapisz długość ciphertextu dla każdego przypadku.

Sprawdź, że występują przypadki, w których:

```text
ciphertextLength(n + 1)
<
ciphertextLength(n)
```

Jest to celowe i wymagane zachowanie Ultra Enigmy.

---

# 83. Test błędnego hasła

Zaszyfruj:

```text
password = abc
plaintext = test
```

Następnie spróbuj odszyfrować:

```text
password = abd
```

Aplikacja ma zwrócić błąd.

Nigdy częściowy plaintext.

---

# 84. Test uszkodzonego ciphertextu

Zmień jeden znak ciphertextu.

Deszyfrowanie musi zakończyć się błędem:

```text
Nieprawidłowe hasło lub uszkodzony szyfrogram.
```

---

# 85. Zakazane implementacje

Nie używaj:

```text
AES
DES
3DES
ChaCha
XChaCha
RSA
WebCrypto encryption
libsodium encryption
CryptoJS encryption
Argon2
PBKDF2 jako właściwego mechanizmu szyfrowania
```

Nie implementuj Ultra Enigmy jako dekoracji nad gotowym szyfrem.

Nie używaj:

```ts
Math.random()
```

Nie korzystaj z czasu systemowego.

Nie korzystaj z timestampów.

Nie generuj nonce.

Ultra Enigma V1 jest całkowicie deterministyczna.

---

# 86. Nie upraszczaj rotorów

Nie wolno zastąpić 32 rotorów jednym PRNG streamem XOR.

Każdy byte ma rzeczywiście przejść przez:

```text
6 dynamicznie wybranych rotorów
```

zgodnie z opisanym chainem.

Rotor positions, direction i mutations muszą rzeczywiście wpływać na wynik.

---

# 87. Nie upraszczaj szumu

Noise musi rzeczywiście zostać:

```text
wygenerowany
rozmieszczony pomiędzy core bytes
przepuszczony przez diffusion razem z nimi
```

Nie doklejaj go dopiero po finalnym szyfrowaniu.

---

# 88. Nie upraszczaj efektu zmiany całej wiadomości

Po każdym wpisanym znaku szyfruj cały aktualny plaintext od początku.

Nie implementuj:

```text
previousCiphertext + encrypt(newCharacter)
```

To byłoby sprzeczne z założeniem Ultra Enigmy.

---

# 89. Nie niszcz informacji

Nigdy nie wykonuj rzeczywistego:

```text
DELETE
```

na danych core, jeżeli usunięte dane nie są przechowywane gdzie indziej.

W V1 nie implementuj prawdziwych HOLD/RELEASE registers.

Efekt „znak zniknął” i „wiadomość nagle się skróciła” realizuj przez:

```text
messageSignature
noiseCount
noise positions
global diffusion
```

Dzięki temu V1 pozostaje w pełni odwracalna.

---

# 90. Najważniejszy charakter Ultra Enigmy

Ultra Enigma nie ma zachowywać się jak:

```text
A -> X
B -> Q
C -> M
```

Nie istnieje stały odpowiednik znaku.

Ten sam bajt:

```text
65
```

może w różnych miejscach wiadomości przejść przez inne rotory, inne pozycje, inne kierunki, inne wiring i inne tweaki.

Dodatkowo całe body zostaje później wymieszane globalnie.

Dlatego nie istnieje bezpośrednia relacja:

```text
plaintext position N
=
ciphertext position N
```

---

# 91. Oczekiwany efekt

Użytkownik wpisuje:

```text
W
```

i widzi przykładowo:

```text
N7x
```

Dopisuje:

```text
i
```

Cały wynik zostaje zastąpiony np.:

```text
qbL_2P9
```

Dopisuje:

```text
t
```

Wynik może zmienić się na:

```text
7Z
```

Dopisuje:

```text
a
```

Wynik może zmienić się na:

```text
p2K0XmrN4
```

Nie hardcoduj tych wyników.

To jedynie przykład wymaganego zachowania.

---

# 92. Definicja ukończenia projektu

Projekt jest ukończony dopiero wtedy, gdy jednocześnie:

```text
1. działa encrypt
2. działa decrypt
3. wszystkie round-trip tests przechodzą
4. błędne hasło daje błąd
5. uszkodzony ciphertext daje błąd
6. Unicode działa poprawnie
7. entery są zachowywane
8. wynik jest deterministyczny
9. zmiana jednego znaku zmienia cały ciphertext
10. długość ciphertextu nie rośnie monotonicznie
11. 32 rotory rzeczywiście wpływają na proces
12. wiring rzeczywiście mutuje
13. noise rzeczywiście znajduje się wewnątrz body
14. pięć globalnych rund diffusion rzeczywiście działa
15. wszystkie transformacje posiadają inverse
16. żadna część szyfrowania nie korzysta z gotowego profesjonalnego szyfru
```

Jeżeli którykolwiek z tych punktów nie działa, nie uznawaj implementacji Ultra Enigma V1 za zakończoną.

---

# 93. Kolejność pracy

Implementuj projekt w tej kolejności:

```text
1. uint helpers
2. seedMixer
3. SFC32
4. domain PRNG
5. messageSignature
6. checksum
7. rotor structure
8. rotorForward / rotorBackward
9. rotor initialization
10. priming
11. byte encryption
12. byte decryption
13. advanceMachine
14. rotor mutations
15. coreStream round-trip tests
16. noise plan
17. noise merge/extraction tests
18. diffusion RoundPlan
19. diffusion forward
20. diffusion inverse
21. diffusion tests
22. Bootstrap Ticket
23. ticket scrambling
24. printable codec
25. complete encrypt()
26. complete decrypt()
27. integration tests
28. React UI
29. rotor visualization
30. diagnostics
31. final regression tests
```

Nie zaczynaj od interfejsu.

Najpierw doprowadź `src/engine/` do pełnego round-trip.

Dopiero potem zbuduj UI.

---

# 94. Zasada końcowa

Nie poprawiaj algorytmu według własnego uznania.

Nie zastępuj go „bardziej standardowym” rozwiązaniem.

Nie dodawaj bibliotek kryptograficznych.

Nie usuwaj mechanizmów tylko dlatego, że można osiągnąć podobny efekt prościej.

Celem projektu jest właśnie połączenie dużej liczby prostych, deterministycznych i odwracalnych mechanizmów w jedną skomplikowaną maszynę.

Ultra Enigma V1 ma być dziwna, wielowarstwowa i nieintuicyjna celowo.

Najważniejsze są trzy własności:

```text
DETERMINIZM
ODWRACALNOŚĆ
KASKADOWA ZMIANA STANU
```

Cała implementacja ma podporządkować się tym trzem zasadom.
