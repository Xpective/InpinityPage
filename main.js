firebase.initializeApp(firebaseConfig);

const solana = require('@solana/web3.js');

const connection = new solana.Connection(solana.clusterApiUrl('testnet'));
const walletStatusDiv = document.getElementById('walletStatus');
const walletAddressSpan = document.getElementById('walletAddress');
const walletBalanceSpan = document.getElementById('walletBalance');
const userPublicKey = wallet.publicKey.toString();



document.querySelectorAll('.accordion-item').forEach(item => {
    item.addEventListener('click', event => {
        const currentlyActiveItem = document.querySelector('.accordion-item.active');
        if (currentlyActiveItem && currentlyActiveItem !== item) {
            currentlyActiveItem.classList.remove('active');
            currentlyActiveItem.style.maxHeight = '60px';
            currentlyActiveItem.querySelector('.accordion-content').style.maxHeight = '0';
        }
        item.classList.toggle('active');
        if (item.classList.contains('active')) {
            item.style.maxHeight = '400px'; /* Sie können dies anpassen */
            item.querySelector('.accordion-content').style.maxHeight = '300px'; /* Sie können dies anpassen */
        } else {
            item.style.maxHeight = '60px';
            item.querySelector('.accordion-content').style.maxHeight = '0';
        }
    });
});

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
    const sections = document.querySelectorAll('.collapsible');
    const options = {
        rootMargin: '0px',
        threshold: 0.5
    };
    
    const callback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                sections.forEach(section => section.classList.remove('open'));
                entry.target.classList.add('open');
            }
        });
    };

// Function to check if an element is fully in viewport
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}
// Translations for the content
const translations = {
    'de': {
        'title': 'Entwickeln Sie Spiele effizienter mit Inpinity.',
        'subtitle': 'Die beste Plattform für Game-Entwickler. Erstellen, Teilen, Wachsen.',
        'btn1': 'Jetzt starten',
        'btn2': 'Wallet verbinden'
    },
    'en': {
        'title': 'Develop games more efficiently with Inpinity.',
        'subtitle': 'The best platform for game developers. Create, Share, Grow.',
        'btn1': 'Start now',
        'btn2': 'Connect Wallet'
    },
    'ru': {
        'title': 'Разрабатывайте игры эффективнее с Inpinity.',
        'subtitle': 'Лучшая платформа для разработчиков игр. Создавайте, Делитесь, Растите.',
        'btn1': 'Начать сейчас',
        'btn2': 'Подключить кошелек'
    }
};

// Function to set the content based on the language
function setLanguageContent(lang) {
    const content = translations[lang];
    document.querySelector("#hero h1").textContent = content.title;
    document.querySelector("#hero p").textContent = content.subtitle;
    document.querySelector("#hero .cta-button:nth-child(3)").textContent = content.btn1;
    document.querySelector("#hero .cta-button:nth-child(4)").textContent = content.btn2;
}

