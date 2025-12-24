import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedQuiz = await deploy("SilentChainQuiz", {
    from: deployer,
    log: true,
  });

  console.log(`SilentChainQuiz contract: `, deployedQuiz.address);
};
export default func;
func.id = "deploy_silentChainQuiz"; // id required to prevent reexecution
func.tags = ["SilentChainQuiz"];
