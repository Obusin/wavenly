/* Vercel's Node function interface adapted to the existing Web Request based
   handlers. The business logic stays shared with the Pages implementation. */
export const adaptPostHandler = (pagesHandler) => async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const origin = `https://${req.headers.host || 'wavenly.vercel.app'}`;
  const request = new Request(new URL(req.url || '/', origin), {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body ?? {}),
  });
  const response = await pagesHandler({ request, env: process.env });

  for (const [name, value] of response.headers) res.setHeader(name, value);
  res.status(response.status).send(await response.text());
};
