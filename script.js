const PHONE_NUMBER = "919262746293";

const form = document.querySelector("#contact-form") || document.querySelector(".form-container form");

if (form && !form.dataset.whatsappBound) {
    form.dataset.whatsappBound = "true";
    const status = form.querySelector(".form-status");

    form.addEventListener("submit", function(event) {
        event.preventDefault();

        const nameInput = form.querySelector('[name="name"]');
        const emailInput = form.querySelector('[name="email"]');
        const messageInput = form.querySelector('[name="message"]');

        const name = nameInput ? nameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const message = messageInput ? messageInput.value.trim() : "";

        const text = `Name: ${name}\nEmail: ${email}\nMessage: ${message}`;
        const encodedText = encodeURIComponent(text);
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${PHONE_NUMBER}&text=${encodedText}`;

        // Open WhatsApp in a new tab
        window.open(whatsappUrl, "_blank");

        if (status) {
            status.textContent = "Opening WhatsApp...";
            status.classList.remove("is-error");
        }

        form.reset();
    });
}
