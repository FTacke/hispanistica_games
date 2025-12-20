export function formatMorphLeipzig(pos, morph) {
  const info = morph || {};
  const get = (key) => info[key] || "";

  if (pos === "VERB" || pos === "AUX") {
    const person = get("Person");
    const number =
      get("Number") === "Sing" ? "SG" : get("Number") === "Plur" ? "PL" : "";
    const mood = get("Mood");
    const tense = get("Tense");
    const aspect = get("Aspect");
    return [person + number, mood, tense, aspect]
      .filter(Boolean)
      .join(".")
      .toUpperCase();
  }

  if (pos === "NOUN" || pos === "PROPN") {
    const gender = get("Gender")?.toUpperCase();
    const number = get("Number") === "Sing" ? "SG" : "PL";
    const case_ = get("Case")?.toUpperCase();
    return [number, gender, case_].filter(Boolean).join(".");
  }

  if (pos === "PRON") {
    const person = get("Person");
    const number = get("Number") === "Sing" ? "SG" : "PL";
    const gender = get("Gender")?.toUpperCase();
    const case_ = get("Case")?.toUpperCase();
    const poss = get("Poss") === "Yes" ? "POSS" : "";
    return [person + number, gender, case_, poss].filter(Boolean).join(".");
  }

  if (pos === "ADJ") {
    const degree = get("Degree");
    const gender = get("Gender")?.toUpperCase();
    const number = get("Number") === "Sing" ? "SG" : "PL";
    return [degree, number, gender].filter(Boolean).join(".");
  }

  return Object.entries(info)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}
