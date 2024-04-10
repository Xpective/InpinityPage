document.addEventListener('DOMContentLoaded', () => {
    initializeWeb3();
    // Verbindet den "Wallet verbinden" Button mit der connectWallet Funktion
    document.querySelector('.cta-button.wallet-connect').addEventListener('click', connectWallet);
});

async function initializeWeb3() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        console.log("Web3 wurde erfolgreich initialisiert.");
    } else {
        alert("Bitte installiere MetaMask, um fortzufahren.");
    }
}

async function connectWallet() {
    try {
        const addressArray = await window.ethereum.request({ method: "eth_requestAccounts" });
        updateUIAfterWalletConnected(addressArray[0]);
    } catch (error) {
        alert(`Fehler beim Verbinden des Wallets: ${error.message}`);
    }
}

// Diese Funktion aktualisiert die UI nach dem erfolgreichen Verbinden des Wallets
function updateUIAfterWalletConnected(address) {
    document.getElementById('wallet-address').textContent = address || "Nicht verbunden";
    // Ruft den Saldo für ETH ab und aktualisiert die UI entsprechend
    getBalance('ETH', address).then(balance => {
        document.getElementById('eth-balance').textContent = balance + ' ETH';
    });
    // Für BNB und MATIC müssen entsprechende Netzwerkwechsel und Abfragen hinzugefügt werden
}

async function getBalance(token, address) {
    if (!['ETH', 'BNB', 'MATIC'].includes(token)) {
        console.error("Token nicht unterstützt");
        return 'Token nicht unterstützt';
    }

    // Der Netzwerkwechsel für BNB und MATIC wird hier notwendig
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