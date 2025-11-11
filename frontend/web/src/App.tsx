import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface GameData {
  id: string;
  name: string;
  encryptedValue: any;
  publicValue1: number;
  publicValue2: number;
  description: string;
  creator: string;
  timestamp: number;
  isVerified: boolean;
  decryptedValue: number;
  role: string;
  status: string;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<GameData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingGame, setCreatingGame] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newGameData, setNewGameData] = useState({ 
    name: "", 
    role: "werewolf", 
    vote: 0,
    description: "" 
  });
  const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [playerStats, setPlayerStats] = useState({ total: 0, verified: 0, active: 0 });
  const [operationHistory, setOperationHistory] = useState<string[]>([]);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const addToHistory = (message: string) => {
    setOperationHistory(prev => [message, ...prev.slice(0, 9)]);
  };

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const gamesList: GameData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          gamesList.push({
            id: businessId,
            name: businessData.name,
            encryptedValue: null,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            description: businessData.description,
            creator: businessData.creator,
            timestamp: Number(businessData.timestamp),
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0,
            role: Number(businessData.publicValue1) === 1 ? "Werewolf" : "Villager",
            status: businessData.isVerified ? "Verified" : "Encrypted"
          });
        } catch (e) {
          console.error('Error loading game data:', e);
        }
      }
      
      setGames(gamesList);
      setPlayerStats({
        total: gamesList.length,
        verified: gamesList.filter(g => g.isVerified).length,
        active: gamesList.filter(g => !g.isVerified).length
      });
      addToHistory(`Loaded ${gamesList.length} game records`);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createGame = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingGame(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating encrypted game record..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const roleValue = newGameData.role === "werewolf" ? 1 : 0;
      const businessId = `game-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, roleValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newGameData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        roleValue,
        newGameData.vote,
        newGameData.description || "Werewolf Game Player"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Game record created successfully!" });
      addToHistory(`Created new game record: ${newGameData.name}`);
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewGameData({ name: "", role: "werewolf", vote: 0, description: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingGame(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Role already verified on-chain" });
        addToHistory(`Role verified: ${storedValue === 1 ? "Werewolf" : "Villager"}`);
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      addToHistory(`Decrypted role: ${clearValue === 1 ? "Werewolf" : "Villager"}`);
      
      setTransactionStatus({ visible: true, status: "success", message: "Role decrypted and verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Role is already verified on-chain" });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const callIsAvailable = async () => {
    if (!isConnected) return;
    
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const result = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available and ready!" });
      addToHistory("Checked contract availability: Ready");
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const renderStatsPanel = () => {
    return (
      <div className="stats-panels">
        <div className="stat-panel">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{playerStats.total}</div>
            <div className="stat-label">Total Players</div>
          </div>
        </div>
        
        <div className="stat-panel">
          <div className="stat-icon">🔓</div>
          <div className="stat-content">
            <div className="stat-value">{playerStats.verified}</div>
            <div className="stat-label">Verified Roles</div>
          </div>
        </div>
        
        <div className="stat-panel">
          <div className="stat-icon">🔐</div>
          <div className="stat-content">
            <div className="stat-value">{playerStats.active}</div>
            <div className="stat-label">Encrypted</div>
          </div>
        </div>
      </div>
    );
  };

  const renderRoleChart = () => {
    const werewolves = games.filter(g => g.isVerified && g.decryptedValue === 1).length;
    const villagers = games.filter(g => g.isVerified && g.decryptedValue === 0).length;
    const total = werewolves + villagers || 1;
    
    return (
      <div className="role-chart">
        <h3>Role Distribution</h3>
        <div className="chart-bars">
          <div className="chart-bar">
            <div className="bar-label">Werewolves</div>
            <div className="bar-container">
              <div 
                className="bar-fill werewolf" 
                style={{ width: `${(werewolves / total) * 100}%` }}
              >
                <span className="bar-value">{werewolves}</span>
              </div>
            </div>
          </div>
          <div className="chart-bar">
            <div className="bar-label">Villagers</div>
            <div className="bar-container">
              <div 
                className="bar-fill villager" 
                style={{ width: `${(villagers / total) * 100}%` }}
              >
                <span className="bar-value">{villagers}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo-section">
            <div className="logo-icon">🐺</div>
            <h1>WerewolfZama</h1>
            <span className="logo-subtitle">FHE Privacy Game</span>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🔐</div>
            <h2>Connect to Enter the Encrypted Village</h2>
            <p>Your werewolf role is encrypted with Zama FHE technology for complete privacy protection</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect your wallet to initialize FHE system</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Get your encrypted role assignment</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Play with guaranteed privacy and fairness</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing your werewolf identity</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted game data...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">🐺</div>
          <div>
            <h1>WerewolfZama</h1>
            <span className="logo-subtitle">FHE Privacy Werewolf Game</span>
          </div>
        </div>
        
        <div className="header-actions">
          <button onClick={callIsAvailable} className="status-btn">
            Check Status
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn"
          >
            + New Player
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="sidebar">
          <div className="sidebar-section">
            <h3>Game Stats</h3>
            {renderStatsPanel()}
          </div>
          
          <div className="sidebar-section">
            <h3>Role Analytics</h3>
            {renderRoleChart()}
          </div>
          
          <div className="sidebar-section">
            <h3>Operation History</h3>
            <div className="history-list">
              {operationHistory.map((op, index) => (
                <div key={index} className="history-item">
                  <span className="history-time">{new Date().toLocaleTimeString()}</span>
                  <span className="history-text">{op}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="content-area">
          <div className="content-header">
            <h2>Encrypted Player Registry</h2>
            <div className="header-actions">
              <button 
                onClick={loadData} 
                className="refresh-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "🔄" : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="games-grid">
            {games.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🐺</div>
                <p>No players registered yet</p>
                <button 
                  className="create-btn" 
                  onClick={() => setShowCreateModal(true)}
                >
                  Register First Player
                </button>
              </div>
            ) : (
              games.map((game) => (
                <div 
                  className={`game-card ${game.isVerified ? 'verified' : 'encrypted'} ${selectedGame?.id === game.id ? 'selected' : ''}`}
                  key={game.id}
                  onClick={() => setSelectedGame(game)}
                >
                  <div className="card-header">
                    <div className="player-name">{game.name}</div>
                    <div className={`status-badge ${game.status.toLowerCase()}`}>
                      {game.status}
                    </div>
                  </div>
                  
                  <div className="card-content">
                    <div className="role-info">
                      <span className="role-label">Role:</span>
                      <span className={`role-value ${game.role.toLowerCase()}`}>
                        {game.isVerified ? game.role : '🔒 Encrypted'}
                      </span>
                    </div>
                    
                    <div className="game-meta">
                      <span>Vote: {game.publicValue2}</span>
                      <span>{new Date(game.timestamp * 1000).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="player-address">
                      {game.creator.substring(0, 8)}...{game.creator.substring(36)}
                    </div>
                  </div>
                  
                  <div className="card-actions">
                    <button 
                      className={`action-btn ${game.isVerified ? 'verified' : 'decrypt'}`}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await decryptData(game.id);
                      }}
                      disabled={isDecrypting}
                    >
                      {game.isVerified ? '✅ Verified' : isDecrypting ? '🔓...' : 'Reveal Role'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateGame 
          onSubmit={createGame} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingGame} 
          gameData={newGameData} 
          setGameData={setNewGameData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedGame && (
        <GameDetailModal 
          game={selectedGame} 
          onClose={() => setSelectedGame(null)} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(selectedGame.id)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && '✓'}
              {transactionStatus.status === "error" && '✗'}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateGame: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  gameData: any;
  setGameData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, gameData, setGameData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setGameData({ ...gameData, [name]: value });
  };

  return (
    <div className="modal-overlay">
      <div className="create-game-modal">
        <div className="modal-header">
          <h2>Register New Player</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <div className="notice-icon">🔐</div>
            <div>
              <strong>FHE Encrypted Role Assignment</strong>
              <p>Your werewolf/villager role will be encrypted with Zama FHE technology</p>
            </div>
          </div>
          
          <div className="form-group">
            <label>Player Name *</label>
            <input 
              type="text" 
              name="name" 
              value={gameData.name} 
              onChange={handleChange} 
              placeholder="Enter player name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Role Assignment *</label>
            <select name="role" value={gameData.role} onChange={handleChange}>
              <option value="werewolf">Werewolf 🐺</option>
              <option value="villager">Villager 👨‍🌾</option>
            </select>
            <div className="data-type-label">FHE Encrypted Integer (0/1)</div>
          </div>
          
          <div className="form-group">
            <label>Initial Vote Count</label>
            <input 
              type="number" 
              name="vote" 
              value={gameData.vote} 
              onChange={handleChange} 
              placeholder="Enter vote count..." 
              min="0"
            />
            <div className="data-type-label">Public Data</div>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <input 
              type="text" 
              name="description" 
              value={gameData.description} 
              onChange={handleChange} 
              placeholder="Optional description..." 
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !gameData.name} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting Role..." : "Register Player"}
          </button>
        </div>
      </div>
    </div>
  );
};

const GameDetailModal: React.FC<{
  game: GameData;
  onClose: () => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ game, onClose, isDecrypting, decryptData }) => {
  return (
    <div className="modal-overlay">
      <div className="game-detail-modal">
        <div className="modal-header">
          <h2>Player Details</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <label>Player Name</label>
              <div className="detail-value">{game.name}</div>
            </div>
            
            <div className="detail-item">
              <label>Role Status</label>
              <div className={`detail-value ${game.status.toLowerCase()}`}>
                {game.status}
              </div>
            </div>
            
            <div className="detail-item">
              <label>Assigned Role</label>
              <div className={`detail-value role ${game.role.toLowerCase()}`}>
                {game.isVerified ? (
                  <>
                    {game.role} 
                    <span className="role-badge">{game.decryptedValue === 1 ? '🐺' : '👨‍🌾'}</span>
                  </>
                ) : (
                  '🔒 Encrypted (FHE Protected)'
                )}
              </div>
            </div>
            
            <div className="detail-item">
              <label>Vote Count</label>
              <div className="detail-value">{game.publicValue2}</div>
            </div>
            
            <div className="detail-item">
              <label>Player Address</label>
              <div className="detail-value address">{game.creator}</div>
            </div>
            
            <div className="detail-item">
              <label>Registration Date</label>
              <div className="detail-value">{new Date(game.timestamp * 1000).toLocaleString()}</div>
            </div>
          </div>
          
          <div className="fhe-explanation">
            <h3>FHE Protection Process</h3>
            <div className="process-steps">
              <div className="process-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <strong>Role Encryption</strong>
                  <p>Player role encrypted using Zama FHE before storage</p>
                </div>
              </div>
              <div className="process-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <strong>On-chain Storage</strong>
                  <p>Encrypted data stored securely on blockchain</p>
                </div>
              </div>
              <div className="process-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <strong>Zero-Knowledge Reveal</strong>
                  <p>Role revealed only when needed with proof verification</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {!game.isVerified && (
            <button 
              onClick={decryptData} 
              disabled={isDecrypting}
              className="reveal-btn"
            >
              {isDecrypting ? "Decrypting Role..." : "Reveal Encrypted Role"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

