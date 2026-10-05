/// <reference types="node" />
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'

// jsdom's Blob is not cloneable by Node's structuredClone, which
// fake-indexeddb uses — stored blobs would come back as empty objects.
// Node's Blob clones natively, so swap it in for the test environment.
globalThis.Blob = NodeBlob as unknown as typeof Blob

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub
