// Initialisierung und Netzwerkmanagement
let web3;

async function initializeWeb3() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
    } else {
        alert("Bitte installiere MetaMask, um fortzufahren.");
        console.error("MetaMask ist nicht installiert");
    }
}

async function switchNetwork(chainId) {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId }],
        });
    } catch (error) {
        console.error(`Fehler beim Wechseln des Netzwerks: ${error.message}`);
        if (error.code === 4902) {
            alert("Das benötigte Netzwerk ist nicht in MetaMask konfiguriert.");
        }
    }
}

// Wallet-Verbindung
async function connectWallet() {
    try {
        const addressArray = await window.ethereum.request({ method: "eth_requestAccounts" });
        updateUIAfterWalletConnected(addressArray[0]);
        return addressArray[0];
    } catch (err) {
        alert(`Fehler beim Verbinden des Wallets: ${err.message}`);
        console.error("Fehler beim Verbinden des Wallets:", err);
        return null;
    }
}

// Saldo-Abruf
async function getBalance(token, address) {
    if (!['ETH', 'BNB', 'MATIC'].includes(token)) {
        console.error("Token nicht unterstützt");
        return 'Token nicht unterstützt';
    }
    
    // Netzwerkwechsel für BNB und MATIC falls nötig
    const chainId = token === 'ETH' ? '0x1' : token === 'BNB' ? '0x38' : '0x89';
    await switchNetwork(chainId);
    
    try {
        const balance = await web3.eth.getBalance(address);
        return web3.utils.fromWei(balance, 'ether');
    } catch (error) {
        console.error(`Fehler beim Abrufen des Saldos für ${token}:`, error);
        return 'Fehler beim Abrufen des Saldos';
    }
}

// UI-Aktualisierung
function updateUIAfterWalletConnected(address) {
    document.getElementById('wallet-address').textContent = address;
    getBalance('ETH', address).then(balance => {
        document.getElementById('eth-balance').textContent = balance + ' ETH';
    });
    // Wiederholen für BNB und MATIC, falls erforderlich
}

document.addEventListener('DOMContentLoaded', () => {
    initializeWeb3();
    document.querySelector('.cta-button.wallet-connect').addEventListener('click', connectWallet);
});