"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
exports.createActionKey = createActionKey;
function renderTemplate(template, values) {
    return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
        const value = values[key];
        if (value === null || value === undefined) {
            return "";
        }
        return String(value);
    });
}
function createActionKey(prefix, ...parts) {
    const safeParts = parts
        .map((part) => String(part ?? ""))
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.replace(/[^a-zA-Z0-9:_-]+/g, "_"));
    return [prefix, ...safeParts].join(":");
}
