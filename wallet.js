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

async function updateUIAfterWalletConnected(address) {
    document.getElementById('wallet-address').textContent = address || "Nicht verbunden";
    const tokens = ['ETH', 'BNB', 'MATIC'];
    for (const token of tokens) {
        const balance = await getBalance(token, address);
        document.getElementById(`${token.toLowerCase()}-balance`).textContent = `${balance} ${token}`;
    }
}

async function getBalance(token, address) {
    if (!['ETH', 'BNB', 'MATIC'].includes(token)) {
        console.error("Token nicht unterstützt");
        return 'Token nicht unterstützt';
    }
    
    const networkIds = {
        'ETH': '0x1',
        'BNB': '0x38',
        'MATIC': '0x89'
    };
    
    await switchNetwork(networkIds[token]);

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
            try {
                // Versuch, das Netzwerk hinzuzufügen, falls es nicht vorhanden ist
                // Diese Funktionalität kann je nach Anwendungsfall erweitert werden
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: chainId,
                            // Weitere Parameter für das Netzwerk können hier hinzugefügt werden
                        },
                    ],
                });
            } catch (addError) {
                console.error(`Fehler beim Hinzufügen des Netzwerks: ${addError.message}`);
            }
        } else {
            console.error(`Fehler beim Wechseln des Netzwerks: ${error.message}`);
        }
    }
}