// Detect the browser language
const browserLang = navigator.language.slice(0, 2);
if (browserLang === 'de') {
    setLanguageContent('de');
} else if (browserLang === 'ru') {
    setLanguageContent('ru');
} else {
    setLanguageContent('en');  // Default to English
}
translations = {
    'de': {
        'nav': ['Startseite', 'Dienstleistungen', 'Game', 'Forum', 'Zusammenarbeit', 'Anmelden', 'Registrieren', 'Über uns'],
        'main': [
            'Entwickeln Sie Spiele effizienter mit Inpinity.',
            'Die beste Plattform für Game-Entwickler. Erstellen, Teilen, Wachsen.',
            'Jetzt starten',
            'Wallet verbinden',
            'Scrollen Sie um mehr zu erfahren',
            'Willkommen bei Inpinity',
            'Unsere Vision',
            'Warum Inpinity?',
            'Mach mit!',
            'Testimonials',
            'Kontakt'
        ],
        'footer': ['© 2023 Inpinity. Alle Rechte vorbehalten.']
    },
    'en': {
        'nav': ['Home', 'Services', 'Game', 'Forum', 'Collaboration', 'Login', 'Register', 'About Us'],
        'main': [
            'Develop games more efficiently with Inpinity.',
            'The best platform for game developers. Create, Share, Grow.',
            'Start now',
            'Connect Wallet',
            'Scroll to learn more',
            'Welcome to Inpinity',
            'Our Vision',
            'Why Inpinity?',
            'Join us!',
            'Testimonials',
            'Contact'
        ],
        'footer': ['© 2023 Inpinity. All rights reserved.']
    },
    'ru': {
        'nav': ['Главная', 'Услуги', 'Игра', 'Форум', 'Сотрудничество', 'Войти', 'Регистрация', 'О нас'],
        'main': [
            'Разрабатывайте игры эффективнее с Inpinity.',
            'Лучшая платформа для разработчиков игр. Создавайте, Делитесь, Растите.',
            'Начать сейчас',
            'Подключить кошелек',
            'Прокрутите, чтобы узнать больше',
            'Добро пожаловать в Inpinity',
            'Наша Визия',
            'Почему Inpinity?',
            'Присоединяйтесь!',
            'Отзывы',
            'Контакт'
        ],
        'footer': ['© 2023 Inpinity. Все права защищены.']
    }
}
translations['de']['content'] = [
    "Scrollen Sie um mehr zu erfahren",
    "Willkommen bei Inpinity",
    "Vereinen, Erschaffen, Erleben. Inpinity ist nicht nur eine Plattform, sondern ein Zuhause für visionäre Game-Designer und Entwickler. Wir glauben an die Macht der Gemeinschaft und daran, dass wir gemeinsam Welten erschaffen können, die über das hinausgehen, was wir uns vorstellen können.",
    "Unsere Vision",
    "Wir träumen von einer Spielwelt, die von den kreativen Köpfen der Zukunft gestaltet wird. Eine Welt, in der jede Idee, jeder Charakter und jedes Abenteuer das Ergebnis einer leidenschaftlichen Gemeinschaft ist.",
    "Warum Inpinity?",
    "Gemeinschaft: Bei uns steht die Gemeinschaft an erster Stelle. Arbeiten Sie zusammen, teilen Sie Ideen und wachsen Sie mit anderen talentierten Individuen.",
    "Ressourcen: Wir bieten Tools, Ressourcen und Unterstützung, um Ihre Vision in die Realität umzusetzen.",
    "Erfahrung: Tauschen Sie Erfahrungen aus, lernen Sie von Branchenexperten und werden Sie Teil eines ständig wachsenden Netzwerks.",
    "Mach mit!",
    "Ob Sie ein erfahrener Entwickler oder ein Neuling in der Welt des Game-Designs sind, bei Inpinity ist Platz für alle. Werden Sie heute noch Mitglied und beginnen Sie Ihr Abenteuer mit uns!",
    "Testimonials",
    '"Inpinity hat mir die Plattform und die Gemeinschaft geboten, die ich brauchte, um mein Spielprojekt wirklich in Gang zu bringen. Die Zusammenarbeit mit anderen hier war eine unglaubliche Erfahrung!" - Max Mustermann',
    "Kontakt",
    "Haben Sie Fragen oder möchten Sie mehr über uns erfahren? Kontaktieren Sie uns und lassen Sie uns in Verbindung bleiben!"
]
translations['en']['content'] = [
    "Scroll to learn more",
    "Welcome to Inpinity",
    "Unite, Create, Experience. Inpinity is not just a platform, but a home for visionary game designers and developers. We believe in the power of community, and that together, we can create worlds beyond our imagination.",
    "Our Vision",
    "We dream of a gaming world shaped by the creative minds of the future. A world where every idea, character, and adventure is the result of a passionate community.",
    "Why Inpinity?",
    "Community: For us, community comes first. Collaborate, share ideas, and grow with other talented individuals.",
    "Resources: We provide tools, resources, and support to bring your vision to life.",
    "Experience: Share experiences, learn from industry experts, and be a part of an ever-growing network.",
    "Join us!",
    "Whether you are an experienced developer or new to game design, there's a place for everyone at Inpinity. Join today and start your adventure with us!",
    "Testimonials",
    '"Inpinity provided me with the platform and community I needed to really get my game project off the ground. Collaborating with others here was an incredible experience!" - Max Mustermann',
    "Contact",
    "Do you have questions or want to learn more about us? Contact us and let's stay connected!"
]
translations['ru']['content'].extend([
    "Ресурсы: Мы предоставляем инструменты, ресурсы и поддержку, чтобы воплотить вашу визию в реальность.",
    "Опыт: Обменивайтесь опытом, учитесь у экспертов индустрии и станьте частью постоянно растущей сети.",
    "Присоединяйтесь!",
    "Неважно, являетесь ли вы опытным разработчиком или новичком в мире дизайна игр, в Inpinity место для каждого. Присоединяйтесь сегодня и начните свое приключение с нами!",
    "Отзывы",
    '"Inpinity предоставил мне платформу и сообщество, которые мне были нужны, чтобы действительно начать свой игровой проект. Сотрудничество с другими здесь было невероятным опытом!" - Макс Мустерманн',
    "Контакт",
    "У вас есть вопросы или хотите узнать больше о нас? Свяжитесь с нами и оставайтесь на связи!"
])
// Ein Event-Listener für das Scroll-Ereignis
window.addEventListener('scroll', function() {
    // Auswahl des details-Elements mit der Klasse "sticky"
    const stickyDetails = document.querySelector('details.sticky');

    // Überprüfung, ob das details-Element geöffnet ist und ob der Benutzer herunterscrollt
    if (stickyDetails && stickyDetails.hasAttribute('open') && window.scrollY > 0) {
        stickyDetails.removeAttribute('open');
    }
});



