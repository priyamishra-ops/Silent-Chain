import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { Header } from './Header';
import '../styles/QuizApp.css';

type Question = {
  id: number;
  prompt: string;
  options: string[];
};

const QUESTIONS: Question[] = [
  {
    id: 1,
    prompt: 'What secures the order of blocks in a blockchain?',
    options: [
      'Each block hashes the previous block',
      'A single admin signs every block',
      'Daily backups on one server',
      'Manual auditing by validators',
    ],
  },
  {
    id: 2,
    prompt: 'What mechanism keeps a public blockchain in agreement?',
    options: [
      'Random voting without rules',
      'A consensus protocol like PoS or PoW',
      'Private email confirmations',
      'Centralized approval from a bank',
    ],
  },
  {
    id: 3,
    prompt: 'What does a smart contract do?',
    options: [
      'Executes code automatically when conditions are met',
      'Stores private keys in plaintext',
      'Manually approves every transaction',
      'Replaces the network consensus rules',
    ],
  },
  {
    id: 4,
    prompt: 'Why use FHE in an on-chain quiz?',
    options: [
      'It keeps answers encrypted while still checking correctness',
      'It makes transactions free forever',
      'It hides which chain you are on',
      'It replaces wallet signatures',
    ],
  },
];

const EMPTY_ANSWERS = Array.from({ length: QUESTIONS.length }, () => 0);

