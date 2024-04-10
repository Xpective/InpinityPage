window.addEventListener('scroll', function() {
    // Auswahl des details-Elements mit der Klasse "sticky"
    const stickyDetails = document.querySelector('details.sticky');

    // Überprüfung, ob das details-Element geöffnet ist und ob der Benutzer herunterscrollt
    if (stickyDetails && stickyDetails.hasAttribute('open') && window.scrollY > 0) {
        stickyDetails.removeAttribute('open');
    }
});

document.addEventListener("DOMContentLoaded", function() {
    const container = document.querySelector(".container");

    // Starte den Loop-Effekt
    container.addEventListener("animationiteration", () => {
        container.style.animation = "none"; // Setze die Animation zurück
        void container.offsetWidth; // Erzwinge einen Re-Layout
        container.style.animation = "rotate 15s linear infinite, zoom 15s linear infinite";
    });
});