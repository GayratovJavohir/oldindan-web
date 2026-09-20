// -----------------------------------------------------------------------------
// Deposit / online-payment (Payme, Click) settings.
//
// STATUS: backend endpoints do not exist yet. Everything here is a
// localStorage-backed placeholder so the UI is fully usable today. Once the
// Django API is ready, replace the bodies of the functions below with real
// `$api` calls — the function signatures and return shapes are the intended
// contract, so callers (Settings.jsx, Branch.jsx) will not need to change.
//
// Suggested future endpoints:
//   GET   /partner/payment-settings/                -> default settings
//   PATCH /partner/payment-settings/                -> update default settings
//   GET   /partner/branches/:id/payment-settings/    -> branch override (or null)
//   PATCH /partner/branches/:id/payment-settings/    -> update branch override
//   POST  /partner/payments/session/                 -> { bookingId, amount }
//         -> { checkoutUrl, provider, sessionId }     (redirect guest here to pay)
//   GET   /partner/payments/session/:sessionId/       -> { status }
//
// SECURITY NOTE: only *public* provider identifiers (merchant/service id)
// belong in this frontend. Payme/Click secret keys must be configured on the
// backend only and must never be entered or stored here.
// -----------------------------------------------------------------------------

// import $api from '../config/api.config';

const DEFAULT_KEY = 'oldindan_payment_settings_default';
const BRANCH_KEY_PREFIX = 'oldindan_payment_settings_branch_';

export const PAYMENT_PROVIDERS = [
    { value: 'payme', label: 'Payme' },
    { value: 'click', label: 'Click' },
];

// FIX: these labels were hard-coded Uzbek strings inside a service module,
// so they never followed the selected interface language. The UI translates
// them via `settings.depositTypeFixed` / `settings.depositTypePercent`.
export const DEPOSIT_TYPES = [
    { value: 'fixed' },
    { value: 'percent' },
];

function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
        return { ...fallback, ...JSON.parse(raw) };
    } catch {
        return fallback;
    }
}

function emptySettings() {
    return {
        enabled: false,
        depositType: 'fixed', // 'fixed' | 'percent'
        depositValue: 0,
        provider: 'payme', // 'payme' | 'click'
        merchantId: '',
    };
}

/** Global default deposit/payment settings for the whole business. */
export async function getDefaultPaymentSettings() {
    // TODO(backend): const { data } = await $api.get('partner/payment-settings/');
    await new Promise((resolve) => setTimeout(resolve, 150));
    return safeParse(localStorage.getItem(DEFAULT_KEY), emptySettings());
}

export async function updateDefaultPaymentSettings(payload) {
    // TODO(backend): const { data } = await $api.patch('partner/payment-settings/', payload);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const next = { ...emptySettings(), ...payload };
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(next));
    return next;
}

/**
 * Per-branch override. `override: false` means "inherit the global default" —
 * the rest of the fields are only meaningful when `override` is true.
 */
export async function getBranchPaymentSettings(branchId) {
    // TODO(backend): const { data } = await $api.get(`partner/branches/${branchId}/payment-settings/`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    return safeParse(
        localStorage.getItem(`${BRANCH_KEY_PREFIX}${branchId}`),
        { override: false, ...emptySettings() },
    );
}

export async function updateBranchPaymentSettings(branchId, payload) {
    // TODO(backend): const { data } = await $api.patch(`partner/branches/${branchId}/payment-settings/`, payload);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const next = { override: false, ...emptySettings(), ...payload };
    localStorage.setItem(`${BRANCH_KEY_PREFIX}${branchId}`, JSON.stringify(next));
    return next;
}

/**
 * Placeholder for starting an online deposit payment for a booking.
 * Once the backend exists this should return a real checkout URL to
 * redirect the guest/receptionist to (Payme/Click hosted checkout).
 */
export async function createDepositPaymentSession(bookingId, amount) {
    // TODO(backend): const { data } = await $api.post('partner/payments/session/', { bookingId, amount });
    throw new Error(`Payment endpoints are not implemented on the backend yet (booking #${bookingId}, amount: ${amount}).`);
}
