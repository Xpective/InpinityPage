// Initialisierung und Netzwerkmanagement
let web3;

async function initializeWeb3() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        console.log("Web3 wurde erfolgreich initialisiert.");
    } else {
        alert("Bitte installiere MetaMask, um fortzufahren.");
    }
}

async function switchNetwork(chainId) {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId }],
        });
    } catch (error) {
        if (error.code === 4902) {
            alert("Das benötigte Netzwerk ist nicht in MetaMask konfiguriert. Bitte füge es manuell hinzu.");
        } else {
            console.error(`Fehler beim Wechseln des Netzwerks: ${error.message}`);
        }
    }
}

// Wallet-Verbindung
async function connectWallet() {
    try {
        const addressArray = await window.ethereum.request({ method: "eth_requestAccounts" });
        updateUIAfterWalletConnected(addressArray[0]);
    } catch (error) {
        alert(`Fehler beim Verbinden des Wallets: ${error.message}`);
    }
}

// Saldo-Abruf
async function getBalance(token, address) {
    // Optimiere den Netzwerkwechsel
    if (token !== 'ETH') {
        const chainId = token === 'BNB' ? '0x38' : '0x89';
        await switchNetwork(chainId);
    }

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
    document.getElementById('wallet-address').textContent = address || "Nicht verbunden";
    ['ETH', 'BNB', 'MATIC'].forEach(async (token) => {
        const balance = await getBalance(token, address);
        document.getElementById(`${token.toLowerCase()}-balance`).textContent = balance + ` ${token}`;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeWeb3();
    document.querySelector('.cta-button.wallet-connect').addEventListener('click', connectWallet);
});