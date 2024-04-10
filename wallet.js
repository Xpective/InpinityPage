// Importieren von Web3 - Stelle sicher, dass du Web3.js richtig in deine Seite eingebunden hast.
// Dieser Code geht davon aus, dass Web3.js bereits eingebunden ist.
let web3;

// Funktion zur Initialisierung von Web3
function initializeWeb3() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
    } else {
        console.error("MetaMask ist nicht installiert");
    }
}
async function switchToBinanceSmartChain() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }], // 0x38 ist die Chain ID für Binance Smart Chain Mainnet
        });
    } catch (error) {
        console.error('Fehler beim Wechseln des Netzwerks:', error);
    }
}

// Ähnlich für Polygon (MATIC) mit der entsprechenden chainId
// Funktion zum Verbinden des Wallets
async function connectWallet() {
    try {
        const addressArray = await window.ethereum.request({ method: "eth_requestAccounts" });
        return {
            status: "Wallet verbunden",
            address: addressArray[0],
        };
    } catch (err) {
        return {
            address: "",
            status: "Fehler beim Verbinden: " + err.message,
        };
    }
}

// Funktion zum Abrufen des Saldos für ETH, BNB und MATIC
async function getBalance(token, address) {
    if (token === 'ETH' || token === 'BNB' || token === 'MATIC') {
        // Für BNB und MATIC musst du das Netzwerk entsprechend wechseln.
        try {
            const balance = await web3.eth.getBalance(address);
            const formattedBalance = web3.utils.fromWei(balance, 'ether');
            return formattedBalance;
        } catch (error) {
            console.error(`Fehler beim Abrufen des Saldos für ${token}:`, error);
            return 'Fehler beim Abrufen des Saldos';
        }
    } else {
        console.error("Token nicht unterstützt");
        return 'Token nicht unterstützt';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    initializeWeb3();
    
    const walletButton = document.querySelector('.cta-button.wallet-connect');
    walletButton.addEventListener('click', async () => {
        const walletResponse = await connectWallet();
        if (walletResponse.address) {
            document.getElementById('wallet-address').textContent = walletResponse.address;
            
            // Abrufen und Anzeigen des Saldos für ETH
            document.getElementById('eth-balance').textContent = await getBalance('ETH', walletResponse.address) + ' ETH';
            
            // Für BNB und MATIC musst du das entsprechende Netzwerk in MetaMask oder deinem Wallet auswählen
            // und den korrekten Web3-Provider initialisieren, bevor du getBalance aufrufst.
        } else {
            alert(walletResponse.status);
        }
    });
});