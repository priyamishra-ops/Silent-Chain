import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Examples:
 *   - npx hardhat --network sepolia task:address
 *   - npx hardhat --network sepolia task:join
 *   - npx hardhat --network sepolia task:submit --a1 1 --a2 2 --a3 1 --a4 1
 *   - npx hardhat --network sepolia task:decrypt-score
 */

task("task:address", "Prints the SilentChainQuiz address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get("SilentChainQuiz");
  console.log("SilentChainQuiz address is " + deployment.address);
});

task("task:join", "Joins the SilentChainQuiz game")
  .addOptionalParam("address", "Optionally specify the SilentChainQuiz contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentChainQuiz");

    const [signer] = await ethers.getSigners();
    const quizContract = await ethers.getContractAt("SilentChainQuiz", deployment.address);

    const tx = await quizContract.connect(signer).joinGame();
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:submit", "Submits encrypted answers to the quiz")
  .addOptionalParam("address", "Optionally specify the SilentChainQuiz contract address")
  .addParam("a1", "Answer for question 1")
  .addParam("a2", "Answer for question 2")
  .addParam("a3", "Answer for question 3")
  .addParam("a4", "Answer for question 4")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const answers = [
      parseInt(taskArguments.a1),
      parseInt(taskArguments.a2),
      parseInt(taskArguments.a3),
      parseInt(taskArguments.a4),
    ];

    if (!answers.every((value) => Number.isInteger(value) && value >= 1 && value <= 4)) {
      throw new Error("Answers must be integers between 1 and 4.");
    }

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentChainQuiz");
    const [signer] = await ethers.getSigners();
    const quizContract = await ethers.getContractAt("SilentChainQuiz", deployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add8(answers[0])
      .add8(answers[1])
      .add8(answers[2])
      .add8(answers[3])
      .encrypt();

    const tx = await quizContract
      .connect(signer)
      .submitAnswers(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof,
      );
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:decrypt-score", "Decrypts the player's encrypted score")
  .addOptionalParam("address", "Optionally specify the SilentChainQuiz contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentChainQuiz");
    const [signer] = await ethers.getSigners();
    const quizContract = await ethers.getContractAt("SilentChainQuiz", deployment.address);

    const encryptedScore = await quizContract.getScore(signer.address);
    if (encryptedScore === ethers.ZeroHash) {
      console.log(`encrypted score: ${encryptedScore}`);
      console.log("clear score    : 0");
      return;
    }

    const clearScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedScore,
      deployment.address,
      signer,
    );

    console.log(`Encrypted score: ${encryptedScore}`);
    console.log(`Clear score    : ${clearScore}`);
  });
