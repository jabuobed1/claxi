// Paystack service for handling payment authorization
const PAYSTACK_SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

let paystackLoaded = false;
let paystackPromise = null;

function loadPaystackScript() {
  if (paystackLoaded) {
    return Promise.resolve();
  }

  if (paystackPromise) {
    return paystackPromise;
  }

  paystackPromise = new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      paystackLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT_URL;
    script.onload = () => {
      paystackLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Paystack script'));
    };
    document.head.appendChild(script);
  });

  return paystackPromise;
}

export async function initializeCardAuthorization({ email, amount = 0, onSuccess, onClose }) {
  if (!PAYSTACK_PUBLIC_KEY) {
    throw new Error('Paystack public key not configured');
  }

  await loadPaystackScript();

  const handler = window.PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: amount * 100, // Paystack expects amount in kobo (multiply by 100)
    currency: 'ZAR',
    callback: (response) => {
      // response.reference contains the transaction reference
      // We need to verify this on the backend to get the authorization code
      onSuccess(response);
    },
    onClose: () => {
      onClose && onClose();
    },
  });

  handler.openIframe();
}

// Function to verify payment and get authorization details
// This would typically be called from your backend after the frontend gets the reference
export async function verifyPayment(reference) {
  // This should be called from your backend API
  // For now, we'll simulate the response structure
  const response = await fetch(`/api/paystack/verify/${reference}`);
  return response.json();
}