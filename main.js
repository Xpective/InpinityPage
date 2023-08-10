firebase.initializeApp(firebaseConfig);

const solana = require('@solana/web3.js');

const connection = new solana.Connection(solana.clusterApiUrl('testnet'));
const walletStatusDiv = document.getElementById('walletStatus');
const walletAddressSpan = document.getElementById('walletAddress');
const walletBalanceSpan = document.getElementById('walletBalance');
const userPublicKey = wallet.publicKey.toString();


document.getElementById('userProfileInfo').textContent = `Angemeldet als: ${userPublicKey}`;

const wallet = window.solana;
    if (!wallet) {
        alert('Bitte installieren Sie eine Solana-Wallet wie Phantom.');
        return;
    }

    if (!wallet.isConnected) {
        await wallet.connect();
        walletStatusDiv.textContent = `Verbunden: ${wallet.publicKey.toString()}`;
    } else {
        wallet.disconnect();
        walletStatusDiv.textContent = '';
    }
    
    
    walletAddressSpan.textContent = `Adresse: ${wallet.publicKey.toString()}`;
    
    // Solana Balance abrufen und anzeigen
    connection.getBalance(wallet.publicKey).then(balance => {
    walletBalanceSpan.textContent = `Balance: ${balance / Math.pow(10, 9)} SOL`;
    });
