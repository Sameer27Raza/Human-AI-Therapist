const recipient = "sameer27raza@gmail.com";
const maxMessageLength = 5000;

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ message: "Method not allowed." });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return res.status(503).json({
            message: "Email delivery is not configured. Please try again later."
        });
    }

    const body = typeof req.body === "string"
        ? Object.fromEntries(new URLSearchParams(req.body))
        : req.body;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (
        !name ||
        name.length > 120 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        !message ||
        message.length > maxMessageLength
    ) {
        return res.status(400).json({
            message: "Enter a valid name, email address, and message (up to 5,000 characters)."
        });
    }

    let response;
    try {
        response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: process.env.CONTACT_FROM_EMAIL || "AI Therapist <onboarding@resend.dev>",
                to: [recipient],
                reply_to: email,
                subject: "New message from the AI Therapist website",
                text: `Name: ${name}\nEmail: ${email}\n\n${message}`
            })
        });
    } catch (error) {
        console.error("Resend request failed:", error.message);
        return res.status(502).json({
            message: "The email service could not be reached. Please try again later."
        });
    }

    if (!response.ok) {
        console.error("Resend rejected the email request with status:", response.status);
        return res.status(502).json({
            message: "The email service rejected the message. Please try again later."
        });
    }

    return res.status(200).json({ message: "Message accepted for delivery." });
};
