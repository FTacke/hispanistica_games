/**
 * Corpus simple form helpers
 *
 * Ensures that sensitive and include_regional values are always sent as explicit
 * parameters (1 or 0). This avoids the problem where unchecked checkboxes are
 * omitted from GET parameters.
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("corpus-search-form");
  if (!form) return;

  const sensitiveCheckbox = document.getElementById("sensitive-search");
  const includeRegionalCheckbox = document.getElementById("include-regional");

  // Add (or find) hidden inputs for these values
  const ensureHidden = (name) => {
    let hid = form.querySelector(`input[type=hidden][name="${name}"]`);
    if (!hid) {
      hid = document.createElement("input");
      hid.type = "hidden";
      hid.name = name;
      form.appendChild(hid);
    }
    return hid;
  };

  const sensitiveHidden = ensureHidden("sensitive");
  const includeRegionalHidden = ensureHidden("include_regional");

  const updateHidden = () => {
    sensitiveHidden.value =
      sensitiveCheckbox && sensitiveCheckbox.checked ? "1" : "0";
    includeRegionalHidden.value =
      includeRegionalCheckbox && includeRegionalCheckbox.checked ? "1" : "0";
  };

  // Update before submission and on change
  if (sensitiveCheckbox)
    sensitiveCheckbox.addEventListener("change", updateHidden);
  if (includeRegionalCheckbox)
    includeRegionalCheckbox.addEventListener("change", updateHidden);
  form.addEventListener("submit", updateHidden);

  // Initialize once
  updateHidden();
});
