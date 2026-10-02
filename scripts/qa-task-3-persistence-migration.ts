import { parsePersisted } from '../src/domain/persistence';

let passed = 0;
let failed = 0;

// Test 1: undefined input
try {
  const result = parsePersisted(undefined);
  if (result._v === 1 && result.streak === 0 && Object.keys(result.games).length === 0) {
    console.log('✓ Test 1: parsePersisted(undefined) returns default');
    passed++;
  } else {
    console.log('✗ Test 1: parsePersisted(undefined) returned unexpected state');
    failed++;
  }
} catch (e) {
  console.log('✗ Test 1: parsePersisted(undefined) threw exception');
  failed++;
}

// Test 2: Invalid JSON string
try {
  const result = parsePersisted('not json at all');
  if (result._v === 1 && result.streak === 0) {
    console.log('✓ Test 2: parsePersisted(invalid JSON) returns default without throwing');
    passed++;
  } else {
    console.log('✗ Test 2: parsePersisted(invalid JSON) returned unexpected state');
    failed++;
  }
} catch (e) {
  console.log('✗ Test 2: parsePersisted(invalid JSON) threw exception');
  failed++;
}

// Test 3: V1 input with streak preserved
try {
  const result = parsePersisted('{"_v":1,"streak":5,"games":{}}');
  if (result._v === 1 && result.streak === 5) {
    console.log('✓ Test 3: parsePersisted(v1 input) preserves streak value');
    passed++;
  } else {
    console.log('✗ Test 3: parsePersisted(v1 input) did not preserve streak');
    failed++;
  }
} catch (e) {
  console.log('✗ Test 3: parsePersisted(v1 input) threw exception');
  failed++;
}

// Test 4: Unknown future version
try {
  const result = parsePersisted('{"_v":999,"garbage":true}');
  if (result._v === 1 && result.streak === 0) {
    console.log('✓ Test 4: parsePersisted(unknown version) returns default without throwing');
    passed++;
  } else {
    console.log('✗ Test 4: parsePersisted(unknown version) returned unexpected state');
    failed++;
  }
} catch (e) {
  console.log('✗ Test 4: parsePersisted(unknown version) threw exception');
  failed++;
}

// Test 5: Empty object
try {
  const result = parsePersisted('{}');
  if (result._v === 1 && result.streak === 0) {
    console.log('✓ Test 5: parsePersisted({}) returns default without throwing');
    passed++;
  } else {
    console.log('✗ Test 5: parsePersisted({}) returned unexpected state');
    failed++;
  }
} catch (e) {
  console.log('✗ Test 5: parsePersisted({}) threw exception');
  failed++;
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
