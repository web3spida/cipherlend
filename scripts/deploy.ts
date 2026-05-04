import { ethers, run, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CipherLend contracts with:", deployer.address);
  console.log("Network:", network.name);

  const BorrowerRegistry = await ethers.getContractFactory("BorrowerRegistry");
  const borrowerRegistry = await BorrowerRegistry.deploy();
  await borrowerRegistry.waitForDeployment();

  const UnderwritingEngine = await ethers.getContractFactory("UnderwritingEngine");
  const underwritingEngine = await UnderwritingEngine.deploy(await borrowerRegistry.getAddress());
  await underwritingEngine.waitForDeployment();

  const LoanVault = await ethers.getContractFactory("LoanVault");
  const loanVault = await LoanVault.deploy(await underwritingEngine.getAddress());
  await loanVault.waitForDeployment();

  const PermitRegistry = await ethers.getContractFactory("PermitRegistry");
  const permitRegistry = await PermitRegistry.deploy();
  await permitRegistry.waitForDeployment();

  const tx = await underwritingEngine.setLoanVault(await loanVault.getAddress());
  await tx.wait();
  const registryTx = await borrowerRegistry.setUnderwritingEngine(await underwritingEngine.getAddress());
  await registryTx.wait();

  const deployed = {
    borrowerRegistry: await borrowerRegistry.getAddress(),
    underwritingEngine: await underwritingEngine.getAddress(),
    loanVault: await loanVault.getAddress(),
    permitRegistry: await permitRegistry.getAddress(),
  };

  console.log("BorrowerRegistry:", deployed.borrowerRegistry);
  console.log("UnderwritingEngine:", deployed.underwritingEngine);
  console.log("LoanVault:", deployed.loanVault);
  console.log("PermitRegistry:", deployed.permitRegistry);

  if (network.name === "sepolia" || network.name === "arbitrumSepolia" || network.name === "baseSepolia") {
    await verifyContract(deployed.borrowerRegistry, []);
    await verifyContract(deployed.underwritingEngine, [deployed.borrowerRegistry]);
    await verifyContract(deployed.loanVault, [deployed.underwritingEngine]);
    await verifyContract(deployed.permitRegistry, []);
  }
}

async function verifyContract(address: string, constructorArguments: unknown[]) {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log("Verified:", address);
  } catch (error) {
    console.log("Verification skipped/failed for", address, error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
