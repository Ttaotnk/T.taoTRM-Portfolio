const PORTFOLIO_SHEETS_URL =
    "https://script.google.com/macros/s/AKfycbx5oatECw4KAu7ghOrqZl1sD5wRJRIfCmP0xlfFJs-s2n9RIj3DxgX5XORV0gzgAEv9bQ/exec";

async function sendContactSheet(payload) {
    await fetch(PORTFOLIO_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
    });
}
