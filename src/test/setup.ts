import 'fake-indexeddb/auto';

// Enable React 19 act() environment in test runner
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
