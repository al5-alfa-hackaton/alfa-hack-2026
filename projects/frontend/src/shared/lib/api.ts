import { createApiClient } from '@alfa/api-client'
// No credentials are bundled or persisted. Deployment authentication belongs to the server.
export const api = createApiClient()
export { ApiError, unwrap } from '@alfa/api-client'
export type { operations } from '@alfa/api-client'
