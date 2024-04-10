('.accordion-item').forEach(item => {
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