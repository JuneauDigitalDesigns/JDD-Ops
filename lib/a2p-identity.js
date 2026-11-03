// @ts-check
/**
 * A2P 10DLC identity — the pure half: enums, validation, payload shapes, and the tax-ID
 * tripwire.
 *
 * Moved from the agency repo (`app/lib/a2p-identity.mjs`, commit `7175ecd`) when registration
 * became operator-driven (`PLAN-console-a2p-registration.md`, decision 7). The enums, the EIN
 * pattern, `findTaxIdPaths` and `scrubVendorMessage` are carried over unchanged. What changed
 * is the shape of the input: the client's wizard no longer submits one identity blob that
 * reaches Twilio in a single request. The operator types each piece on the console step that
 * consumes it, so validation is per step rather than one all-or-nothing check.
 *
 * Plain ESM with `@ts-check`, like the rest of `lib/`: the root suite imports it untranspiled.
 *
 * Nothing here does I/O. The console's *client* component needs the enums for its selects
 * and cannot import from the ops root, so the section's server component imports this module
 * and passes them down as props — one copy, never a second one in `console/src`.
 *
 * Vendor shapes are pinned to the policies Twilio returns, recorded under
 * `test/fixtures/trusthub/`, not to the runbook's prose. Where the two disagreed the recording
 * won (see `A2P_BUSINESS_TYPES`, and `summarizeEvaluation`).
 */

/**
 * `business_industry` — Twilio TrustHub's accepted values for
 * `customer_profile_business_information`, verbatim and complete (31 values).
 *
 * Rendered as a `<select>`, never a text input: the field is an enum on Twilio's side, and a
 * freeform value fails the compliance evaluation days later rather than at submit.
 *
 * The whole list ships rather than only the five verticals we sell, because none of the five
 * trades has its own value — Twilio's list has no construction or home-services entry — so
 * the mapping below is a *default*, not a truth. A client who knows better can correct it,
 * which is exactly what a guess dressed up as the only option would prevent.
 *
 * @type {ReadonlyArray<{ value: string; label: string }>}
 */
export const A2P_BUSINESS_INDUSTRIES = [
  { value: "AGRICULTURE", label: "Agriculture" },
  { value: "AUTOMOTIVE", label: "Automotive" },
  { value: "BANKING", label: "Banking" },
  { value: "CONSUMER", label: "Consumer services" },
  { value: "EDUCATION", label: "Education" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "ENERGY", label: "Energy" },
  { value: "ENGINEERING", label: "Engineering" },
  { value: "FAST_MOVING_CONSUMER_GOODS", label: "Fast-moving consumer goods" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "FINTECH", label: "Fintech" },
  { value: "FOOD_AND_BEVERAGE", label: "Food and beverage" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "HOSPITALITY", label: "Hospitality" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "JEWELRY", label: "Jewelry" },
  { value: "LEGAL", label: "Legal" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "MEDIA", label: "Media" },
  { value: "NOT_FOR_PROFIT", label: "Not for profit" },
  { value: "OIL_AND_GAS", label: "Oil and gas" },
  { value: "ONLINE", label: "Online" },
  { value: "RAW_MATERIALS", label: "Raw materials" },
  { value: "REAL_ESTATE", label: "Real estate" },
  { value: "RELIGION", label: "Religion" },
  { value: "RETAIL", label: "Retail" },
  { value: "TECHNOLOGY", label: "Technology" },
  { value: "TELECOMMUNICATIONS", label: "Telecommunications" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "TRAVEL", label: "Travel" },
];

/**
 * The default `business_industry` per vertical we sell.
 *
 * Only car detailing has an unambiguous value. The trades all fall to `CONSUMER` — a
 * consumer-services business is what they are, and Twilio's list offers nothing closer.
 * `ENGINEERING` reads closer to the work but means engineering *firms*, and `REAL_ESTATE`
 * means property businesses; either would describe the client to the carriers as something
 * they are not.
 *
 * Keyed on `INDUSTRY_MENUS` ids from `@jdd/schema` — `hvac`, `roofing`, `plumbing`,
 * `lawn-care`, `car-detailing`, `health` — and nothing else. A key that matches no menu id
 * would silently never apply, which is worse than having no default at all.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_INDUSTRY_BY_VERTICAL = {
  plumbing: "CONSUMER",
  hvac: "CONSUMER",
  roofing: "CONSUMER",
  "lawn-care": "CONSUMER",
  "car-detailing": "AUTOMOTIVE",
  health: "HEALTHCARE",
};

/**
 * `business_type` — Twilio's accepted values, verbatim.
 *
 * Note `Limited Liability Corporation`, which is not what an LLC is actually called. The
 * runbook writes `Limited Liability Company` in its example payload; Twilio's reference does
 * not list that string, so sending it risks a rejection on the one field a client is most
 * likely to be right about. Twilio's spelling wins, because Twilio's parser is the one
 * reading it.
 *
 * @type {ReadonlyArray<{ value: string; label: string }>}
 */