function focusTool(selectedTool) {
    let container = document.querySelector('.tools-container');
    let tools = document.querySelectorAll('.tool');
    let containerWidth = container.offsetWidth;
    let toolWidth = selectedTool.offsetWidth;

    // Setzt den Hintergrund und die Größe aller Werkzeuge zurück
    tools.forEach(tool => {
        tool.style.backgroundColor = '';
        tool.style.transform = 'scale(1)';
    });

    // Setzt den Hintergrund des ausgewählten Werkzeugs
    selectedTool.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';

    // Berechnet den Scroll-Offset, um das ausgewählte Werkzeug in der Mitte zu positionieren
    let scrollLeft = (selectedTool.offsetLeft - (containerWidth / 2) + (toolWidth / 2));
    container.style.transform = `translateX(-${scrollLeft}px)`;

    // Vergrößert das ausgewählte Werkzeug
    selectedTool.style.transform = 'scale(1.1)';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    if (currentTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "light");
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
    }
}

const container = document.getElementById('tools-scroll-container');
const modal = document.getElementById('constructionModal');

container.addEventListener('scroll', function() {
    if (container.scrollLeft + container.clientWidth >= container.scrollWidth) {
        container.scrollLeft = 0;
        showModal();
    }
});

function showModal() {
    modal.style.display = 'flex'; // Zeigt das Modal an

    // Fügt einen Event-Listener hinzu, um das Modal zu schließen, wenn außerhalb des Modals geklickt wird
    window.addEventListener('click', function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
}

function doSomething(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'block';
}

window.onclick = function(event) {
    const modal1 = document.getElementById('constructionModal1');
    const modal2 = document.getElementById('constructionModal2');
    const modal3 = document.getElementById('constructionModal3');
    
    if (event.target == modal1 || event.target == modal2 || event.target == modal3) {
        modal1.style.display = 'none';
        modal2.style.display = 'none';
        modal3.style.display = 'none';
    }
}
