// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, euint32, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Silent Chain Quiz
/// @notice Encrypted quiz game that awards encrypted points for correct answers.
contract SilentChainQuiz is ZamaEthereumConfig {
    mapping(address => bool) private _players;
    mapping(address => euint32) private _scores;
    mapping(address => ebool) private _lastResult;
    mapping(address => uint256) private _lastSubmittedAt;

    event PlayerJoined(address indexed player);
    event QuizSubmitted(address indexed player, uint256 timestamp);

    /// @notice Join the quiz game.
    function joinGame() external {
        require(!_players[msg.sender], "Player already joined");

        _players[msg.sender] = true;
        _scores[msg.sender] = FHE.asEuint32(0);
        _lastResult[msg.sender] = FHE.asEbool(false);
        _lastSubmittedAt[msg.sender] = 0;

        FHE.allowThis(_scores[msg.sender]);
        FHE.allow(_scores[msg.sender], msg.sender);
        FHE.allowThis(_lastResult[msg.sender]);
        FHE.allow(_lastResult[msg.sender], msg.sender);

        emit PlayerJoined(msg.sender);
    }

    /// @notice Submit encrypted answers to the quiz.
    /// @param answer1 Encrypted answer to question 1.
    /// @param answer2 Encrypted answer to question 2.
    /// @param answer3 Encrypted answer to question 3.
    /// @param answer4 Encrypted answer to question 4.
    /// @param inputProof Proof for encrypted inputs.
    function submitAnswers(
        externalEuint8 answer1,
        externalEuint8 answer2,
        externalEuint8 answer3,
        externalEuint8 answer4,
        bytes calldata inputProof
    ) external {
        require(_players[msg.sender], "Player not joined");

        euint8 a1 = FHE.fromExternal(answer1, inputProof);
        euint8 a2 = FHE.fromExternal(answer2, inputProof);
        euint8 a3 = FHE.fromExternal(answer3, inputProof);
        euint8 a4 = FHE.fromExternal(answer4, inputProof);

        ebool q1 = FHE.eq(a1, FHE.asEuint8(1));
        ebool q2 = FHE.eq(a2, FHE.asEuint8(2));
        ebool q3 = FHE.eq(a3, FHE.asEuint8(1));
        ebool q4 = FHE.eq(a4, FHE.asEuint8(1));

        ebool allCorrect = FHE.and(FHE.and(q1, q2), FHE.and(q3, q4));

        euint32 reward = FHE.asEuint32(10);
        euint32 currentScore = _scores[msg.sender];
        euint32 updatedScore = FHE.select(allCorrect, FHE.add(currentScore, reward), currentScore);

        _scores[msg.sender] = updatedScore;
        _lastResult[msg.sender] = allCorrect;
        _lastSubmittedAt[msg.sender] = block.timestamp;

        FHE.allowThis(_scores[msg.sender]);
        FHE.allow(_scores[msg.sender], msg.sender);
        FHE.allowThis(_lastResult[msg.sender]);
        FHE.allow(_lastResult[msg.sender], msg.sender);

        emit QuizSubmitted(msg.sender, block.timestamp);
    }

    /// @notice Check if a player has joined.
    function isPlayer(address player) external view returns (bool) {
        return _players[player];
    }

    /// @notice Get encrypted score for a player.
    function getScore(address player) external view returns (euint32) {
        return _scores[player];
    }

    /// @notice Get last result for a player.
    function getLastResult(address player) external view returns (ebool) {
        return _lastResult[player];
    }

    /// @notice Get last submission timestamp for a player.
    function getLastSubmittedAt(address player) external view returns (uint256) {
        return _lastSubmittedAt[player];
    }
}