export const A2P_BUSINESS_TYPES = [
  { value: "Limited Liability Corporation", label: "LLC" },
  { value: "Corporation", label: "Corporation" },
  { value: "Partnership", label: "Partnership" },
  { value: "Sole Proprietorship", label: "Sole proprietorship" },
  { value: "Co-operative", label: "Co-operative" },
  { value: "Non-profit Corporation", label: "Non-profit corporation" },
];

/**
 * An EIN as the IRS writes it and as the client types it: `NN-NNNNNNN`.
 *
 * Checked on the client before submit because a typo costs a brand rejection and a restart,
 * which is days — and checked again on the server because a client-side check is a
 * convenience, not a control.
 */
export const EIN_INPUT_PATTERN = /^\d{2}-\d{7}$/;

/** @param {string} value */
export function isEinShaped(value) {
  return EIN_INPUT_PATTERN.test(String(value ?? "").trim());
}

/**
 * The tax-ID tripwire.
 *
 * Deliberately the hyphenated form only, with digit boundaries on both sides. The handoff's
 * `\d{2}-?\d{7}` is right for a test fixture but wrong as a production predicate: unanchored
 * and with the hyphen optional, it matches inside *every* 10-digit phone number
 * (`4075551234` is `40` + `7555123`), and a wizard draft is full of phone numbers. A
 * tripwire that fires on ordinary data is a tripwire somebody switches off.
 *
 * `\d{5}-\d{4}` (ZIP+4) and `\d{3}-\d{4}` (local phone) do not match this shape, and a
 * boundary-anchored `NN-NNNNNNN` has no other ordinary meaning in a wizard draft.
 */
const TAX_ID_SHAPE = /(?<!\d)\d{2}-\d{7}(?!\d)/;

/** @param {unknown} value */
export function looksLikeTaxId(value) {
  return typeof value === "string" && TAX_ID_SHAPE.test(value);
}

/**
 * Walk any JSON-ish value and return the **paths** of every string that looks like a tax ID.
 *
 * Paths, never values: this feeds log lines and error messages, which is precisely where a
 * leak would end up. A caller refusing a write needs to know *where* the value is so the
 * code can be fixed, and never needs the value itself.
 *
 * @param {unknown} value
 * @param {string} [path]
 * @returns {string[]}
 */
