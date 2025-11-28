// This setup uses Hardhat Ignition to manage smart contract deployments
// CommonJS version for Node + Hardhat

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { parseEther } = require("viem");

module.exports = buildModule("SplitPayModule", (m) => {
  const splitPay = m.contract("contracts/SplitPay.sol:SplitPay");
  return { splitPay };
});
