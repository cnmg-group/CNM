// Cloudflare Pages Function: every /api/* request goes to the shared handlers (see netlify/lib/cloudflare.mjs).
import { handleApi } from '../../netlify/lib/cloudflare.mjs';

export const onRequest = (context) => handleApi(context);
