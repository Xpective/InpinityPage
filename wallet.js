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

document.addEventListener('DOMContentLoaded', function () {
    const walletButton = document.querySelector('.cta-button.wallet-connect');
    walletButton.addEventListener('click', async () => {
        const walletResponse = await connectWallet();
        alert(walletResponse.status);
        if (walletResponse.address) {
            document.querySelector('.wallet-address').textContent = 'Wallet Connected: ' + walletResponse.address;
        }
    });
});