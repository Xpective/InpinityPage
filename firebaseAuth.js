// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCZd9IpRXP8uRD0WehOcijEiLNCs_zTDQQ",
  authDomain: "inpi-page.firebaseapp.com",
  projectId: "inpi-page",
  storageBucket: "inpi-page.appspot.com",
  messagingSenderId: "135360633231",
  appId: "1:135360633231:web:94301d2d794164cbc213fa",
  measurementId: "G-75P99BT3J4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);