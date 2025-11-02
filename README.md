# Secure Document DApp (End-to-End)

Ovo je decentralizovana aplikacija (DApp) za **sigurno čuvanje dokumenata** sa end-to-end enkripcijom i kontrolom pristupa preko Ethereum blockchain-a.  

Omogućava Vama da:
- Registrujete dokumente (AES-GCM enkripcija + upload na IPFS)
- Delite pristup korisnicima preko RSA enkripcije AES ključa
- Proverite integritet dokumenata
- Preuzmete i dekriptujete dokumente ukoliko imate ovlašćenje

---

## Tehnologije

- **Frontend**: React.js, JavaScript, CSS
- **Blockchain/Smart Contracts**: Hardhat, Ethers.js
- **Storage**: IPFS (Pinata)
- **Kriptografija**: Web Crypto API (AES-GCM + RSA-OAEP-SHA256)

---

## Preduslovi

- Node.js >= 18
- MetaMask ekstenzija u Vašem browser-u
- Pinata nalog za IPFS (dobijate JWT token)

---

## Instalacija

### 1. Kloniranje repozitorijuma
```bash
git clone <repo-url>
cd <project-folder>
```

### 2. Instalacija zavisnosti
#### Frontend
```bash
cd front
npm install
```

#### Hardhat backend
```bash
cd ../hardhat
npm install
```

---

## Konfiguracija

### Frontend
Kreirajte `.env` fajl u `front/` direktorijumu sa Pinata JWT tokenom:
```env
REACT_APP_PINATA_JWT=YOUR_PINATA_JWT_TOKEN
```

### Hardhat
U `hardhat` folderu, proverite da li `hardhat.config.js` ima konfigurisan lokalni mrežni provider (npr. `localhost:8545`):
```js
module.exports = {
  solidity: "0.8.20",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  }
};
```

---

## Pokretanje lokalnog blockchain-a (Hardhat)

1. U `hardhat` folderu pokrenite node:
```bash
npx hardhat node
```
> Ovo pokreće lokalni Ethereum mrežni node sa unapred kreiranim nalozima.

2. Deploy smart contract-a:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
> `deploy.js` treba da eksportuje adresu i ABI za frontend (`front/src/ethereum.js`).

---

## Pokretanje frontend aplikacije

1. U `front` folderu:
```bash
npm start
```
2. Otvorite `http://localhost:3000` u Vašem browser-u i povežite MetaMask sa lokalnim Hardhat mrežom.

---

## Testiranje smart contract-a

U `hardhat` folderu pokrenite testove:
```bash
npx hardhat test
```
> Testovi pokrivaju registraciju dokumenata, deljenje pristupa i verifikaciju integriteta.

---

## Korišćenje aplikacije

### 1. Povezivanje MetaMask-a
- Kliknite na **Connect MetaMask**
- Aplikacija će prikazati povezanu Ethereum adresu.

### 2. Registracija dokumenta
- Izaberite fajl
- Kliknite **Register Document (Encrypt + Upload + On-chain)**
- Dobijate SHA-256 hash i IPFS hash enkriptovanog fajla.

### 3. Deljenje pristupa
- Unesite **Document ID** i korisničku Ethereum adresu
- Zalepite **RSA javni ključ korisnika (SPKI PEM)**
- Kliknite **Grant Access** ili **Revoke Access**

### 4. Provera integriteta
- Unesite **Document ID** i hash dokumenta
- Kliknite **Verify Integrity**

### 5. Preuzimanje i dekripcija
- Unesite **Document ID**
- Zalepite svoj **PRIVATE KEY PEM (PKCS8)**
- Kliknite **Download & Decrypt**

> ⚠️ Nemojte unositi privatne ključeve u produkciji. Ovo je samo demo/test.

---

## Struktura projekta

```
project-root/
├─ front/
│  ├─ src/
│  │  ├─ App.js
│  │  ├─ App.css
│  │  └─ ethereum.js
│  ├─ package.json
│  └─ .env
├─ hardhat/
│  ├─ contracts/
│  │  └─ DocumentManager.sol
│  ├─ scripts/
│  │  └─ deploy.js
│  ├─ test/
│  │  └─ DocumentManager.test.js
│  └─ hardhat.config.js
└─ README.md
```

---

