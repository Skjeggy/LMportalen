function normalizeText(s) {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .trim();
}

function normalizeCode(s) {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function digitsOnly(s) {
  return (s ?? "")
    .toString()
    .replace(/\D/g, "");
}

function isNumericToken(token) {
  return /^\d+$/.test(token);
}

function getLearningForms(item) {
  return (item.aktiviteter || [])
    .map((a) => (a.laeringsform ?? "").toString().trim())
    .filter(Boolean);
}

function buildSearchText(item) {
  const aktiviteterText = (item.aktiviteter || [])
    .map((a) => {
      const lf = a.laeringsform || "";
      const b = a.beskrivelse || "";

      const items = (a.items || [])
        .map((x) => {
          if (typeof x === "string") return x;

          const name = x?.laeringsaktivitet || "";
          const desc = x?.beskrivelse || "";
          return `${name} ${desc}`.trim();
        })
        .join(" ");

      return `${lf} ${b} ${items}`.trim();
    })
    .join(" ");

  return normalizeText(
    [
      item.korttekst_lm,
      item.tema,
      item.kode,
      item.laeringsmaal,
      aktiviteterText,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function normalizeNumberString(s) {
  return String(Number(s));
}




function matchesNumberPattern(itemDigits, queryDigits) {
  if (!itemDigits || !queryDigits) return false;

  // 3+ digits: exact only
  if (queryDigits.length >= 3) {
    return itemDigits === queryDigits;
  }

  // 2 digits:
  // "07" -> "007", "070", "071"
  // "22" -> "022"
  if (queryDigits.length === 2) {
    const paddedItem = itemDigits.padStart(3, "0");

    if (paddedItem.startsWith(queryDigits)) return true;

    const normalizedItem = normalizeNumberString(itemDigits);
    const normalizedQuery = normalizeNumberString(queryDigits);

    return normalizedItem === normalizedQuery;
  }

  // 1 digit:
  // "0" -> should match "014", "071", "099"
  // "7" -> should match 7, 70, 71, 75 but not 57
  if (queryDigits.length === 1) {
    const paddedItem = itemDigits.padStart(3, "0");

    // important: preserve raw leading-zero behavior
    if (queryDigits === "0") {
      return paddedItem.startsWith("0");
    }

    const normalizedItem = normalizeNumberString(itemDigits);
    return normalizedItem.startsWith(queryDigits);
  }

  return false;
}






function matchesCodeSearch(itemCode, searchText) {
  const code = normalizeCode(itemCode);
  const query = normalizeCode(searchText);

  if (!query) return false;

  // if query contains letters, allow direct compact code checks
  if (/[a-z]/.test(query)) {
    if (code === query) return true;
    if (code.startsWith(query)) return true;
  }

  const codeDigits = digitsOnly(code);
  const queryDigits = digitsOnly(query);

  if (!queryDigits) return false;

  return matchesNumberPattern(codeDigits, queryDigits);
}

function matchesNumericToken(textWord, queryToken) {
  const wordDigits = digitsOnly(textWord);
  const queryDigits = digitsOnly(queryToken);

  if (!wordDigits || !queryDigits) return false;

  return matchesNumberPattern(wordDigits, queryDigits);
}


function fuzzyMatch(text, query) {
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) return true;

  if (normalizedText.includes(normalizedQuery)) return true;

  const queryWords = normalizedQuery.split(/\s+/);
  const textWords = normalizedText.split(/\s+/);

  return queryWords.every((queryWord) =>
    textWords.some((textWord) => {
      if (isNumericToken(queryWord)) {
        return matchesNumericToken(textWord, queryWord);
      }

      return isFuzzyWordMatch(textWord, queryWord);
    })
  );
}

function isFuzzyWordMatch(word, query) {
  if (!word || !query) return false;

  if (word.includes(query)) return true;

  const wordPrefix = word.slice(0, query.length);
  const prefixDistance = levenshteinDistance(wordPrefix, query);

  if (query.length <= 4 && prefixDistance <= 1) return true;
  if (query.length <= 8 && prefixDistance <= 2) return true;
  if (query.length > 8 && prefixDistance <= 3) return true;

  const distance = levenshteinDistance(word, query);



  if (query.length <= 4) return distance <= 1;
  if (query.length <= 8) return distance <= 2;
  return distance <= 3;        
}





function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, () =>
    Array(a.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

export function filterItems(items, filters) {
  const { searchText, selectedTema, selectedForm } = filters;

  return items.filter((item) => {
    const tema = (item.tema ?? "").toString().trim();
    const forms = getLearningForms(item);

    const matchesTema = selectedTema === "all" || tema === selectedTema;
    const matchesForm = selectedForm === "all" || forms.includes(selectedForm);

    const haystack = buildSearchText(item);

    const matchesSearch =
      !searchText ||
      matchesCodeSearch(item.kode, searchText) ||
      fuzzyMatch(haystack, searchText);

    return matchesTema && matchesForm && matchesSearch;
  });
}