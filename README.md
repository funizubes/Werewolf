# WerewolfZama: A Privacy-Preserving Werewolf Game

WerewolfZama is an innovative, privacy-preserving gaming experience powered by Zama's Fully Homomorphic Encryption (FHE) technology. This game transforms the classic social deduction game, Werewolf, by ensuring that players' identities and night actions remain confidential, eliminating cheating through secure contract enforcement. 

## The Problem

In traditional Werewolf games, players often have to reveal their roles or intentions, leading to potential manipulation and betrayal. Moreover, the game's reliance on trust among participants can result in unfair advantages and breaches of integrity. In online settings, the use of cleartext data can expose sensitive information, making players vulnerable to scrutiny and deception. Cleartext data is fundamentally dangerous as it can be intercepted, manipulated, or misused by malicious actors, eroding trust and enjoyment.

## The Zama FHE Solution

Zama provides a revolutionary solution to these privacy concerns through its FHE technology, enabling computation on encrypted data. This means that players can engage in the game without ever disclosing their identities or actions in a readable format. Using the fhevm, WerewolfZama processes encrypted inputs to determine outcomes, ensuring fairness and integrity among all participants. 

With Zama's FHE capabilities, we ensure that:

- Players' identities are encrypted, safeguarding them from exposure.
- Night actions are processed securely without revealing players’ strategies.
- The game outcomes are computed in a privacy-preserving manner, ensuring no one has a privileged view ("no god mode") over the game state.

## Key Features

- 🕵️‍♂️ **Secure Identity Encryption:** Players' identities remain encrypted, preventing data leaks.
- 🌙 **Confidential Night Actions:** Players can perform actions at night without fear of exposure or tampering.
- ⚖️ **Fair Play:** The smart contract adjudicates game results based purely on encrypted data, ensuring no one player has an unfair advantage.
- 🎲 **Immersive Experience:** A goth-inspired, mysterious atmosphere enhances the gameplay, making the experience thrilling and engaging.
- 📖 **Round Table and Logs:** Features log functionalities to enable players to review actions and decisions taken throughout the game while maintaining privacy.

## Technical Architecture & Stack

The architecture of WerewolfZama leverages several cutting-edge technologies:

- **Zama FHE**: The core engine enabling encryption and processing of game data.
- **fhevm**: Used for executing smart contracts with encrypted data.
- **Blockchain**: Provides a decentralized framework for securing player actions and outcomes.

The technical stack includes:

- **Smart Contract**: Written in Solidity to manage game logic and interactions.
- **Zama Libraries**: Dependencies such as fhevm for FHE operations and encryption handling.
- **Frontend Framework**: To create an engaging user interface for players.

## Smart Contract / Core Logic

The following is a simplified smart contract snippet illustrating how Zama's FHE capabilities can be used in the context of WerewolfZama:

```solidity
pragma solidity ^0.8.0;

import "Zama/FHE.sol";

contract WerewolfZamaGame {
    uint64 private gameId;
    mapping(address => uint64) private playerIds;

    function encryptIdentity(string memory playerRole) public view returns (uint64) {
        // Encrypt player's role using TFHE
        return TFHE.encrypt(playerRole);
    }

    function processNightAction(uint64 encryptedAction) public {
        // Process encrypted night action securely
        uint64 result = TFHE.add(encryptedAction, gameId);
        // Logic for determining game outcome
        // ...
    }
}
```

## Directory Structure

The project follows a structured layout for clarity and ease of use:

```
WerewolfZama/
├── contracts/
│   └── WerewolfZamaGame.sol
├── src/
│   ├── main.py
│   └── game_logic.py
├── tests/
│   └── test_game.py
├── package.json
└── requirements.txt
```

## Installation & Setup

To set up the WerewolfZama project, follow these steps:

### Prerequisites

Ensure you have the following installed:

- Node.js (for npm package management)
- Python (for backend functionality)
- Zama FHE libraries

### Installation Steps

1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Install the required dependencies:

For JavaScript (Smart Contract):
```bash
npm install fhevm
```

For Python (Game Logic):
```bash
pip install concrete-ml
```

## Build & Run

After setting up the environment, you can build and run the project using the following commands:

### For Smart Contract

To compile the smart contract, use:
```bash
npx hardhat compile
```

### For Game Logic

To run the main game logic:
```bash
python main.py
```

## Acknowledgements

We would like to express our profound gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their innovative technology empowers developers to create privacy-preserving applications, driving forward the future of secure computing and trust in applications.

---

With WerewolfZama, dive into a world where strategy and deceit intertwine, all under the protective cloak of Zama’s cutting-edge encryption technology. Join us on this revolutionary journey, where your secrets remain yours, and the game is fair for everyone!

