"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.extractFirstName = extractFirstName;
exports.isOptOutMessage = isOptOutMessage;
exports.isAffirmativeMessage = isAffirmativeMessage;
exports.isNegativeMessage = isNegativeMessage;
const OPT_OUT_KEYWORDS = new Set([
    "STOP",
    "STOPALL",
    "UNSUBSCRIBE",
    "CANCEL",
    "END",
    "QUIT",
]);
function normalizePhone(rawPhone) {
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
        return `+${digits}`;
    }
    if (digits.length === 10) {
        return `+1${digits}`;
    }
    if (digits.length > 11) {
        return `+${digits}`;
    }
    return null;
}
function extractFirstName(fullName) {
    const trimmed = fullName.trim();
    if (!trimmed)
        return "there";
    const [first] = trimmed.split(/\s+/);
    return first || "there";
}
function isOptOutMessage(body) {
    const normalized = body.trim().toUpperCase().replace(/\s+/g, "");
    return OPT_OUT_KEYWORDS.has(normalized);
}
function isAffirmativeMessage(body) {
    const normalized = body.trim().toLowerCase();
    return ["y", "yes", "yeah", "yep", "sure", "ok", "okay"].includes(normalized);
}
function isNegativeMessage(body) {
    const normalized = body.trim().toLowerCase();
    return ["n", "no", "nope", "nah", "not now"].includes(normalized);
}
