const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("SecureDocumentStorageModule", (m) => {
  const secureDocumentStorage = m.contract("SecureDocumentStorage");
  return { secureDocumentStorage };
});
