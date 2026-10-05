export type RequestId = number

export type RequestTracker = {
  begin: () => RequestId
  isCurrent: (requestId: RequestId) => boolean
  invalidate: () => void
}

export function createRequestTracker(): RequestTracker {
  let currentRequestId = 0

  return {
    begin() {
      currentRequestId += 1
      return currentRequestId
    },
    isCurrent(requestId) {
      return requestId === currentRequestId
    },
    invalidate() {
      currentRequestId += 1
    },
  }
}
