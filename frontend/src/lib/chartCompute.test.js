// chartCompute.test.js
//
// Tests matchesFilter() specifically -- the highest-risk piece of logic
// in this whole project. Everywhere else operates on a bounded set of
// column types, tested exhaustively against real files. This function
// has to handle ANY value an AI-generated filter might produce compared
// against ANY way real data might represent the same underlying concept
// (a boolean spelled five different ways, a date as a string, etc). That
// combination is not something that can be fully enumerated up front --
// every case below was added because a specific real bug surfaced it.
//
// Run with: node chartCompute.test.js
// Add a new case here every time a new mismatch is found in production,
// rather than fixing it and moving on -- that's what turns "whack-a-mole"
// into an actual, shrinking, known list of covered scenarios.

import { matchesFilter } from './chartCompute.js'

const cases = [
  // Boolean representation mismatches (found in production, Aug 13 2026)
  [{ job: 'No' }, { column: 'job', operator: '==', value: true }, false, "'No' vs true"],
  [{ job: 'Yes' }, { column: 'job', operator: '==', value: true }, true, "'Yes' vs true"],
  [{ job: 'Yes' }, { column: 'job', operator: '==', value: 'yes' }, true, "'Yes' vs 'yes'"],
  [{ job: 'YES' }, { column: 'job', operator: '==', value: true }, true, "'YES' (all caps) vs true"],
  [{ flag: '1' }, { column: 'flag', operator: '==', value: 'true' }, true, "'1' vs 'true'"],
  [{ flag: '0' }, { column: 'flag', operator: '==', value: false }, true, "'0' vs false"],
  [{ flag: 'Y' }, { column: 'flag', operator: '==', value: 'N' }, false, "'Y' vs 'N'"],
  [{ job: 'No' }, { column: 'job', operator: '!=', value: true }, true, "'No' != true"],

  // Date string comparisons (found in production, Aug 13 2026)
  [{ date: '2024-06-15' }, { column: 'date', operator: '>', value: '2024-01-01' }, true, "date > earlier date"],
  [{ date: '2024-01-01' }, { column: 'date', operator: '>', value: '2024-06-15' }, false, "date > later date"],
  [{ date: '2024-06-15' }, { column: 'date', operator: '<', value: '2025-01-01' }, true, "date < later date"],
  [{ date: '2024-06-15' }, { column: 'date', operator: '>=', value: '2024-06-15' }, true, "date >= same date"],
  [{ date: '2023-12-31' }, { column: 'date', operator: '>', value: '2024-01-01' }, false, "year boundary correctly ordered"],

  // Plain numeric comparisons (must stay correct after all the above)
  [{ age: 5 }, { column: 'age', operator: '==', value: 5 }, true, "numeric equality"],
  [{ age: 1 }, { column: 'age', operator: '==', value: 2 }, false, "numeric inequality"],
  [{ age: 10 }, { column: 'age', operator: '>', value: 5 }, true, "numeric >"],
  [{ age: 3 }, { column: 'age', operator: '>', value: 5 }, false, "numeric > false case"],
  [{ age: 5 }, { column: 'age', operator: '<=', value: 5 }, true, "numeric <= equal"],

  // String/categorical comparisons
  [{ region: 'East' }, { column: 'region', operator: '==', value: 'east' }, true, "case-insensitive string match"],
  [{ region: 'East' }, { column: 'region', operator: '==', value: 'West' }, false, "genuinely different strings"],
  [{ region: 'East' }, { column: 'region', operator: '!=', value: 'West' }, true, "!= on different strings"],

  // Null/undefined handling -- should never match, never throw
  [{ region: null }, { column: 'region', operator: '==', value: 'East' }, false, "null row value"],
  [{}, { column: 'region', operator: '==', value: 'East' }, false, "missing column entirely"],
]

let passed = 0
let failed = 0
for (const [row, filter, expected, desc] of cases) {
  let result
  try {
    result = matchesFilter(row, filter)
  } catch (e) {
    console.log(`[ERROR] ${desc}: threw ${e.message}`)
    failed++
    continue
  }
  if (result === expected) {
    passed++
  } else {
    console.log(`[FAIL]  ${desc}: got ${result}, expected ${expected}`)
    failed++
  }
}

console.log()
console.log(`${passed} passed, ${failed} failed, out of ${cases.length} total cases`)
process.exit(failed > 0 ? 1 : 0)
