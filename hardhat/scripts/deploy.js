const { ethers } = require("hardhat");


async function main() {
  const ContractFactory = await ethers.getContractFactory("SecureDocumentStorage");
  const contract = await ContractFactory.deploy();

  // Sačekaj da deploy bude finalizovan
  await contract.waitForDeployment();

  console.log("Contract deployed to:", contract.target); // ovde je prava adresa
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

