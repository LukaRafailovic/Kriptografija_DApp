// front/src/App.js
import React, { useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./ethereum";
import './App.css';


// Helpers: hex <-> Uint8Array / ArrayBuffer
const hexToUint8Array = (hex) => {
  if (!hex) return new Uint8Array();
  if (hex.startsWith("0x")) hex = hex.slice(2);
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return arr;
};

const uint8ArrayToHex = (u8) => {
  return "0x" + Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const arrayBufferToBase64 = (buffer) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// Web Crypto helpers for RSA PEM import (spki / pkcs8)
const pemToArrayBuffer = (pem) => {
  // strip header/footer and newlines
  const b64 = pem.replace(/-----.*?-----/g, "").replace(/\s+/g, "");
  return base64ToArrayBuffer(b64);
};

// Import RSA public key PEM (SPKI) for RSA-OAEP-SHA-256 encryption
const importPublicKey = async (pem) => {
  const spki = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
};

// Import RSA private key PEM (PKCS8) for decryption
const importPrivateKey = async (pem) => {
  const pkcs8 = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
};

// Import AES key raw
const importAesKey = async (raw) => {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

function App() {
  const [account, setAccount] = useState(null);
  const [file, setFile] = useState(null);
  const [documentHash, setDocumentHash] = useState("");
  const [ipfsHash, setIpfsHash] = useState("");
  const [docId, setDocId] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [accessStatus, setAccessStatus] = useState(null);
  const [integrityResult, setIntegrityResult] = useState(null);
  const [aesKeyRaw, setAesKeyRaw] = useState(null); // Uint8Array
  const [ivRaw, setIvRaw] = useState(null); // Uint8Array

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
  };

  const getContract = async () => {
    if (!window.ethereum) throw new Error("Install MetaMask");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  };

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const generateHash = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return "0x" + hashHex;
  };

  const generateAESKey = () => {
    const key = crypto.getRandomValues(new Uint8Array(32)); // 256-bit
    setAesKeyRaw(key);
    return key;
  };

  // AES-GCM encryption: returns { encryptedBuffer (ArrayBuffer), iv (Uint8Array) }
  const encryptFileAESGCM = async (file, key) => {
    const arrayBuffer = await file.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes recommended for GCM
    setIvRaw(iv);
    const cryptoKey = await importAesKey(key.buffer ? key.buffer : key);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, arrayBuffer);
    return { encryptedBuffer: encrypted, iv };
  };

  // Upload encrypted buffer (ArrayBuffer) to Pinata
  const uploadToPinata = async (arrayBuffer) => {
    const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
    const data = new FormData();
    const blob = new Blob([arrayBuffer]);
    data.append("file", blob);

    const res = await fetch(url, {
      method: "POST",
      body: data,
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error("Pinata upload failed: " + txt);
    }
    const json = await res.json();
    return json.IpfsHash;
  };

  // Encrypt AES key with user's RSA public key (PEM) using RSA-OAEP SHA-256
  const encryptAesKeyForUser = async (aesKeyUint8, userPublicKeyPem) => {
    const pubKey = await importPublicKey(userPublicKeyPem);
    const cipherBuffer = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, aesKeyUint8);
    // send hex to contract
    const cipherU8 = new Uint8Array(cipherBuffer);
    return uint8ArrayToHex(cipherU8);
  };

  // Register document: encrypt file with AES-GCM, upload encrypted bytes, compute sha256 hash, send registerDocument(docHash, ipfsHash, iv)
  const registerDocument = async () => {
    if (!file) return alert("Select a file first!");
    try {
      const key = generateAESKey();
      const { encryptedBuffer, iv } = await encryptFileAESGCM(file, key);
      const ipfs = await uploadToPinata(encryptedBuffer);

      const docHash = await generateHash(new Blob([encryptedBuffer])); // hash of encrypted content
      setDocumentHash(docHash);
      setIpfsHash(ipfs);

      // iv hex
      const ivHex = uint8ArrayToHex(iv);

      const contract = await getContract();
      const tx = await contract.registerDocument(docHash, ipfs, ivHex, {
        gasLimit: 800000,
      });
      await tx.wait();

      alert(`Document registered!\nSHA-256: ${docHash}\nIPFS: ${ipfs}`);
    } catch (err) {
      console.error("Register error:", err);
      alert("Error registering document: " + (err.message || err));
    }
  };

  // Grant or revoke access: owner must supply user's public key PEM (text area 'userPublicKey')
  const shareAccess = async (grant) => {
    if (!docId) return alert("Enter Document ID");
    if (!userAddress) return alert("Enter user address");
    try {
      const contract = await getContract();
      let encKeyHex = "0x";

      if (grant) {
        if (!aesKeyRaw) return alert("AES key missing in frontend. Make sure you registered the document in this session.");
        const pem = document.getElementById("userPublicKey").value;
        if (!pem) return alert("Paste user's public key PEM into the Public Key field.");
        encKeyHex = await encryptAesKeyForUser(aesKeyRaw, pem);
      }

      const tx = await contract.shareAccess(docId, userAddress, grant, encKeyHex, {
        gasLimit: 200000,
      });
      await tx.wait();
      setAccessStatus(grant ? "Access granted" : "Access revoked");
      alert("shareAccess tx confirmed");
    } catch (err) {
      console.error("shareAccess error:", err);
      alert("Error sharing access: " + (err.message || err));
    }
  };

  // Verify integrity by calling contract.verifyIntegrity
  const verifyIntegrity = async () => {
    if (!docId || !documentHash) return alert("Enter docId and documentHash");
    try {
      const contract = await getContract();
      const valid = await contract.verifyIntegrity(docId, documentHash);
      setIntegrityResult(valid);
      alert("Integrity check result: " + valid);
    } catch (err) {
      console.error("verify error:", err);
      alert("Error verifying integrity: " + (err.message || err));
    }
  };

  // Download and decrypt: user uses their PRIVATE KEY PEM (pkcs8) to decrypt AES key, then AES-GCM decrypt file from IPFS
  const downloadAndDecrypt = async () => {
    if (!docId) return alert("Enter Document ID");
    const privatePem = document.getElementById("userPrivateKey").value;
    if (!privatePem) return alert("Paste your PRIVATE KEY PEM (pkcs8) in the Private Key field.");

    try {
      const contract = await getContract();

      // 1) Get encrypted key for this user (reverts if no access)
      const encKeyBytes = await contract.getEncryptedKey(docId, account); // returns bytes
      if (!encKeyBytes || encKeyBytes === "0x") return alert("No encrypted AES key for this account (no access).");

      // encKeyBytes is hex 0x...
      const encKeyU8 = hexToUint8Array(encKeyBytes);

      // 2) Import private key and decrypt encrypted AES key (RSA-OAEP, SHA-256)
      const privKey = await importPrivateKey(privatePem);
      // crypto.subtle.decrypt expects ArrayBuffer
      const aesKeyBuffer = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, encKeyU8.buffer);
      const aesKeyU8 = new Uint8Array(aesKeyBuffer);

      // 3) Get document info (ipfsHash + iv) from contract
      const info = await contract.getDocumentInfo(docId);
      const ipfs = info[1];
      const ivHex = await contract.getDocumentInfo(docId).then(r => r[2]); // get iv bytes
      // however getDocumentInfo returns (owner, ipfsHash, iv, timestamp) in our solidity; adjust access
      // Grab iv via returned tuple:
      const returned = await contract.getDocumentInfo(docId);
      const ivBytesHex = returned[2];
      const ivU8 = hexToUint8Array(ivBytesHex);

      // 4) Fetch encrypted file from IPFS via Pinata gateway
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfs}`);
      if (!res.ok) throw new Error("Failed to fetch encrypted file from IPFS");
      const encryptedArrayBuffer = await res.arrayBuffer();

      // 5) Decrypt using AES-GCM
      const cryptoKey = await importAesKey(aesKeyU8.buffer);
      const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivU8 }, cryptoKey, encryptedArrayBuffer);

      // 6) Offer download
      const blob = new Blob([decryptedBuffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "decrypted-file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert("File decrypted & downloaded locally.");
    } catch (err) {
      console.error("downloadAndDecrypt error:", err);
      alert("Error during download/decrypt: " + (err.message || err));
    }
  };

  return (
    <div className="container">
  <h1>Secure Document DApp (end-to-end)</h1>

  {!account ? (
    <button onClick={connectWallet}>Connect MetaMask</button>
  ) : (
    <p className="info">Connected: {account}</p>
  )}

  <hr />

  <div className="section">
    <h2>Register Document</h2>
    <input type="file" onChange={handleFileChange} />
    <button onClick={registerDocument}>
      Register Document (Encrypt + Upload + On-chain)
    </button>
    <div>
      {documentHash && <p>SHA-256 (encrypted content): {documentHash}</p>}
      {ipfsHash && <p>IPFS hash: {ipfsHash}</p>}
    </div>
  </div>

  <div className="section">
    <h2>Share Access (owner)</h2>
    <div className="flex-row">
      <input type="text" placeholder="Document ID" value={docId} onChange={(e) => setDocId(e.target.value)} />
      <input type="text" placeholder="User address" value={userAddress} onChange={(e) => setUserAddress(e.target.value)} />
    </div>
    <textarea id="userPublicKey" placeholder="User PUBLIC KEY PEM (SPKI format)" />
    <div className="flex-row">
      <button onClick={() => shareAccess(true)}>Grant Access</button>
      <button onClick={() => shareAccess(false)}>Revoke Access</button>
    </div>
    {accessStatus && <p className="info">{accessStatus}</p>}
  </div>

  <div className="section">
    <h2>Verify Integrity</h2>
    <div className="flex-row">
      <input type="text" placeholder="Document ID" value={docId} onChange={(e)=>setDocId(e.target.value)} />
      <input type="text" placeholder="Document hash" value={documentHash} onChange={(e)=>setDocumentHash(e.target.value)} />
    </div>
    <button onClick={verifyIntegrity}>Verify Integrity</button>
    {integrityResult !== null && <p className="info">Integrity is {integrityResult ? "VALID ✅" : "INVALID ❌"}</p>}
  </div>

  <div className="section">
    <h2>Download & Decrypt (user)</h2>
    <input type="text" placeholder="Document ID" value={docId} onChange={(e)=>setDocId(e.target.value)} />
    <textarea id="userPrivateKey" placeholder="Your PRIVATE KEY PEM (PKCS8) - for testing only" />
    <button onClick={downloadAndDecrypt}>Download & Decrypt</button>
  </div>

  <p className="note">
    Note: For production don't paste private keys into web fields. This is for demo/testing only.
  </p>
</div>

  );
}

export default App;
