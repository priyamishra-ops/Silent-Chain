# Silent Chain Quiz

Silent Chain Quiz is a privacy-first, on-chain quiz game powered by Zama FHEVM. Players join the game, answer four
blockchain questions, submit their answers encrypted, and receive encrypted points if they are correct. Only the
player can decrypt their score, while the chain verifies correctness without ever seeing the plaintext answers.

## Project Goals

- Prove that on-chain quizzes can be fair and private with Fully Homomorphic Encryption (FHE)
- Keep answers and scores confidential while still enabling smart contract verification
- Provide a clean, production-ready reference for FHEVM + React + Vite integration
- Demonstrate a complete encrypted flow from UI input to on-chain verification and user-only decryption

## Problems This Project Solves

- **Privacy vs. transparency**: Traditional on-chain quizzes reveal answers and scores publicly; this keeps both
  encrypted while still verifiable.
- **Fair reward distribution**: The contract validates the correct answer set on-chain and deterministically mints
  points without off-chain trust.
- **User-controlled disclosure**: Players decide when to decrypt results instead of relying on a centralized backend.

## Advantages

- Encrypted inputs and encrypted scores stored on-chain with FHEVM
- Deterministic scoring: correct answer set is validated in-contract without exposing values
- User-only decryption using the Zama relayer flow in the frontend
- Simple, auditable contract surface with explicit access checks and events
- Clear separation between read paths (viem) and write paths (ethers)

## Core Features

- Join game and create player state on-chain
- Four multiple-choice blockchain questions with options mapped to values 1-4
- Encrypted submission of answers using the Zama relayer SDK
- Encrypted scoring: +10 points when answers match the expected set (1, 2, 1, 1)
- Encrypted scoreboard and last result, decrypted only by the player
- Status panel showing join state, last submission time, and decrypted results

## How It Works

1. Player connects a wallet and joins the game
2. The UI encrypts answers locally using the Zama relayer SDK
3. The encrypted payload is sent to the smart contract
4. The contract compares encrypted answers against the encrypted correct set
5. If correct, it updates the encrypted score by +10 points
6. The player requests a user-specific decryption and displays plaintext results in the UI

## Tech Stack

- **Smart contracts**: Solidity 0.8.x, Hardhat, hardhat-deploy, @fhevm/hardhat-plugin
- **FHE layer**: Zama FHEVM libraries and relayer SDK
- **Frontend**: React + Vite + TypeScript
- **Wallet & chain**: RainbowKit, wagmi, viem (reads), ethers (writes)
- **Network**: Sepolia testnet
- **Testing**: Hardhat + chai matchers

## Project Structure

```
Silent-Chain/
├── contracts/            # Solidity contracts (FHEVM-enabled)
├── deploy/               # Hardhat deploy scripts
├── tasks/                # Hardhat tasks (join/submit/decrypt)
├── test/                 # Contract tests
├── ui/                   # React frontend (Vite)
└── README.md
```

## Contract Overview

- **Contract**: `SilentChainQuiz`
- **Join flow**: `joinGame()` initializes encrypted score and status
- **Submission**: `submitAnswers()` accepts 4 encrypted answers + proof
- **Verification**: Compares against encrypted correct set `(1, 2, 1, 1)`
- **Scoring**: Adds encrypted +10 points on correct submission
- **Read methods**: `isPlayer`, `getScore`, `getLastResult`, `getLastSubmittedAt`
- **Events**: `PlayerJoined`, `QuizSubmitted`

## Frontend Overview

- Uses RainbowKit + wagmi for wallet connection
- Reads encrypted data with viem (`useReadContract`)
- Writes encrypted data with ethers (`Contract` + signer)
- Encrypts answers and decrypts results via the Zama relayer SDK
- Targets Sepolia only; no localhost network usage in the UI

## Configuration

### Smart Contract Environment Variables

Create a `.env` file in the repository root with the following keys:

- `INFURA_API_KEY` (required for Sepolia RPC)
- `PRIVATE_KEY` (required for deployment, do not use a mnemonic)
- `ETHERSCAN_API_KEY` (optional, for verification)

### Frontend Configuration

The frontend does not use environment variables.

- Update WalletConnect project ID in `ui/src/config/wagmi.ts`
- Update contract address in `ui/src/config/contracts.ts`
- Replace the ABI in `ui/src/config/contracts.ts` with the generated ABI from
  `deployments/sepolia` after deployment

## Local Development (Contracts)

1. Install root dependencies:

   ```bash
   npm install
   ```

2. Compile and run tests:

   ```bash
   npm run compile
   npm run test
   ```

3. Deploy to local Hardhat node (for contract validation only):

   ```bash
   npx hardhat node
   npx hardhat deploy --network hardhat
   ```

## Deploy to Sepolia

1. Ensure `.env` is set with `INFURA_API_KEY` and `PRIVATE_KEY`
2. Run deployment:

   ```bash
   npx hardhat deploy --network sepolia
   ```

3. (Optional) Verify:

   ```bash
   npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
   ```

## Hardhat Tasks

- `npx hardhat --network sepolia task:address`
- `npx hardhat --network sepolia task:join`
- `npx hardhat --network sepolia task:submit --a1 1 --a2 2 --a3 1 --a4 1`
- `npx hardhat --network sepolia task:decrypt-score`

## Frontend Development (UI)

1. Install UI dependencies:

   ```bash
   npm install
   ```

2. Start the Vite dev server:

   ```bash
   npm run dev
   ```

3. Open the UI, connect a wallet on Sepolia, and use the quiz

## Privacy and Security Model

- All answers are encrypted before hitting the chain
- The correct answer set is compared in encrypted form, preventing leakage
- Scores and last results are stored encrypted and readable only by the player
- Timestamps are public metadata for UI UX (last submission time)
- No centralized backend stores plaintext answers or scores

## Constraints and Conventions

- Frontend must not use environment variables, localhost networks, localStorage, or JSON files
- ABI used by the frontend must be copied from `deployments/sepolia`
- Use ethers for contract writes and viem for contract reads in the UI
- Keep contract/view functions free of `msg.sender` address dependency
- All code, comments, and docs remain in English

## Future Roadmap

- Support multiple quiz sets and dynamic question rotation
- Add time-limited rounds and seasonal leaderboards
- Extend rewards to NFT or ERC-20 incentives (encrypted balance options)
- Add multi-chain support (additional FHEVM-enabled networks)
- Improve UI telemetry around encryption status and transaction progress
- Expand quiz content while preserving encrypted verification guarantees

## License

BSD-3-Clause-Clear. See `LICENSE` for details.
