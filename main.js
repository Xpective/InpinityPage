// Firebase-Initialisierung
firebase.initializeApp(firebaseConfig);

document.addEventListener('DOMContentLoaded', function() {
    // DOM-Elemente
    const walletStatusDiv = document.getElementById('walletStatus');
    const walletAddressSpan = document.getElementById('walletAddress');
    const walletBalanceSpan = document.getElementById('walletBalance');

    // Solana-Initialisierung
    const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('testnet'));
    const wallet = window.solana;

    if (!wallet) {
        alert('Bitte installieren Sie eine Solana-Wallet wie Phantom.');
    } else {
        // Zeige Wallet-Informationen
        walletAddressSpan.textContent = `Adresse: ${wallet.publicKey.toString()}`;

        // Solana Balance abrufen und anzeigen
        connection.getBalance(wallet.publicKey).then(balance => {
            walletBalanceSpan.textContent = `Balance: ${balance / Math.pow(10, 9)} SOL`;
        }).catch(error => {
            console.error("Fehler beim Abrufen des Wallet-Saldos:", error);
        });

        // EventListener zum Verbinden/Trennen der Wallet
        document.getElementById('connectWallet').addEventListener('click', async () => {
            try {
                if (!wallet.isConnected) {
                    await wallet.connect();
                    walletStatusDiv.textContent = `Verbunden: ${wallet.publicKey.toString()}`;
                } else {
                    wallet.disconnect();
                    walletStatusDiv.textContent = '';
                }
            } catch (error) {
                console.error("Fehler beim Verbinden/Trennen der Wallet:", error);
            }
        });
    }
});
