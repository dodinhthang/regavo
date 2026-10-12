type CloudflareRequest = Request & { cf?: { country?: string | null } };
type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

// Only the Cloudflare runtime APIs used by this entry point are declared here.
declare class HTMLRewriter {
  on(
    selector: string,
    handler: { element(element: { setAttribute(name: string, value: string): void }): void },
  ): this;
  transform(response: Response): Response;
}

export default {
  async fetch(request: CloudflareRequest, env: Env): Promise<Response> {
    // Document metadata varies by visitor; an asset validator must not reuse old HTML.
    const headers = new Headers(request.headers);
    headers.delete('If-None-Match');
    headers.delete('If-Modified-Since');
    const asset = await env.ASSETS.fetch(new Request(request, { headers }));
    if (asset.status !== 200 || !asset.headers.get('Content-Type')?.startsWith('text/html'))
      return asset;

    const response = new Response(asset.body, asset);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.delete('ETag');
    response.headers.delete('Last-Modified');
    response.headers.delete('Content-Length');
    if (request.method === 'HEAD') return response;

    const country = request.cf?.country;
    return new HTMLRewriter()
      .on('html', {
        element(element) {
          element.setAttribute(
            'data-cf-country',
            country && /^[A-Z]{2}$/.test(country) ? country : '',
          );
        },
      })
      .transform(response);
  },
};
