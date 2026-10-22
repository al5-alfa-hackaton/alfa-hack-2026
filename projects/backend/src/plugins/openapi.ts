import type { SwaggerTransformObject } from '@fastify/swagger'
// Fastify's Zod response serializer describes JSON; these two handlers explicitly stream bytes.
export const transformOpenApi: SwaggerTransformObject = (input) => {
  if (!('openapiObject' in input)) return input.swaggerObject
  const document = input.openapiObject
  for (const [path, contentType, format] of [
    ['/v1/analysis-runs/{id}/events', 'text/event-stream', undefined],
    ['/v1/documents/{documentId}/pages/{pageNumber}/image', 'image/png', 'binary'],
  ] as const) {
    const response = document.paths?.[path]?.get?.responses?.['200']
    if (response && !('$ref' in response))
      response.content = {
        [contentType]: { schema: { type: 'string', ...(format ? { format } : {}) } },
      }
  }
  return document
}
