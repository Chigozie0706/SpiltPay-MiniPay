// This setup uses Hardhat Ignition to manage smart contract deployments
// CommonJS version for Node + Hardhat

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { parseEther } = require("viem");

const JAN_1ST_2030 = 1893456000;
const ONE_GWEI = parseEther("0.001");

module.exports = buildModule("LockModule", (m) => {
  const unlockTime = m.getParameter("unlockTime", JAN_1ST_2030);
  const lockedAmount = m.getParameter("lockedAmount", ONE_GWEI);

  const lock = m.contract("Lock", [unlockTime], {
    value: lockedAmount,
  });

  return { lock };
});