export function QuizApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: instanceLoading, error: instanceError } = useZamaInstance();

  const [answers, setAnswers] = useState<number[]>(EMPTY_ANSWERS);
  const [isJoining, setIsJoining] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [scorePlain, setScorePlain] = useState<number | null>(null);
  const [lastResultPlain, setLastResultPlain] = useState<boolean | null>(null);

  const { data: isPlayerData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'isPlayer',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isPlayer = Boolean(isPlayerData);

  const { data: scoreHandle } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getScore',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isPlayer },
  });

  const { data: lastResultHandle } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getLastResult',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isPlayer },
  });

  const { data: lastSubmittedAt } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getLastSubmittedAt',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isPlayer },
  });

  const answeredCount = useMemo(() => answers.filter((answer) => answer > 0).length, [answers]);
  const allAnswered = answeredCount === QUESTIONS.length;
  const lastSubmitDisplay =
    typeof lastSubmittedAt === 'bigint' && lastSubmittedAt > 0n
      ? new Date(Number(lastSubmittedAt) * 1000).toLocaleString()
      : 'No submissions yet';

  const handleSelect = (questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  const handleJoin = async () => {
    setErrorMessage('');
    setStatusMessage('');

    if (!signerPromise) {
      setErrorMessage('Connect your wallet to join the game.');
      return;
    }

    setIsJoining(true);
    try {
      const signer = await signerPromise;
      const quizContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await quizContract.joinGame();
      setStatusMessage('Joining the game...');
      await tx.wait();
      setStatusMessage('You joined the quiz. You can submit answers now.');
    } catch (error) {
      setErrorMessage(`Failed to join: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    setStatusMessage('');

    if (!instance || !address || !signerPromise) {
      setErrorMessage('Wallet or encryption service is not ready.');
      return;
    }

    if (!isPlayer) {
      setErrorMessage('Join the game before submitting answers.');
      return;
    }

    if (!allAnswered) {
      setErrorMessage('Answer all questions before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      answers.forEach((answer) => input.add8(answer));
      const encryptedInput = await input.encrypt();

      const signer = await signerPromise;
      const quizContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await quizContract.submitAnswers(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof,
      );
      setStatusMessage('Submitting encrypted answers...');
      await tx.wait();
      setStatusMessage('Submission confirmed. Decrypt your results below.');
    } catch (error) {
      setErrorMessage(`Submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecrypt = async () => {
    if (!instance || !address || !signerPromise || !scoreHandle || !lastResultHandle) {
      setErrorMessage('Missing data for decryption.');
      return;
    }

    setIsDecrypting(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const signer = await signerPromise;
      const keypair = instance.generateKeypair();
      const handles = [
        { handle: scoreHandle as string, contractAddress: CONTRACT_ADDRESS },
        { handle: lastResultHandle as string, contractAddress: CONTRACT_ADDRESS },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handles,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedScore = result[scoreHandle as string];
      const decryptedResult = result[lastResultHandle as string];

      setScorePlain(Number(decryptedScore ?? 0));
      setLastResultPlain(Number(decryptedResult ?? 0) === 1);
      setStatusMessage('Decryption complete.');
    } catch (error) {
      setErrorMessage(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDecrypting(false);
    }
  };

  const resetAnswers = () => {
    setAnswers(EMPTY_ANSWERS);
  };

  return (
    <div className="quiz-app">
      <Header />
      <div className="quiz-content">
        <section className="hero">
          <div>
            <p className="hero-kicker">Silent Chain</p>
            <h2 className="hero-title">Encrypted knowledge sprint</h2>
            <p className="hero-subtitle">
              Submit your answers with homomorphic encryption. Only you can decrypt your score.
            </p>
          </div>
          <div className="hero-badge">
            <span>Reward</span>
            <strong>10 encrypted points</strong>
          </div>
        </section>

        <div className="quiz-grid">
          <section className="quiz-card">
            <div className="card-header">
              <div>
                <h3>Quiz</h3>
                <p>Answer all four questions. Each option maps to values 1-4.</p>
              </div>
              <div className="answer-count">
                {answeredCount}/{QUESTIONS.length} answered
              </div>
            </div>

            <div className="question-list">
              {QUESTIONS.map((question, index) => (
                <div
                  className="question-block"
                  key={question.id}
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <p className="question-prompt">
                    <span>Q{question.id}.</span> {question.prompt}
                  </p>
                  <div className="options-grid">
                    {question.options.map((option, optionIndex) => {
                      const optionValue = optionIndex + 1;
                      const checked = answers[index] === optionValue;
                      return (
                        <label
                          key={`${question.id}-${optionValue}`}
                          className={`option-card ${checked ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            checked={checked}
                            onChange={() => handleSelect(index, optionValue)}
                          />
                          <span className="option-index">{optionValue}</span>
                          <span className="option-text">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="actions-row">
              <button type="button" className="ghost-button" onClick={resetAnswers}>
                Reset
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!allAnswered || isSubmitting || instanceLoading || !isConnected}
                onClick={handleSubmit}
              >
                {instanceLoading ? 'Loading encryption...' : isSubmitting ? 'Submitting...' : 'Submit encrypted answers'}
              </button>
            </div>
            <p className="footnote">
              Answers are encrypted with the Zama relayer before they are sent on-chain.
            </p>
          </section>

          <aside className="status-column">
            <div className="status-card">
              <h4>Player status</h4>
              <div className="status-row">
                <span>Wallet</span>
                <strong>{isConnected ? 'Connected' : 'Not connected'}</strong>
              </div>
              <div className="status-row">
                <span>Joined</span>
                <strong>{isPlayer ? 'Yes' : 'No'}</strong>
              </div>
              <div className="status-row">
                <span>Last submit</span>
                <strong>{lastSubmitDisplay}</strong>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={handleJoin}
                disabled={isJoining || !isConnected || isPlayer}
              >
                {isPlayer ? 'Already joined' : isJoining ? 'Joining...' : 'Join the game'}
              </button>
              {instanceError && <p className="status-error">{instanceError}</p>}
            </div>

            <div className="status-card highlight-card">
              <h4>Encrypted scoreboard</h4>
              <div className="score-line">
                <span>Encrypted score handle</span>
                <code>{scoreHandle ? String(scoreHandle).slice(0, 10) + '...' : '--'}</code>
              </div>
              <div className="score-line">
                <span>Encrypted last result</span>
                <code>{lastResultHandle ? String(lastResultHandle).slice(0, 10) + '...' : '--'}</code>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={handleDecrypt}
                disabled={!isPlayer || isDecrypting || !scoreHandle || !lastResultHandle}
              >
                {isDecrypting ? 'Decrypting...' : 'Decrypt my results'}
              </button>
              <div className="decrypted-results">
                <div>
                  <span>Score</span>
                  <strong>{scorePlain !== null ? scorePlain : '--'}</strong>
                </div>
                <div>
                  <span>Last result</span>
                  <strong>
                    {lastResultPlain === null ? '--' : lastResultPlain ? 'Correct' : 'Incorrect'}
                  </strong>
                </div>
              </div>
            </div>

            {(statusMessage || errorMessage) && (
              <div className={`status-card ${errorMessage ? 'error-card' : 'success-card'}`}>
                <h4>{errorMessage ? 'Action needed' : 'Status update'}</h4>
                <p>{errorMessage || statusMessage}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
