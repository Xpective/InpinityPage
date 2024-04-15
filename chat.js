// chat.js
const wsUrl = 'wss://example.com/websocket'; // Ersetze dies mit der URL deines WebSocket-Servers
let websocket = new WebSocket(wsUrl);

websocket.onopen = function() {
    console.log('WebSocket-Verbindung geöffnet.');
};

websocket.onerror = function(error) {
    console.error('WebSocket-Fehler: ' + error);
};

websocket.onmessage = function(event) {
    displayMessage(event.data);
};

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value;
    if (message) {
        websocket.send(message);
        displayMessage(message);
        messageInput.value = '';
    }
}

function displayMessage(message) {
    const messagesList = document.getElementById('messages');
    const newMessage = document.createElement('li');
    newMessage.textContent = message;
    messagesList.appendChild(newMessage);
}