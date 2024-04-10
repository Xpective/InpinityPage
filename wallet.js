async function connectWallet() {
    if (window.ethereum) { // Überprüfen, ob MetaMask installiert ist
        try {
            const addressArray = await window.ethereum.request({
                method: "eth_requestAccounts",
            });
            const obj = {
                status: "👆🏽 Write a message in the text-field above.",
                address: addressArray[0],
            };
            return obj;
        } catch (err) {
            return {
                address: "",
                status: "😥 " + err.message,
            };
        }
    } else {
        return {
            address: "",
            status: "🦊 You must install MetaMask, a virtual Ethereum wallet, in your browser.",
        };
    }
}
// Dieses Beispiel verwendet Web3.js 1.x
// Stelle sicher, dass Web3 korrekt initialisiert wurde, wie im vorherigen Schritt beschrieben

async function getBalance(token, address) {
    let web3;
    if (token === 'ETH') {
        web3 = new Web3(window.ethereum);
    } else if (token === 'BNB') {
        web3 = new Web3(new Web3.providers.HttpProvider('https://bsc-dataseed.binance.org/'));
    } else if (token === 'MATIC') {
        web3 = new Web3(new Web3.providers.HttpProvider('https://rpc-mainnet.maticvigil.com/'));
    } else {
        return;
    }

    try {
        const balance = await web3.eth.getBalance(address);
        const formattedBalance = web3.utils.fromWei(balance, 'ether');
        return formattedBalance;
    } catch (error) {
        console.error(`Fehler beim Abrufen des Saldos für ${token}:`, error);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const walletButton = document.querySelector('.cta-button.wallet-connect');
    walletButton.addEventListener('click', async () => {
        const walletResponse = await connectWallet();
        if (walletResponse.address) {
            document.getElementById('wallet-address').textContent = walletResponse.address;
            
            // ETH Saldo
            const ethBalance = await getBalance('ETH', walletResponse.address);
            document.getElementById('eth-balance').textContent = ethBalance;
            
            // BNB Saldo
            const bnbBalance = await getBalance('BNB', walletResponse.address);
            document.getElementById('bnb-balance').textContent = bnbBalance;
            
            // MATIC Saldo
            const maticBalance = await getBalance('MATIC', walletResponse.address);
            document.getElementById('matic-balance').textContent = maticBalance;
        } else {
            alert(walletResponse.status);
        }
    });
});

async function getEthBalance(address) {
    if (window.ethereum) {
        try {
            const web3 = new
            const balance = await window.ethereum.request({
                method: 'eth_getBalance',
                params: [address, 'latest']
            });
            const ethBalance = window.web3.utils.fromWei(balance, 'ether');
            return ethBalance;
        } catch (err) {
            console.error(err);
            return 'Fehler beim Abrufen des Saldos';
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const walletButton = document.querySelector('.cta-button.wallet-connect');
    walletButton.addEventListener('click', async () => {
        const walletResponse = await connectWallet();
        if (walletResponse.address) {
            // Abrufen des Ether-Saldos für die Adresse
            const balance = await getEthBalance(walletResponse.address);
            // Anzeigen der Wallet-Adresse und des Saldos
            document.querySelector('.wallet-address').textContent = 'Wallet Connected: ' + walletResponse.address;
            // Hier fügen wir den Saldo ein
            document.querySelector('.wallet-balance').textContent = 'Saldo: ' + balance + ' ETH';
        } else {
            alert(walletResponse.status);
        }
    });
});