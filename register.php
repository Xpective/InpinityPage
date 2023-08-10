<?php
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST["username"];
    $email = $_POST["email"];
    $password = password_hash($_POST["password"], PASSWORD_DEFAULT); // Passwort verschlüsseln

    $sql = "INSERT INTO users (username, email, password) VALUES ('$username', '$email', '$password')";

    if ($conn->query($sql) === TRUE) {
        echo "Neuer Benutzer erfolgreich registriert!";
    } else {
        echo "Fehler: " . $sql . "<br>" . $conn->error;
    }

    $conn->close();
}
