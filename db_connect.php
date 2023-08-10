<?php
$servername = "dbaas-db-5790554-do-user-14500968-0.b.db.ondigitalocean.com";
$username = "doadmin";
$password = "AVNS_uXIfX6bvgklB1AqLJYY";
$database = "defaultdb";
$port = 25060;

// Verbindung erstellen
$conn = new mysqli($servername, $username, $password, $database, $port);

// Verbindung prüfen
if ($conn->connect_error) {
    die("Verbindung fehlgeschlagen: " . $conn->connect_error);
}
?>
