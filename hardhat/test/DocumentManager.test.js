const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentManager", function () {
  let DocumentManager, documentManager, owner, user1;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    DocumentManager = await ethers.getContractFactory("DocumentManager");
    documentManager = await DocumentManager.deploy();
    await documentManager.waitForDeployment();
  });

  it("should register a document", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("example"));
    const ipfsHash = "QmExample123";
    const iv = ethers.toUtf8Bytes("1234567890123456");

    const tx = await documentManager.registerDocument(hash, ipfsHash, iv);
    await tx.wait();

    const info = await documentManager.getDocumentInfo(1);
    expect(info[0]).to.equal(owner.address);
    expect(info[1]).to.equal(ipfsHash);
  });

  it("should allow sharing and checking access", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("example"));
    const ipfsHash = "QmExample123";
    const iv = ethers.toUtf8Bytes("1234567890123456");
    await documentManager.registerDocument(hash, ipfsHash, iv);

    const encryptedKey = ethers.toUtf8Bytes("fakeEncryptedAESkey");
    await documentManager.shareAccess(1, user1.address, true, encryptedKey);

    const hasAccess = await documentManager.hasAccess(1, user1.address);
    expect(hasAccess).to.equal(true);

    const returnedKey = await documentManager.connect(user1).getEncryptedKey(1, user1.address);
    expect(ethers.toUtf8String(returnedKey)).to.equal(ethers.toUtf8String(encryptedKey));
  });

  it("should verify integrity correctly", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("documentA"));
    const ipfsHash = "QmHashA";
    const iv = ethers.toUtf8Bytes("ivBytes");
    await documentManager.registerDocument(hash, ipfsHash, iv);

    const isValid = await documentManager.verifyIntegrity.staticCall(1, hash);
    expect(isValid).to.equal(true);

    const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
    const invalid = await documentManager.verifyIntegrity.staticCall(1, fakeHash);
    expect(invalid).to.equal(false);
  });
});
