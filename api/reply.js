import { onRequestPost } from '../functions/api/reply.js';
import { adaptPostHandler } from './_adapter.js';

export default adaptPostHandler(onRequestPost);
