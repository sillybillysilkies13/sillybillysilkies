import axios from "axios";

export const API_BASE = "https://backend.sillybillysilkies.workers.dev";

// ---- Admin session -------------------------------------------------------
// /login returns a signed token that expires. Admin pages send it as
// "Authorization: Bearer <token>" and the backend refuses admin calls without it.
const TOKEN_KEY = "adminToken";
const TOKEN_EXPIRES_KEY = "adminTokenExpiresAt";

const storage = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
    remove: (k) => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};

export function saveAdminSession({ token, expiresAt }) {
    storage.set(TOKEN_KEY, token);
    storage.set(TOKEN_EXPIRES_KEY, String(expiresAt));
    storage.remove("isAdmin"); // old flag, no longer used
}

export function clearAdminSession() {
    storage.remove(TOKEN_KEY);
    storage.remove(TOKEN_EXPIRES_KEY);
    storage.remove("isAdmin");
}

export function getAdminToken() {
    const token = storage.get(TOKEN_KEY);
    const expiresAt = Number(storage.get(TOKEN_EXPIRES_KEY));
    if (!token || !expiresAt || Date.now() >= expiresAt) return null;
    return token;
}

export const isAdminLoggedIn = () => getAdminToken() !== null;

const onAdminPage = () => window.location.pathname.startsWith("/admin");
const isBackendUrl = (url) => typeof url === "string" && url.startsWith(API_BASE);

function handleRejectedToken() {
    clearAdminSession();
    if (onAdminPage()) {
        alert("Your admin session has expired. Please log in again.");
        window.location.assign("/login");
    }
}

// Adds the admin token to every backend request made from an admin page
// (fetch and axios), so each admin screen doesn't have to do it by hand.
export function installAdminAuth() {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
        const url = typeof input === "string" ? input : input?.url;
        const token = onAdminPage() && isBackendUrl(url) ? getAdminToken() : null;
        if (token) {
            const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
            if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
            init = { ...init, headers };
        }
        const response = await nativeFetch(input, init);
        if (token && response.status === 401) handleRejectedToken();
        return response;
    };

    axios.interceptors.request.use((config) => {
        const token = onAdminPage() && isBackendUrl(config.url) ? getAdminToken() : null;
        if (token) {
            config.headers = config.headers || {};
            if (typeof config.headers.set === "function") config.headers.set("Authorization", `Bearer ${token}`);
            else config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });
    axios.interceptors.response.use(undefined, (error) => {
        if (error?.response?.status === 401 && onAdminPage() && getAdminToken()) handleRejectedToken();
        return Promise.reject(error);
    });
}

// Sends an email through the backend mailer. The mailer answers HTTP 200 even
// when sending fails (body: {"status":"Error", ...}), so check the body too.
export async function sendEmail({ to, subject, message }) {
    const formData = new FormData();
    formData.append("to", to);
    formData.append("subject", subject);
    formData.append("message", message);

    const response = await fetch(`${API_BASE}/sendmail`, {
        method: "POST",
        body: formData,
    });
    const text = await response.text();
    let result = null;
    try {
        result = JSON.parse(text);
    } catch {
        // Non-JSON reply; fall through to the status check.
    }
    if (!response.ok || result?.status === "Error") {
        throw new Error(result?.message || text || `Email failed (HTTP ${response.status})`);
    }
    return result;
}

// Rebuilds the public website from the latest admin data (Cloudflare Pages deploy hook).
export async function publishWebsite() {
    const response = await fetch(`${API_BASE}/deploy`, { method: "POST" });
    if (!response.ok) throw new Error(`Deploy failed (HTTP ${response.status})`);
}

export const PUBLISH_STARTED_MESSAGE =
    "Website update started!\n\nYour changes and new photos will appear on the live website in about 3–5 minutes. Refresh the website after that to see them.";

// After a save, saved data only reaches the public site once it is republished.
// Ask right away so a save is not mistaken for "live".
export async function offerToPublish(savedLabel) {
    const publishNow = window.confirm(
        `${savedLabel} saved.\n\n` +
        "Update the live website now? New photos and changes show up in about 3–5 minutes.\n\n" +
        "Choose Cancel if you have more edits to make — you can publish later with the \"Update Website\" button."
    );
    if (!publishNow) return;
    try {
        await publishWebsite();
        alert(PUBLISH_STARTED_MESSAGE);
    } catch (error) {
        console.error("Failed to start website update:", error);
        alert("Your changes are saved, but the website update could not be started. Please click \"Update Website\" to try again.");
    }
}
