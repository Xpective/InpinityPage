firebase.initializeApp(firebaseConfig);

const solana = require('@solana/web3.js');

const connection = new solana.Connection(solana.clusterApiUrl('testnet'));
const walletStatusDiv = document.getElementById('walletStatus');
const walletAddressSpan = document.getElementById('walletAddress');
const walletBalanceSpan = document.getElementById('walletBalance');
const userPublicKey = wallet.publicKey.toString();