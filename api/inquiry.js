import { onRequestPost } from '../functions/api/inquiry.js';
import { adaptPostHandler } from './_adapter.js';

export default adaptPostHandler(onRequestPost);
