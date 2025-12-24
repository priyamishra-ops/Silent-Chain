import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SilentChainQuiz, SilentChainQuiz__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SilentChainQuiz")) as SilentChainQuiz__factory;
  const quizContract = (await factory.deploy()) as SilentChainQuiz;
  const quizContractAddress = await quizContract.getAddress();

  return { quizContract, quizContractAddress };
}

describe("SilentChainQuiz", function () {
  let signers: Signers;
  let quizContract: SilentChainQuiz;
  let quizContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ quizContract, quizContractAddress } = await deployFixture());
  });

  it("should require joining before submitting answers", async function () {
    const encryptedInput = await fhevm
      .createEncryptedInput(quizContractAddress, signers.alice.address)
      .add8(1)
      .add8(2)
      .add8(1)
      .add8(1)
      .encrypt();

    await expect(
      quizContract
        .connect(signers.alice)
        .submitAnswers(
          encryptedInput.handles[0],
          encryptedInput.handles[1],
          encryptedInput.handles[2],
          encryptedInput.handles[3],
          encryptedInput.inputProof,
        ),
    ).to.be.revertedWith("Player not joined");
  });

  it("awards points for correct answers", async function () {
    const joinTx = await quizContract.connect(signers.alice).joinGame();
    await joinTx.wait();

    const encryptedInput = await fhevm
      .createEncryptedInput(quizContractAddress, signers.alice.address)
      .add8(1)
      .add8(2)
      .add8(1)
      .add8(1)
      .encrypt();

    const tx = await quizContract
      .connect(signers.alice)
      .submitAnswers(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof,
      );
    await tx.wait();

    const encryptedScore = await quizContract.getScore(signers.alice.address);
    const clearScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedScore,
      quizContractAddress,
      signers.alice,
    );

    expect(clearScore).to.eq(10);
  });

  it("does not award points for incorrect answers", async function () {
    const joinTx = await quizContract.connect(signers.bob).joinGame();
    await joinTx.wait();

    const encryptedInput = await fhevm
      .createEncryptedInput(quizContractAddress, signers.bob.address)
      .add8(1)
      .add8(1)
      .add8(1)
      .add8(1)
      .encrypt();

    const tx = await quizContract
      .connect(signers.bob)
      .submitAnswers(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof,
      );
    await tx.wait();

    const encryptedScore = await quizContract.getScore(signers.bob.address);
    const clearScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedScore,
      quizContractAddress,
      signers.bob,
    );

    expect(clearScore).to.eq(0);
  });
});
