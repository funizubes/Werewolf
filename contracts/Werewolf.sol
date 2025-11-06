pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract WerewolfGame is ZamaEthereumConfig {
    // Game configuration parameters
    struct GameConfig {
        uint8 playerCount;
        uint8 werewolfCount;
        uint8 seerCount;
        uint8 witchCount;
        uint8 hunterCount;
        uint8 villagerCount;
        uint8 guardCount;
    }

    // Player data structure
    struct Player {
        address playerAddress;
        euint32 encryptedRole;
        bool isAlive;
        bool isVerified;
        uint32 decryptedRole;
    }

    // Game state structure
    struct GameState {
        mapping(address => Player) players;
        address[] playerAddresses;
        uint8 currentDay;
        bool gameActive;
        bool nightPhase;
        uint256 roundTimeout;
    }

    // Game events
    event GameCreated(uint256 gameId, address creator);
    event PlayerJoined(uint256 gameId, address player);
    event RoleRevealed(uint256 gameId, address player, uint32 role);
    event NightAction(uint256 gameId, address player, uint8 actionType, address target);
    event DayVote(uint256 gameId, address player, address target);
    event PlayerEliminated(uint256 gameId, address player);
    event GameEnded(uint256 gameId, uint8 winner);

    // Game storage
    mapping(uint256 => GameState) public games;
    mapping(uint256 => GameConfig) public gameConfigs;
    uint256 public nextGameId = 1;

    // Modifiers
    modifier gameExists(uint256 gameId) {
        require(gameConfigs[gameId].playerCount > 0, "Game does not exist");
        _;
    }

    modifier isPlayerInGame(uint256 gameId, address player) {
        require(games[gameId].players[player].playerAddress != address(0), "Player not in game");
        _;
    }

    modifier isGameActive(uint256 gameId) {
        require(games[gameId].gameActive, "Game is not active");
        _;
    }

    modifier isNightPhase(uint256 gameId) {
        require(games[gameId].nightPhase, "Not night phase");
        _;
    }

    modifier isDayPhase(uint256 gameId) {
        require(!games[gameId].nightPhase, "Not day phase");
        _;
    }

    // Create a new game
    function createGame(
        uint8 playerCount,
        uint8 werewolfCount,
        uint8 seerCount,
        uint8 witchCount,
        uint8 hunterCount,
        uint8 guardCount
    ) external returns (uint256) {
        uint256 gameId = nextGameId++;
        require(playerCount >= 5, "Minimum 5 players required");
        require(
            werewolfCount + seerCount + witchCount + hunterCount + guardCount < playerCount,
            "Invalid role distribution"
        );

        gameConfigs[gameId] = GameConfig({
            playerCount: playerCount,
            werewolfCount: werewolfCount,
            seerCount: seerCount,
            witchCount: witchCount,
            hunterCount: hunterCount,
            villagerCount: playerCount - (werewolfCount + seerCount + witchCount + hunterCount + guardCount),
            guardCount: guardCount
        });

        games[gameId].gameActive = true;
        games[gameId].nightPhase = true;
        games[gameId].currentDay = 1;
        games[gameId].roundTimeout = block.timestamp + 1 days;

        emit GameCreated(gameId, msg.sender);
        return gameId;
    }

    // Join a game
    function joinGame(uint256 gameId) external gameExists(gameId) {
        require(games[gameId].playerAddresses.length < gameConfigs[gameId].playerCount, "Game is full");
        require(games[gameId].players[msg.sender].playerAddress == address(0), "Already joined");

        games[gameId].playerAddresses.push(msg.sender);
        games[gameId].players[msg.sender] = Player({
            playerAddress: msg.sender,
            encryptedRole: euint32(0),
            isAlive: true,
            isVerified: false,
            decryptedRole: 0
        });

        if (games[gameId].playerAddresses.length == gameConfigs[gameId].playerCount) {
            _assignRoles(gameId);
        }

        emit PlayerJoined(gameId, msg.sender);
    }

    // Assign roles to players
    function _assignRoles(uint256 gameId) private {
        // Role assignment logic would go here
        // This would typically involve shuffling and assigning roles based on game configuration
        // For simplicity, we'll just mark roles as assigned
        for (uint8 i = 0; i < games[gameId].playerAddresses.length; i++) {
            address player = games[gameId].playerAddresses[i];
            games[gameId].players[player].encryptedRole = _generateEncryptedRole(); // Placeholder
            FHE.makePubliclyDecryptable(games[gameId].players[player].encryptedRole);
        }
    }

    // Placeholder for encrypted role generation
    function _generateEncryptedRole() private view returns (euint32) {
        return euint32(0); // Actual implementation would generate encrypted role
    }

    // Reveal player role
    function revealRole(
        uint256 gameId,
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external gameExists(gameId) isPlayerInGame(gameId, msg.sender) {
        Player storage player = games[gameId].players[msg.sender];
        require(!player.isVerified, "Role already revealed");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(player.encryptedRole);

        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
        uint32 decodedRole = abi.decode(abiEncodedClearValue, (uint32));

        player.decryptedRole = decodedRole;
        player.isVerified = true;

        emit RoleRevealed(gameId, msg.sender, decodedRole);
    }

    // Perform night action
    function nightAction(
        uint256 gameId,
        uint8 actionType,
        address target
    ) external gameExists(gameId) isGameActive(gameId) isNightPhase(gameId) isPlayerInGame(gameId, msg.sender) {
        require(games[gameId].players[msg.sender].isAlive, "Player is dead");
        require(games[gameId].players[target].isAlive, "Target is dead");

        // Actual night action logic would go here
        // This would involve role-specific actions and encrypted computations

        emit NightAction(gameId, msg.sender, actionType, target);
    }

    // Perform day vote
    function dayVote(
        uint256 gameId,
        address target
    ) external gameExists(gameId) isGameActive(gameId) isDayPhase(gameId) isPlayerInGame(gameId, msg.sender) {
        require(games[gameId].players[msg.sender].isAlive, "Player is dead");
        require(games[gameId].players[target].isAlive, "Target is dead");

        // Actual voting logic would go here
        // This would involve tallying votes and determining elimination

        emit DayVote(gameId, msg.sender, target);
    }

    // Eliminate player
    function eliminatePlayer(uint256 gameId, address player) private {
        games[gameId].players[player].isAlive = false;
        emit PlayerEliminated(gameId, player);
    }

    // End game
    function endGame(uint256 gameId, uint8 winner) private {
        games[gameId].gameActive = false;
        emit GameEnded(gameId, winner);
    }

    // Get player information
    function getPlayer(uint256 gameId, address player) external view gameExists(gameId) returns (
        bool isAlive,
        bool isVerified,
        uint32 decryptedRole
    ) {
        Player storage p = games[gameId].players[player];
        return (p.isAlive, p.isVerified, p.decryptedRole);
    }

    // Get all players in game
    function getAllPlayers(uint256 gameId) external view gameExists(gameId) returns (address[] memory) {
        return games[gameId].playerAddresses;
    }

    // Get game state
    function getGameState(uint256 gameId) external view gameExists(gameId) returns (
        uint8 currentDay,
        bool gameActive,
        bool nightPhase,
        uint256 roundTimeout
    ) {
        GameState storage state = games[gameId];
        return (state.currentDay, state.gameActive, state.nightPhase, state.roundTimeout);
    }
}