export function findTaxIdPaths(value, path = "$") {
  if (looksLikeTaxId(value)) return [path];
  if (Array.isArray(value)) {
    return value.flatMap((entry, i) => findTaxIdPaths(entry, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => findTaxIdPaths(entry, `${path}.${key}`));
  }
  return [];
}


/**
 * TCR `vertical` for a `sole_proprietor_information` EndUser — a *different* list from
 * `A2P_BUSINESS_INDUSTRIES`, verbatim from Twilio's sole-proprietor ISV guide (23 values).
 *
 * Optional on Twilio's side. Kept as a select for the same reason as the industry list: a
 * freeform value fails evaluation later rather than at submit. Note the trades get a real
 * answer here (`CONSTRUCTION`) where the business-industry list offered none.
 *
 * @type {ReadonlyArray<string>}
 */
export const A2P_SOLE_PROP_VERTICALS = [
  "AGRICULTURE", "COMMUNICATION", "CONSTRUCTION", "EDUCATION", "ENERGY", "ENTERTAINMENT",
  "FINANCIAL", "GAMBLING", "GOVERNMENT", "HEALTHCARE", "HOSPITALITY", "HUMAN_RESOURCES",
  "INSURANCE", "LEGAL", "MANUFACTURING", "NGO", "POLITICAL", "POSTAL", "PROFESSIONAL",
  "REAL_ESTATE", "RETAIL", "TECHNOLOGY", "TRANSPORTATION",
];

/**
 * `company_type` on the `us_a2p_messaging_profile_information` EndUser (the trust product).
 * Our clients are private small businesses; `public` needs a stock exchange and ticker, and
 * is offered only so a mis-set value is visible rather than hardcoded away.
 *
 * @type {ReadonlyArray<string>}
 */
export const A2P_COMPANY_TYPES = ["private", "public", "non-profit", "government"];

/**
 * Which registration path this client takes.
 *
 * - `standard` — has an EIN. Secondary customer profile + A2P trust product, brand
 *   `STANDARD` registered Low-Volume (`SkipAutomaticSecVet=true`). The default.
 * - `sole-proprietor` — no EIN at all. A Starter customer profile + Sole Proprietor trust
 *   product, brand `SOLE_PROPRIETOR`, an OTP to the owner's own mobile, one number only.
 *   Twilio: every US LLC has an EIN and is therefore ineligible.
 *
 * @typedef {"standard" | "sole-proprietor"} A2pRegistrationPath
 */
export const A2P_REGISTRATION_PATHS = /** @type {const} */ (["standard", "sole-proprietor"]);

/**
 * The step-2.2 input: the business EndUser. Carries the EIN, and is the ONLY input that does.
 *
 * @typedef {object} BusinessEndUserInput
 * @property {string} legalBusinessName Must match the IRS record character for character.
 * @property {string} businessType One of `A2P_BUSINESS_TYPES`.
 * @property {string} businessIndustry One of `A2P_BUSINESS_INDUSTRIES`.
 * @property {string} websiteUrl
 * @property {string} ein `NN-NNNNNNN`. Never stored, never echoed, never logged.
 */

/**
 * The step-2.3 input: the person. On the standard path this becomes an
 * `authorized_representative_1`; on the sole-prop path a `starter_customer_profile_information`
 * (which has no title fields). Personal data — consumed by one call, never stored.
 *
 * @typedef {object} RepInput
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} email
 * @property {string} phone E.164.
 * @property {string} [jobPosition] Standard path only.
 * @property {string} [businessTitle] Standard path only.
 */

/**
 * @typedef {object} AddressInput
 * @property {string} customerName Legal name the address is registered to.
 * @property {string} street
 * @property {string} city
 * @property {string} region
 * @property {string} postalCode
 * @property {string} country
 */

/**
 * The trust-product input. Standard: the messaging-profile EndUser. Sole-prop: the
 * sole-proprietor EndUser, whose `mobile` is where the carrier's OTP lands — personal data,
 * consumed by one call, never stored.
 *
 * @typedef {object} TrustProductInput
 * @property {string} [companyType] Standard path.
 * @property {string} [stockExchange] Standard path, public companies only.
 * @property {string} [stockTicker] Standard path, public companies only.
 * @property {string} [brandContactEmail] Standard path.
 * @property {string} [brandName] Sole-prop path.
 * @property {string} [vertical] Sole-prop path, optional.
 * @property {string} [mobile] Sole-prop path. Must be a real US/CA mobile, not a CPaaS number.
 */

/** @typedef {{ ok: true } | { ok: false; fields: string[] }} FieldCheck */

const E164 = /^\+1\d{10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {string[]} fields
 * @returns {FieldCheck}
 */
const result = (fields) => (fields.length ? { ok: false, fields } : { ok: true });
/** @param {unknown} v */
const blank = (v) => !String(v ?? "").trim();

/**
 * Validate step 2.2. Field **names** only, never values — the result is rendered and may be
 * logged, which is exactly where a leak would end up.
 *
 * A sole proprietorship that HAS an EIN must register Low-Volume Standard (TCR rule, runbook
 * §3), so `Sole Proprietorship` is a legal business type on this path — not a contradiction.
 *
 * @param {Partial<BusinessEndUserInput>} input
 * @returns {FieldCheck}
 */
export function validateBusinessInput(input) {
  /** @type {string[]} */
  const fields = [];
  if (blank(input?.legalBusinessName)) fields.push("legalBusinessName");
  if (!A2P_BUSINESS_TYPES.some((t) => t.value === input?.businessType)) fields.push("businessType");
  if (!A2P_BUSINESS_INDUSTRIES.some((i) => i.value === input?.businessIndustry)) fields.push("businessIndustry");
  if (!/^https?:\/\/\S+\.\S+/.test(String(input?.websiteUrl ?? "").trim())) fields.push("websiteUrl");
  if (!isEinShaped(String(input?.ein ?? ""))) fields.push("ein");
  return result(fields);
}

/**
 * @param {Partial<RepInput>} input
 * @param {A2pRegistrationPath} path
 * @returns {FieldCheck}
 */
export function validateRepInput(input, path) {
  /** @type {string[]} */
  const fields = [];
  if (blank(input?.firstName)) fields.push("firstName");
  if (blank(input?.lastName)) fields.push("lastName");
  if (!EMAIL.test(String(input?.email ?? "").trim())) fields.push("email");
  if (!E164.test(String(input?.phone ?? "").trim())) fields.push("phone");
  if (path === "standard") {
    if (blank(input?.jobPosition)) fields.push("jobPosition");
    if (blank(input?.businessTitle)) fields.push("businessTitle");
  }
  return result(fields);
}

/**
 * @param {Partial<AddressInput>} input
 * @returns {FieldCheck}
 */
export function validateAddressInput(input) {
  /** @type {string[]} */
  const fields = [];
  for (const key of /** @type {const} */ (["customerName", "street", "city", "region", "postalCode", "country"])) {
    if (blank(input?.[key])) fields.push(key);
  }
  return result(fields);
}

/**
 * @param {Partial<TrustProductInput>} input
 * @param {A2pRegistrationPath} path
 * @returns {FieldCheck}
 */
export function validateTrustProductInput(input, path) {
  /** @type {string[]} */
  const fields = [];
  if (path === "sole-proprietor") {
    if (blank(input?.brandName)) fields.push("brandName");
    if (!E164.test(String(input?.mobile ?? "").trim())) fields.push("mobile");
    if (!blank(input?.vertical) && !A2P_SOLE_PROP_VERTICALS.includes(String(input?.vertical))) fields.push("vertical");
  } else {
    if (!A2P_COMPANY_TYPES.includes(String(input?.companyType ?? ""))) fields.push("companyType");
    if (!EMAIL.test(String(input?.brandContactEmail ?? "").trim())) fields.push("brandContactEmail");
    if (input?.companyType === "public") {
      if (blank(input?.stockExchange)) fields.push("stockExchange");
      if (blank(input?.stockTicker)) fields.push("stockTicker");
    }
  }
  return result(fields);
}

/**
 * `customer_profile_business_information` attributes (runbook 2.2).
 *
 * `business_identity` is `direct_customer`: it describes the CLIENT, who sells to their own
 * customers. The ISV relationship is declared by assigning JDD's primary profile to the
 * secondary (2.5), not by this attribute — JDD's own profile is the one that says
 * `isv_reseller_or_partner`.
 *
 * @param {BusinessEndUserInput} input
 * @returns {Record<string, string>}
 */
export function buildBusinessEndUserAttributes(input) {
  return {
    business_name: input.legalBusinessName.trim(),
    business_type: input.businessType,
    business_industry: input.businessIndustry,
    business_registration_identifier: "EIN",
    business_registration_number: String(input.ein ?? "").trim(),
    business_regions_of_operation: "USA_AND_CANADA",
    website_url: input.websiteUrl.trim(),
    business_identity: "direct_customer",
  };
}

/**
 * The person EndUser's attributes — `authorized_representative_1` on the standard path,
 * `starter_customer_profile_information` on the sole-prop path. The two policies want
 * different keys (recorded), so the path decides the shape rather than one builder sending
 * keys a policy does not list.
 *
 * @param {RepInput} input
 * @param {A2pRegistrationPath} path
 * @returns {Record<string, string>}
 */
export function buildRepEndUserAttributes(input, path) {
  const base = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim(),
    phone_number: input.phone.trim(),
  };
  if (path === "sole-proprietor") return base;
  return {
    ...base,
    job_position: String(input.jobPosition ?? "").trim(),
    business_title: String(input.businessTitle ?? "").trim(),
  };
}

/** @param {A2pRegistrationPath} path */
export const repEndUserType = (path) =>
  path === "sole-proprietor" ? "starter_customer_profile_information" : "authorized_representative_1";

/**
 * Address resource params (runbook 2.4). Six fields, never parsed out of the freeform
 * `brand.address`: a mis-parsed region fails the evaluation with no useful error.
 *
 * @param {AddressInput} input
 * @returns {Record<string, string>}
 */
export function buildAddressParams(input) {
  return {
    CustomerName: input.customerName.trim(),
    Street: input.street.trim(),
    City: input.city.trim(),
    Region: input.region.trim(),
    PostalCode: input.postalCode.trim(),
    IsoCountry: input.country.trim().toUpperCase() || "US",
  };
}

/**
 * The trust product's EndUser: type and attributes, by path.
 *
 * @param {TrustProductInput} input
 * @param {A2pRegistrationPath} path
 * @returns {{ type: string, attributes: Record<string, string> }}
 */
export function buildTrustEndUser(input, path) {
  if (path === "sole-proprietor") {
    /** @type {Record<string, string>} */
    const attributes = {
      brand_name: String(input.brandName ?? "").trim(),
      mobile_phone_number: String(input.mobile ?? "").trim(),
    };
    if (!blank(input.vertical)) attributes.vertical = String(input.vertical);
    return { type: "sole_proprietor_information", attributes };
  }
  /** @type {Record<string, string>} */
  const attributes = {
    company_type: String(input.companyType ?? ""),
    brand_contact_email: String(input.brandContactEmail ?? "").trim(),
  };
  // Omitted rather than sent empty for a private company, for the same reason as every other
  // optional attribute: an empty string is a value Twilio evaluates, not a field it skips.
  if (input.companyType === "public") {
    attributes.stock_exchange = String(input.stockExchange ?? "").trim();
    attributes.stock_ticker = String(input.stockTicker ?? "").trim();
  }
  return { type: "us_a2p_messaging_profile_information", attributes };
}

/**
 * @typedef {object} EvaluationSummary
 * @property {"compliant" | "noncompliant" | "unknown"} status
 * @property {string} sid `EL…`
 * @property {Array<{ requirement: string, objectType: string, field: string, reason: string }>} failures
 */

/**
 * Reduce a Trust Hub evaluation response to what the operator needs: did it pass, and which
 * field on which object did not.
 *
 * **Written against the RECORDED shape** (`test/fixtures/trusthub/evaluation-*.json`):
 * `results[]` each carry `passed` and a `fields[]` of `{ object_field, passed,
 * failure_reason }`. Twilio's ISV guide documents `valid[]` / `invalid[]` instead; that shape
 * appears on no response this account has returned, so it is read only as a fallback.
 *
 * Any status other than the literal `compliant` is not a pass. A response we cannot parse
 * becomes `unknown`, which `submitProfile` refuses exactly like `noncompliant`.
 *
 * Reasons are passed through `scrubVendorMessage` with no submitted values — evaluations
 * carry field names, never values, on every recorded response, but a reason string is vendor
 * prose and the tax-ID shape check costs nothing.
 *
 * @param {unknown} body
 * @returns {EvaluationSummary}
 */
export function summarizeEvaluation(body) {
  const b = /** @type {Record<string, any>} */ (body && typeof body === "object" ? body : {});
  const raw = String(b.status ?? "");
  const status = raw === "compliant" ? "compliant" : raw === "noncompliant" ? "noncompliant" : "unknown";
  /** @type {EvaluationSummary["failures"]} */
  const failures = [];
  for (const r of Array.isArray(b.results) ? b.results : []) {
    const requirement = String(r?.requirement_friendly_name ?? r?.requirement_name ?? r?.friendly_name ?? "");
    const objectType = String(r?.object_type ?? "");
    const recorded = Array.isArray(r?.fields);
    const fields = recorded ? r.fields : Array.isArray(r?.invalid) ? r.invalid : [];
    let reported = false;
    for (const f of fields) {
      // `invalid[]` items carry no `passed`; their presence is the failure.
      if (recorded && f?.passed !== false) continue;
      reported = true;
      failures.push({
        requirement,
        objectType,
        field: String(f?.object_field ?? f?.friendly_name ?? ""),
        reason: scrubVendorMessage(String(f?.failure_reason ?? ""), []),
      });
    }
    if (r?.passed === false && !reported) {
      // A requirement can fail with no field-level entry — a missing object, typically.
      failures.push({ requirement, objectType, field: "", reason: scrubVendorMessage(String(r?.failure_reason ?? ""), []) });
    }
  }
  return { status, sid: String(b.sid ?? ""), failures };
}

/**
 * Scrub a vendor error message before it reaches a log line or the operator.
 *
 * A Twilio 400 is the likeliest leak in the whole design: it echoes the offending value back
 * ("Invalid business_registration_number: 47-1234567"), and an unhandled throw in a Next
 * route prints its message to stderr, which Vercel captures. So the field-level reason — which
 * the runbook rightly wants surfaced instead of waiting days for a rejection — is kept, and
 * every value this request submitted is removed from it, by identity *and* by shape.
 *
 * @param {string} message
 * @param {string[]} submitted Values the client submitted on this request. Never logged.
 * @returns {string}
 */
export function scrubVendorMessage(message, submitted) {
  let out = String(message ?? "");
  for (const value of submitted) {
    const trimmed = String(value ?? "").trim();
    // Short values (a two-letter region, a title) would mangle the message for no gain, and
    // are not identifiers worth protecting.
    if (trimmed.length < 4) continue;
    out = out.split(trimmed).join("[redacted]");
  }
  // Belt and braces: anything still tax-ID-shaped goes, recognised or not.
  return out.replace(new RegExp(TAX_ID_SHAPE.source, "g"), "[redacted]");
}
