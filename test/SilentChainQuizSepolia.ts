import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SilentChainQuiz } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("SilentChainQuizSepolia", function () {
  let signers: Signers;
  let quizContract: SilentChainQuiz;
  let quizContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const quizDeployment = await deployments.get("SilentChainQuiz");
      quizContractAddress = quizDeployment.address;
      quizContract = await ethers.getContractAt("SilentChainQuiz", quizDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("submits answers and decrypts score", async function () {
    steps = 9;

    this.timeout(4 * 40000);

    progress("Joining the game...");
    let tx = await quizContract.connect(signers.alice).joinGame();
    await tx.wait();

    progress("Encrypting answers...");
    const encryptedAnswers = await fhevm
      .createEncryptedInput(quizContractAddress, signers.alice.address)
      .add8(1)
      .add8(2)
      .add8(1)
      .add8(1)
      .encrypt();

    progress(
      `Submitting answers SilentChainQuiz=${quizContractAddress} handle=${ethers.hexlify(encryptedAnswers.handles[0])} signer=${signers.alice.address}...`,
    );
    tx = await quizContract
      .connect(signers.alice)
      .submitAnswers(
        encryptedAnswers.handles[0],
        encryptedAnswers.handles[1],
        encryptedAnswers.handles[2],
        encryptedAnswers.handles[3],
        encryptedAnswers.inputProof,
      );
    await tx.wait();

    progress(`Call getScore()...`);
    const encryptedScore = await quizContract.getScore(signers.alice.address);
    expect(encryptedScore).to.not.eq(ethers.ZeroHash);

    progress(`Decrypting getScore()=${encryptedScore}...`);
    const clearScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedScore,
      quizContractAddress,
      signers.alice,
    );
    progress(`Clear score=${clearScore}`);

    expect(clearScore).to.eq(10);
  });
});
