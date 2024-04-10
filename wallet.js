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

async function getEthBalance(address) {
    if (window.ethereum) {
        try {
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