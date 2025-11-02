import React, { useState } from "react";
import axios from "axios";
import CryptoJS from "crypto-js";
import { ethers } from "ethers";
import contractABI from "./contracts/SecureDocumentStorage.json";
import { CONTRACT_ADDRESS } from "./config";

export default function UploadDocument() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [account, setAccount] = useState("");

  // 1️⃣ Povezivanje MetaMask
  async function connectWallet() {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
    } else {
      alert("MetaMask nije pronađen!");
    }
  }

  // 2️⃣ Upload fajla na Pinata i unos u Smart Contract
  async function uploadToPinata() {
    if (!file) return alert("Izaberi fajl!");
    setStatus("Generišem hash i uploadujem...");

    // Generiši SHA-256 hash
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onloadend = async () => {
      const wordArray = CryptoJS.lib.WordArray.create(reader.result);
      const fileHash = CryptoJS.SHA256(wordArray).toString();

      // Pripremi form-data za Pinata
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
          maxBodyLength: "Infinity",
          headers: {
            "Content-Type": `multipart/form-data`,
            pinata_api_key: process.env.REACT_APP_PINATA_API_KEY,
            pinata_secret_api_key: process.env.REACT_APP_PINATA_API_SECRET,
          },
        });

        const ipfsHash = res.data.IpfsHash;
        setStatus(`Fajl uploadovan na IPFS: ${ipfsHash}`);

        // 3️⃣ Interakcija sa pametnim ugovorom
        if (window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);

          const tx = await contract.registerDocument(fileHash, ipfsHash);
          await tx.wait();

          setStatus("✅ Dokument uspešno sačuvan na blockchainu!");
        }
      } catch (err) {
        console.error(err);
        setStatus("❌ Greška pri uploadu na Pinata");
      }
    };
  }

  return (
    <div className="p-6 text-center">
      <h2 className="text-2xl font-bold mb-4">Upload dokumenta</h2>

      <button onClick={connectWallet} className="bg-blue-500 text-white px-4 py-2 rounded mb-4">
        Poveži MetaMask
      </button>
      {account && <p>Povezan nalog: {account}</p>}

      <input type="file" onChange={(e) => setFile(e.target.files[0])} className="block mx-auto my-4" />

      <button onClick={uploadToPinata} className="bg-green-500 text-white px-4 py-2 rounded">
        Uploaduj dokument
      </button>

      <p className="mt-4">{status}</p>
    </div>
  );
}
