const validator = require('validator');
const dns = require('dns').promises;
const disposableDomainsList = require('disposable-email-domains');

// Convert array of 120,000+ disposable domains into a high-performance Set
const disposableSet = new Set(disposableDomainsList.map(d => d.toLowerCase()));

// Supplemental curated disposable / temporary email domains and patterns
const SUPPLEMENTAL_DISPOSABLE_DOMAINS = [
  'tempmail.com',
  'tempmail.net',
  'tempmail.io',
  'temp-mail.org',
  'temp-mail.io',
  'throwawaymail.com',
  'dispostable.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'sharklasers.com',
  'grr.la',
  '10minutemail.com',
  '10minutemail.net',
  'fakeinbox.com',
  'getairmail.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'nada.ltd',
  'getnada.com',
  'inboxkitten.com'
];
SUPPLEMENTAL_DISPOSABLE_DOMAINS.forEach(d => disposableSet.add(d));

// Common major providers for fallback resilience during transient DNS network issues
const KNOWN_LEGITIMATE_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'zoho.com'
]);

/**
 * Validates and normalizes an email address.
 * 
 * Checks performed:
 * 1. Syntax validation (via validator library and RFC standards)
 * 2. Normalization (trimmed, lowercase)
 * 3. Disposable/temporary domain blocklist lookup (120,000+ domains)
 * 4. DNS MX record validation (with RFC 5321 A-record fallback)
 * 
 * Note: Neither DNS nor SMTP probing can conclusively verify individual mailbox
 * existence (especially on Gmail/Outlook/Yahoo). Mailbox ownership is conclusively
 * proven via cryptographically secure OTP verification.
 * 
 * @param {string} email - Raw user-submitted email string
 * @param {object} options - Optional validation flags { skipDns: boolean }
 * @returns {Promise<{ valid: boolean, normalizedEmail?: string, error?: string }>}
 */
async function validateEmail(email, options = {}) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email address is required.' };
  }

  // Trim and convert to lower-case
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email address cannot be empty.' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email address exceeds maximum length of 254 characters.' };
  }

  // Basic structure check
  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { valid: false, error: 'Please enter a valid email address with a single "@" symbol.' };
  }

  const [localPart, domain] = parts;

  if (!localPart || localPart.length > 64) {
    return { valid: false, error: 'The email username part cannot exceed 64 characters or be empty.' };
  }

  if (!domain || domain.length < 3) {
    return { valid: false, error: 'The email domain is invalid or incomplete.' };
  }

  const normalizedDomain = domain.toLowerCase();
  const normalizedEmail = `${localPart}@${normalizedDomain}`.toLowerCase();

  // Validate syntax using the maintained validator library
  const isValidSyntax = validator.isEmail(normalizedEmail, {
    allow_utf8_local_part: false,
    require_tld: true,
    ignore_max_length: false
  });

  if (!isValidSyntax) {
    return { valid: false, error: 'Please enter a valid email address format (e.g. name@example.com).' };
  }

  // Reject malformed domains (consecutive dots, invalid characters, missing TLD)
  if (normalizedDomain.includes('..') || normalizedDomain.startsWith('.') || normalizedDomain.endsWith('.')) {
    return { valid: false, error: 'The email domain format is invalid.' };
  }

  const domainParts = normalizedDomain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/i.test(tld)) {
    return { valid: false, error: 'The email domain must have a valid top-level domain extension (e.g. .com, .org).' };
  }

  // Check against disposable / temporary email provider blocklist
  if (disposableSet.has(normalizedDomain)) {
    return {
      valid: false,
      error: 'Disposable and temporary email addresses are not accepted. Please use a permanent email address.'
    };
  }

  // Check subdomains against disposable provider list (e.g. abc.mailinator.com)
  for (let i = 1; i < domainParts.length - 1; i++) {
    const parentDomain = domainParts.slice(i).join('.');
    if (disposableSet.has(parentDomain)) {
      return {
        valid: false,
        error: 'Disposable and temporary email addresses are not accepted. Please use a permanent email address.'
      };
    }
  }

  // If skipDns option is provided or environment flag is set (e.g. during offline unit tests)
  if (options.skipDns || process.env.SKIP_DNS_CHECK === 'true') {
    return { valid: true, normalizedEmail };
  }

  // Fast-track known major legitimate email providers
  if (KNOWN_LEGITIMATE_DOMAINS.has(normalizedDomain)) {
    return { valid: true, normalizedEmail };
  }

  // Validate DNS Mail Routing (MX records)
  try {
    const mxRecords = await dns.resolveMx(normalizedDomain);

    if (mxRecords && mxRecords.length > 0) {
      // Check for Null MX (RFC 7505: priority 0 and exchange "." explicitly designates non-email domain)
      const nonNullMx = mxRecords.filter(r => r && r.exchange && r.exchange !== '.');
      if (nonNullMx.length === 0) {
        return { valid: false, error: 'This domain does not accept incoming emails (RFC 7505 null MX).' };
      }
      return { valid: true, normalizedEmail };
    }
  } catch (err) {
    if (err.code === 'ENODATA') {
      // Per RFC 5321: If no MX records are found, check fallback A/AAAA records
      try {
        const aRecords = await dns.resolve(normalizedDomain);
        if (aRecords && aRecords.length > 0) {
          return { valid: true, normalizedEmail };
        }
      } catch (aErr) {
        return { valid: false, error: 'The email domain does not have active mail routing (MX) or host records.' };
      }
    } else if (err.code === 'ENOTFOUND' || err.code === 'NXDOMAIN') {
      return { valid: false, error: 'The email domain does not exist or could not be found.' };
    } else {
      // Temporary network or resolver errors: do not unfairly reject the user if DNS lookup had a transient issue
      console.warn(`[EmailValidator] DNS check warning for domain ${normalizedDomain}: ${err.code || err.message}`);
      return { valid: true, normalizedEmail };
    }
  }

  return { valid: true, normalizedEmail };
}

module.exports = {
  validateEmail,
  KNOWN_LEGITIMATE_DOMAINS,
  disposableSet
};
